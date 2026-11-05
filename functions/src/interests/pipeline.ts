/**
 * addInterests, steps (1)–(7) of DESIGN.md §5.2 after D1 (the app embeds every tag):
 * normalize → moderation → tag cache by tagKey → trust the client vector for a new text → sensitivity per holding →
 * consent gate → concept assignment in the holding's partition → persist in one transaction.
 *
 * The server repeats everything that does not need the model (normalization, PII, blocklist, third-party kinship,
 * the lexicon) and recomputes the detector margin from the client's vector when it has the prototypes. A holding
 * that is refused (no blanket consent, someone else's Art. 9 data, sensitive holdings switched off) leaves nothing
 * behind: no document, no log line.
 */
import {
  EMBEDDING_MODEL,
  decideSensitivity,
  detectorMargin,
  interestId as interestIdOf,
  isKnownOrdinary,
  lexiconCheck,
  newConceptId,
  normalizeTag,
  reconcileDetectorMargin,
  renormalize,
  type CallableInput,
  type HmacSha256,
  type Partition,
  type Prototypes,
  type SensitivityDecision,
} from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import type { Firestore } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { docs } from '../lib/firestore';
import { planAssignment, type ConceptIndex } from './assign';
import { LIMITS } from './config';
import { moderateTag } from './moderation';
import { persist, StalePlanError, type AddInterestResult, type Assignment, type PersistItem } from './persist';
import type { PrototypeSource } from './prototypes';
import { ownPartition, slotFor, slotOfConcept, tagKeyFor, tagStateFromDoc, type Slot, type TagState } from './tags';

export type AddInterestsInput = CallableInput<'addInterests'>;
export type AddInterestsItem = AddInterestsInput['items'][number];
export type { AddInterestResult } from './persist';

export interface PipelineDeps {
  readonly db: Firestore;
  readonly conceptIndex: ConceptIndex;
  readonly prototypes: PrototypeSource;
  /** HMAC with UID_HMAC_KEY, for `interestId` and new concept ids (§8.1). */
  readonly hmac: HmacSha256;
  /** ART9_HOLDINGS_ENABLED in production; tests of the sensitive path switch it on. */
  readonly art9Holdings: boolean;
}

export interface AddInterestsRequest {
  readonly uid: string;
  readonly items: readonly AddInterestsItem[];
  readonly now: number;
}

/** A holding the user already has under this interestId. */
interface Existing {
  readonly partition: Partition;
  readonly conceptId: string | null;
}

interface Candidate {
  readonly index: number;
  readonly input: AddInterestsItem;
  readonly norm: string;
  readonly display: string;
  readonly tagKey: string;
  readonly interestId: string;
  readonly lexiconHit: boolean;
  readonly thirdParty: boolean;
  readonly existing: Existing | null;
}

type Results = (AddInterestResult | undefined)[];

export async function addInterests(deps: PipelineDeps, req: AddInterestsRequest): Promise<AddInterestResult[]> {
  const results: Results = req.items.map(() => undefined);
  const { candidates, hasArt9Consent } = await screen(deps, req, results);

  let pending = candidates;
  for (let attempt = 0; pending.length > 0; attempt++) {
    const plan = await planItems(deps, pending, results, hasArt9Consent);
    if (plan.length === 0) break;
    try {
      const outcome = await persist({ db: deps.db, uid: req.uid, now: req.now }, plan);
      for (const [index, r] of outcome) results[index] = r;
      break;
    } catch (err) {
      // Someone changed a tag, a concept or a holding between planning and the transaction: re-plan once.
      if (!(err instanceof StalePlanError) || attempt >= 1) throw err;
      const planned = new Set(plan.map((p) => p.index));
      pending = candidates.filter((c) => planned.has(c.index));
      for (const c of pending) results[c.index] = undefined;
    }
  }

  return results.map((r) => {
    if (!r) throw new Error('addInterests: item without a result');
    return r;
  });
}

