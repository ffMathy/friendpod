/**
 * addInterests pipeline, steps (1)–(7) of DESIGN.md §5.2:
 * normalize → moderation → cache lookup → embed misses → sensitivity per holding → consent gate →
 * concept assignment → persist in one transaction.
 *
 * Consent gate: a holding that is sensitive and has no valid consent ends as `needsConsent` and leaves
 * nothing behind: no document, no LRU entry, no log line (only an aggregate in-memory counter).
 * Vectors computed in this request live in request-local maps and reach the LRU only once their tag is
 * committed to `tags`. A clear lexicon hit without consent is answered before any model call.
 */
import {
  decideSensitivity,
  interestId as interestIdOf,
  isValidConsentProof,
  lexiconCheck,
  LEXICON_RULES_VERSION,
  newConceptId,
  normalizeTag,
  PartitionMismatchError,
  type CallableInput,
  type HmacSha256,
  type LexiconResult,
  type SensitivityDecision,
} from '@grouper/core';
import type { Firestore } from 'firebase-admin/firestore';
import { planAssignment, type ConceptIndex } from './assign';
import { LIMITS, type ModelConfig } from './config';
import { abuseShadowLevel, detectorMargin, type Prototypes } from './detect';
import { AppError } from './lib/errors';
import type { LruCache } from './lib/lru';
import type { Metrics } from './lib/metrics';
import type { Embedder } from './model';
import { moderateTag } from './moderation';
import { persist, StalePlanError, type AddInterestResult, type Assignment, type PersistItem } from './persist';
import { ownPartition, tagKeyFor, tagStateFromDoc, type TagState } from './tags';

export type AddInterestsItem = CallableInput<'addInterests'>['items'][number];
export type { AddInterestResult } from './persist';

export interface EmbedRuntime {
  readonly embedder: Embedder;
  readonly prototypes: Prototypes;
}

export interface PipelineDeps {
  readonly db: Firestore;
  readonly model: ModelConfig;
  /** Loads the model (and prototypes) on first use; called only for cache misses and warm-ups. */
  readonly runtime: () => Promise<EmbedRuntime>;
  readonly conceptIndex: ConceptIndex;
  /** Persisted tags only (§5.2 (3)). */
  readonly lru: LruCache<string, TagState>;
  /** HMAC with UID_HMAC_KEY, for `interestId` (§8.1). */
  readonly hmac: HmacSha256;
  readonly metrics: Metrics;
  readonly chargeEmbedBudget: (misses: number, now: Date) => Promise<boolean>;
  /** ART9_HOLDINGS_ENABLED in production; tests of the sensitive path switch it on. */
  readonly art9Holdings: boolean;
}

export interface AddInterestsRequest {
  readonly uid: string;
  readonly items: readonly AddInterestsItem[];
  readonly now: Date;
}

interface Candidate {
  readonly index: number;
  readonly input: AddInterestsItem;
  readonly norm: string;
  readonly display: string;
  readonly tagKey: string;
  readonly interestId: string;
  readonly lexicon: LexiconResult;
  readonly thirdParty: boolean;
  /** "Keep this private" on an ordinary holding the user already has (§10.2). */
  readonly convert: boolean;
}

type Results = (AddInterestResult | undefined)[];

export async function addInterests(deps: PipelineDeps, req: AddInterestsRequest): Promise<AddInterestResult[]> {
  // The server checks the consent pair against the versioned texts; an unknown pair proves nothing (PRIVACY.md §3.4).
  for (const item of req.items) {
    if (item.consent && !isValidConsentProof(item.consent, 'art9')) throw new AppError('VALIDATION');
  }
  const results: Results = req.items.map(() => undefined);
  const candidates = await screen(deps, req, results);
  // Request-local: discarded when the request ends, whatever the outcome.
  const embedded = new Map<string, TagState>();

  let pending = candidates;
  let bypassCache = false;
  for (let attempt = 0; pending.length > 0; attempt++) {
    const plan = await planItems(deps, req, pending, results, embedded, bypassCache);
    if (plan.length === 0) break;
    try {
      const outcome = await persist({ db: deps.db, model: deps.model, uid: req.uid, now: req.now }, plan);
      for (const [index, r] of outcome.results) results[index] = r;
      for (const [key, state] of outcome.persistedTags) deps.lru.set(key, state);
      break;
    } catch (err) {
      // Someone changed a tag or concept between planning and the transaction: re-plan once from Firestore.
      if (!(err instanceof StalePlanError) || attempt >= 1) throw err;
      deps.metrics.inc('stalePlanRetries');
      for (const key of err.tagKeys) deps.lru.delete(key);
      bypassCache = true;
      const planned = new Set(plan.map((p) => p.index));
      pending = candidates.filter((c) => planned.has(c.index));
    }
  }

  return results.map((r) => {
    if (!r) throw new Error('addInterests: item without a result');
    countResult(deps.metrics, r);
    return r;
  });
}

