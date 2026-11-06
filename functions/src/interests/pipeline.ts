/**
 * addInterests, steps (1)–(7) of DESIGN.md §5.2 after D1 (the app embeds every tag):
 * normalize → moderation → tag cache by tagKey → trust the client vector for a new text → sensitivity per holding →
 * consent gate → concept assignment in the holding's partition → persist in one transaction.
 *
 * The server repeats everything that does not need the model (normalization, PII, blocklist, third-party kinship).
 * Sensitivity is the on-device model's decision (F38): the server uses the detector margin the phone sent and never
 * recomputes it. A holding
 * that is refused (no blanket consent, someone else's Art. 9 data, sensitive holdings switched off) leaves nothing
 * behind: no document, no log line.
 */
import {
  EMBEDDING_MODEL,
  decideSensitivity,
  interestId as interestIdOf,
  newConceptId,
  normalizeTag,
  renormalize,
  type CallableInput,
  type HmacSha256,
  type Partition,
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
import { ownPartition, slotFor, slotOfConcept, tagKeyFor, tagStateFromDoc, type Slot, type TagState } from './tags';

export type AddInterestsInput = CallableInput<'addInterests'>;
export type AddInterestsItem = AddInterestsInput['items'][number];
export type { AddInterestResult } from './persist';

export interface PipelineDeps {
  readonly db: Firestore;
  readonly conceptIndex: ConceptIndex;
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

  const plan: PersistItem[] = [];
  for (const c of candidates) {
    const known = stored.get(c.tagKey);
    const state = known ?? newTagState(c);
    const decision = decideSensitivity({
      detectorMargin: known ? holdingMargin(c, known) : state.sens.margin,
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
    // A tag's own partition is fixed when it is first stored; a holder whose phone flags it uses the private slot.
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

/** The phone's margin; a non-finite one (the schema refuses it) is treated as missing, which fails closed. */
function clientMargin(c: Candidate): number | null {
  return Number.isFinite(c.input.detector.margin) ? c.input.detector.margin : null;
}

/**
 * The margin a holding of an already stored text is decided with: the higher of the stored margin (the first
 * writer's phone) and this holder's own phone margin. The first writer's vector and margin may have been crafted (D1),
 * so a later holder's own on-device result can still raise sensitivity for their holding, never lower it. The tag's
 * own partition stays as first stored; such a holding uses the private slot. A missing margin on either side fails
 * closed.
 */
function holdingMargin(c: Candidate, known: TagState): number | null {
  const own = clientMargin(c);
  if (known.sens.margin === null || !Number.isFinite(known.sens.margin) || own === null) return null;
  return Math.max(known.sens.margin, own);
}

/** A text first seen now: the client's vector and margin (trusted, D1, F38). */
function newTagState(c: Candidate): TagState {
  const vec = renormalize(c.input.vector);
  const margin = clientMargin(c);
  const tag = decideSensitivity({
    detectorMargin: margin,
    selfFlagPrivate: false,
    notSensitiveForMe: false,
    thirdParty: false,
    hasArt9Consent: false,
  }).tag;
  return {
    exists: false,
    vec,
    sens: { sensitive: tag === 'sensitive', margin },
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