/** Steps (1)–(2), duplicates and the interest limit, before any tag is read. */
async function screen(deps: PipelineDeps, req: AddInterestsRequest, results: Results): Promise<{ candidates: Candidate[]; hasArt9Consent: boolean }> {
  const refs = docs(deps.db);
  const [user, ordinary, sensitive] = await Promise.all([
    refs.user(req.uid).get(),
    deps.db.collection(`users/${req.uid}/interests`).get(),
    deps.db.collection(`users/${req.uid}/sensitiveInterests`).get(),
  ]);
  if (!user.exists) throw new AppError('NOT_ONBOARDED');
  const existing = new Map<string, Existing>();
  for (const d of ordinary.docs) existing.set(d.id, { partition: 'ordinary', conceptId: (d.get('conceptId') as string | null | undefined) ?? null });
  for (const d of sensitive.docs) existing.set(d.id, { partition: 'sensitive', conceptId: (d.get('conceptId') as string | undefined) ?? null });
  const full = existing.size >= LIMITS.maxInterests;
  const seen = new Set<string>();
  const out: Candidate[] = [];

  for (const [index, input] of req.items.entries()) {
    const n = normalizeTag(input.text);
    if (!n.ok) {
      results[index] = { status: 'rejected', reasonCode: n.code };
      continue;
    }
    const mod = moderateTag(n.norm, n.display);
    if (!mod.ok) {
      results[index] = { status: 'rejected', reasonCode: mod.reason };
      continue;
    }
    const interestId = await interestIdOf(deps.hmac, req.uid, n.norm);
    const held = existing.get(interestId) ?? null;
    // Only a flag can change an existing holding; sent again without one it is just a duplicate.
    const change = held !== null && (input.selfFlagPrivate === true || input.notSensitiveForMe === true);
    if (seen.has(interestId) || (held && !change)) {
      results[index] = { status: 'duplicate', interestId };
      continue;
    }
    seen.add(interestId);
    if (full && !held) {
      results[index] = { status: 'limit', reasonCode: 'INTEREST_LIMIT' };
      continue;
    }
    out.push({
      index,
      input,
      norm: n.norm,
      display: n.display,
      tagKey: tagKeyFor(n.norm, EMBEDDING_MODEL.modelKey),
      interestId,
      // The client's lexicon OR ours: either can only add sensitivity.
      lexiconHit: input.detector.lexiconHit || lexiconCheck(n.norm).hit,
      thirdParty: mod.thirdParty,
      existing: held,
    });
  }
  return { candidates: out, hasArt9Consent: user.get('legal.art9') !== undefined };
}

/** Steps (3)–(6): tag state, sensitivity and the consent gate, then the assignment for what may persist. */
async function planItems(deps: PipelineDeps, candidates: readonly Candidate[], results: Results, hasArt9Consent: boolean): Promise<PersistItem[]> {
  const snaps = await deps.db.getAll(...candidates.map((c) => deps.db.doc(`tags/${c.tagKey}`)));
  const stored = new Map<string, TagState>();
  snaps.forEach((snap, k) => {
    if (snap.exists) stored.set(candidates[k]!.tagKey, tagStateFromDoc(snap, EMBEDDING_MODEL.dim));
  });
  const prototypes = await deps.prototypes();

  const plan: PersistItem[] = [];
  for (const c of candidates) {
    const known = stored.get(c.tagKey);
    const state = known ?? newTagState(c, prototypes);
    const decision = decideSensitivity({
      lexiconHit: c.lexiconHit || state.sens.lexiconHit,
      detectorMargin: known ? holdingMargin(c, known, prototypes) : state.sens.margin,
      knownOrdinary: state.sens.knownOrdinary,
      selfFlagPrivate: c.input.selfFlagPrivate === true,
      notSensitiveForMe: c.input.notSensitiveForMe === true,
      thirdParty: c.thirdParty,
      hasArt9Consent,
    });
    if (gate(c, decision, results, deps.art9Holdings)) continue;

    const partition: Partition = decision.holdingSensitive ? 'sensitive' : 'ordinary';
    let from: Slot | null = null;
    if (c.existing) {
      if (c.existing.partition === partition) {
        results[c.index] = { status: 'duplicate', interestId: c.interestId };
        continue;
      }
      from = slotOfConcept(state, c.existing.conceptId);
      // The holding points at no slot of its tag: inconsistent data, never something to guess at.
      if (from === null) throw new Error('addInterests: holding without a tag slot');
    }
    // A tag's own partition is fixed when it is first stored; a newer lexicon only moves new holdings aside.
    const slot = slotFor(partition, ownPartition(state.sens));
    plan.push({
      index: c.index,
      norm: c.norm,
      display: c.display,
      tagKey: c.tagKey,
      interestId: c.interestId,
      partition,
      slot,
      tag: state,
      assignment: await assignment(deps, c, state, partition, slot),
      from,
      sensitive: partition === 'sensitive' ? { source: decision.holdingSource ?? 'self', selfFlagged: c.input.selfFlagPrivate === true } : null,
      notSensitiveForMe: decision.overridden,
      thirdPartyWarning: decision.thirdPartyWarning,
    });
  }
  return plan;
}