function countResult(metrics: Metrics, r: AddInterestResult): void {
  switch (r.status) {
    case 'added':
    case 'madePrivate':
    case 'needsConsent':
    case 'duplicate':
    case 'limit':
    case 'rejected':
      metrics.inc(r.status);
  }
  if (r.reasonCode === 'THIRD_PARTY_SENSITIVE') metrics.inc('refusedThirdParty');
}

/** Steps (1)–(2) plus duplicates, before any cache read or model call. */
async function screen(deps: PipelineDeps, req: AddInterestsRequest, results: Results): Promise<Candidate[]> {
  const [ordinary, sensitive] = await Promise.all([
    deps.db.collection(`users/${req.uid}/interests`).select().get(),
    deps.db.collection(`users/${req.uid}/sensitiveInterests`).select().get(),
  ]);
  const ordinaryIds = new Set(ordinary.docs.map((d) => d.id));
  const sensitiveIds = new Set(sensitive.docs.map((d) => d.id));
  const full = ordinaryIds.size + sensitiveIds.size >= LIMITS.maxInterests;
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
    const convert = input.selfFlag === true && ordinaryIds.has(interestId);
    if (seen.has(interestId) || sensitiveIds.has(interestId) || (ordinaryIds.has(interestId) && !convert)) {
      results[index] = { status: 'duplicate', interestId };
      continue;
    }
    seen.add(interestId);
    if (full && !convert) {
      results[index] = { status: 'limit', reasonCode: 'INTEREST_LIMIT' };
      continue;
    }
    out.push({
      index,
      input,
      norm: n.norm,
      display: n.display,
      tagKey: tagKeyFor(n.norm, deps.model.modelId),
      interestId,
      lexicon: lexiconCheck(n.norm),
      thirdParty: mod.thirdParty,
      convert,
    });
  }
  return out;
}

/** Steps (3)–(6): tag state, sensitivity and the consent gate, then the assignment for what may persist. */
async function planItems(
  deps: PipelineDeps,
  req: AddInterestsRequest,
  candidates: readonly Candidate[],
  results: Results,
  embedded: Map<string, TagState>,
  bypassCache: boolean,
): Promise<PersistItem[]> {
  // (3) LRU (persisted tags only) → one getAll for the misses.
  const states = new Map<string, TagState>();
  const toRead: Candidate[] = [];
  for (const c of candidates) {
    const hit = bypassCache ? undefined : deps.lru.peek(c.tagKey);
    if (hit) states.set(c.tagKey, hit);
    else toRead.push(c);
  }
  if (toRead.length > 0) {
    const snaps = await deps.db.getAll(...toRead.map((c) => deps.db.doc(`tags/${c.tagKey}`)));
    snaps.forEach((snap, k) => {
      if (snap.exists) states.set(toRead[k]!.tagKey, tagStateFromDoc(snap, deps.model.dim));
    });
  }
  deps.metrics.inc('cacheHits', states.size);

  // A new text with a clear lexicon hit needs no model to know it is sensitive: answer it before embedding.
  const needEmbed: Candidate[] = [];
  for (const c of candidates) {
    if (states.has(c.tagKey)) continue;
    const local = embedded.get(c.tagKey);
    if (local) {
      states.set(c.tagKey, local);
      continue;
    }
    if (c.lexicon.hit) {
      const early = decide(c, { reviewed: null, lexiconHit: true, margin: null });
      if (gate(c, early, results, deps.art9Holdings)) continue;
    }
    needEmbed.push(c);
  }

  // (4) one batched call for the misses, charged to the global daily budget first.
  if (needEmbed.length > 0) {
    deps.metrics.inc('cacheMisses', needEmbed.length);
    if (await deps.chargeEmbedBudget(needEmbed.length, req.now)) {
      for (const [k, state] of (await embedMisses(deps, needEmbed)).entries()) {
        const c = needEmbed[k]!;
        embedded.set(c.tagKey, state);
        states.set(c.tagKey, state);
      }
    } else {
      deps.metrics.inc('embedBudgetExceeded');
      for (const c of needEmbed) results[c.index] = { status: 'rejected', reasonCode: 'EMBED_BUDGET' };
    }
  }

  // (5) sensitivity per holding and the consent gate, (6) assignment in the holding's partition.
  const plan: PersistItem[] = [];
  for (const c of candidates) {
    const state = states.get(c.tagKey);
    if (!state || results[c.index]) continue;
    const decision = decide(c, {
      reviewed: state.sens.reviewed ?? null,
      // The lexicon at classification time or now: a newer lexicon can only add sensitivity here.
      lexiconHit: c.lexicon.hit || state.sens.lexiconHit,
      // A stored suspicion stands until a review or a rescan changes it.
      margin: state.exists && state.sens.suspected ? null : state.sens.margin,
    });
    if (gate(c, decision, results, deps.art9Holdings)) continue;

    const partition = decision.holdingSensitive ? 'sensitive' : 'ordinary';
    const tagPartition = ownPartition(state.sens);
    if (partition === 'ordinary' && tagPartition === 'sensitive') throw new PartitionMismatchError();
    const slot = partition === tagPartition ? 'own' : 'private';
    const consent = c.input.consent;
    if (partition === 'sensitive' && !consent) throw new Error('consent gate bypassed');
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
      convert: c.convert,
      sensitive:
        partition === 'sensitive' && consent
          ? {
              consent,
              source: decision.holdingSource ?? 'self',
              selfFlagged: c.input.selfFlag === true,
              ...(c.input.category ? { category: c.input.category } : {}),
              queueForReview: decision.queueForReview,
            }
          : null,
      thirdPartyWarning: decision.thirdPartyWarning,
    });
  }
  return plan;
}

function decide(c: Candidate, s: { reviewed: 'sensitive' | 'not' | null; lexiconHit: boolean; margin: number | null }): SensitivityDecision {
  return decideSensitivity({
    reviewed: s.reviewed,
    lexiconHit: s.lexiconHit,
    selfFlag: c.input.selfFlag === true,
    detectorMargin: s.margin,
    thirdParty: c.thirdParty,
  });
}

/** The consent gate. Returns true when the item is finished here (refused, or waiting for consent). */
function gate(c: Candidate, d: SensitivityDecision, results: Results, art9Holdings: boolean): boolean {
  if (d.outcome === 'refuseThirdParty') {
    results[c.index] = { status: 'rejected', reasonCode: 'THIRD_PARTY_SENSITIVE' };
    return true;
  }
  if (d.outcome === 'needsConsent' && !art9Holdings) {
    results[c.index] = { status: 'limit', reasonCode: 'SENSITIVE_UNAVAILABLE' };
    return true;
  }
  if (d.outcome === 'needsConsent' && !c.input.consent) {
    results[c.index] = { status: 'needsConsent' };
    return true;
  }
  return false;
}

async function embedMisses(deps: PipelineDeps, misses: readonly Candidate[]): Promise<TagState[]> {
  const { embedder, prototypes } = await deps.runtime();
  const { model } = deps;
  const texts = misses.map((c) => c.norm);
  const t0 = performance.now();
  const tagVecs = await embedder.embed(texts, model.tagPrompt);
  const detVecs = model.detectorPrompt === model.tagPrompt ? tagVecs : await embedder.embed(texts, model.detectorPrompt);
  deps.metrics.observe('embedMs', performance.now() - t0);
  return misses.map((c, k) => {
    const vec = tagVecs[k]!;
    const det = detectorMargin(detVecs[k]!, prototypes);
    // Uncalibrated abuse similarity: aggregate shadow counters only; nothing is held or stored per tag (§5.2 (2)).
    const abuse = abuseShadowLevel(vec, prototypes);
    if (abuse === 'hold') deps.metrics.inc('abuseShadowHold');
    if (abuse === 'reject') deps.metrics.inc('abuseShadowReject');
    const suspected = det.margin >= model.detectorMargin;
    if (suspected) deps.metrics.inc('flagged');
    return {
      exists: false,
      vec,
      sens: {
        suspected,
        margin: det.margin,
        lexiconHit: c.lexicon.hit,
        categoryGuess: c.lexicon.categories[0] ?? (suspected ? det.categoryGuess : null),
        rulesVersion: LEXICON_RULES_VERSION,
      },
      conceptId: null,
      privateConceptId: null,
    };
  });
}

async function assignment(
  deps: PipelineDeps,
  c: Candidate,
  state: TagState,
  partition: 'ordinary' | 'sensitive',
  slot: 'own' | 'private',
): Promise<Assignment> {
  const existing = slot === 'own' ? state.conceptId : state.privateConceptId;
  if (existing) return { kind: 'existing', conceptId: existing };
  const { decision, nearest } = await planAssignment(deps.conceptIndex, partition, state.vec, deps.model.assign);
  const cos = nearest?.cosCentroid ?? 0;
  const fresh = await newConceptId(deps.hmac, c.tagKey, slot === 'private');
  switch (decision.action) {
    case 'merge':
      return { kind: 'merge', conceptId: decision.conceptId, cos };
    case 'newWithLink':
      return {
        kind: 'new',
        conceptId: fresh,
        cos,
        link: { conceptId: decision.linkTo, cos, suggest: decision.suggest, labels: nearest?.labels ?? {} },
      };
    case 'newWithMergeProposal':
      return { kind: 'new', conceptId: fresh, cos, proposeMergeInto: decision.proposeMergeInto };
    case 'new':
      return { kind: 'new', conceptId: fresh, cos };
  }
}