/**
 * The margin a holding of an already stored text is decided with. The stored margin came from the first writer's
 * vector, which may have been crafted (D1), so this request's own client margin can still raise it: sensitivity only
 * ratchets upward per holding. The tag's own partition stays as first stored; such a holding uses the private slot.
 */
function holdingMargin(c: Candidate, known: TagState, prototypes: Prototypes | null): number | null {
  if (known.sens.margin === null || !Number.isFinite(known.sens.margin)) return null;
  const server = prototypes ? Math.max(known.sens.margin, detectorMargin(known.vec, prototypes)) : known.sens.margin;
  return reconcileDetectorMargin(c.input.detector.margin, server);
}

/** A text first seen now: the client's vector (trusted, D1) and the tag-level signals at this moment. */
function newTagState(c: Candidate, prototypes: Prototypes | null): TagState {
  const vec = renormalize(c.input.vector);
  const margin = reconcileDetectorMargin(c.input.detector.margin, prototypes ? detectorMargin(vec, prototypes) : null);
  const knownOrdinary = isKnownOrdinary(c.norm);
  const tag = decideSensitivity({
    lexiconHit: c.lexiconHit,
    detectorMargin: margin,
    knownOrdinary,
    selfFlagPrivate: false,
    notSensitiveForMe: false,
    thirdParty: false,
    hasArt9Consent: false,
  }).tag;
  return {
    exists: false,
    vec,
    sens: { sensitive: tag === 'sensitive', margin, lexiconHit: c.lexiconHit, knownOrdinary, rulesVersion: '' },
    slots: { own: null, private: null, ordinary: null },
  };
}

/** The consent gate. Returns true when the item is finished here. */
function gate(c: Candidate, d: SensitivityDecision, results: Results, art9Holdings: boolean): boolean {
  if (d.outcome === 'refuseThirdParty') {
    results[c.index] = { status: 'rejected', reasonCode: 'THIRD_PARTY_SENSITIVE' };
    return true;
  }
  if (d.holdingSensitive && !art9Holdings) {
    results[c.index] = { status: 'limit', reasonCode: 'SENSITIVE_UNAVAILABLE' };
    return true;
  }
  if (d.outcome === 'refuseNoConsent') {
    results[c.index] = { status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' };
    return true;
  }
  return false;
}

/**
 * Deterministic id of a new concept per slot, so racing creators of one text meet (§5.2 (7)). The ordinary slot of a
 * sensitive tag hashes a derived key: its id must differ from the tag's own (sensitive) concept, and must not carry
 * the `_p` suffix of a private concept.
 */
async function freshConceptId(hmac: HmacSha256, tagKey: string, slot: Slot): Promise<string> {
  if (slot === 'ordinary') return newConceptId(hmac, sha256Hex(`ordinaryAssign|${tagKey}`), false);
  return newConceptId(hmac, tagKey, slot === 'private');
}

async function assignment(deps: PipelineDeps, c: Candidate, state: TagState, partition: Partition, slot: Slot): Promise<Assignment> {
  const held = state.slots[slot];
  if (held) return { kind: 'existing', conceptId: held };
  const { decision, nearest } = await planAssignment(deps.conceptIndex, partition, state.vec, EMBEDDING_MODEL.assign);
  const cos = nearest?.cosCentroid ?? 0;
  switch (decision.action) {
    case 'merge':
      return { kind: 'merge', conceptId: decision.conceptId, cos };
    case 'newWithLink':
      return {
        kind: 'new',
        conceptId: await freshConceptId(deps.hmac, c.tagKey, slot),
        cos,
        link: { conceptId: decision.linkTo, cos, suggest: decision.suggest, labels: nearest?.labels ?? {} },
      };
    case 'new':
      return { kind: 'new', conceptId: await freshConceptId(deps.hmac, c.tagKey, slot), cos };
  }
}
