/**
 * addInterests (DESIGN.md §5.2, §10.1; D1). The app embeds each tag on the device with the pinned EmbeddingGemma 2
 * q4 and sends `{text, vector, detector}`. This callable trusts the vector, an accepted manipulation risk: a client
 * can misplace its own holding, or poison the stored vector of a text nobody has added before. It cannot make a text
 * look less sensitive than the server's own lexicon and, once prototypes.bin is deployed, its own margin say; it can
 * make one look more sensitive. The rest of the pipeline is in interests/. Order: kill switch → per-uid window (and account state) → pipeline. Nothing about the
 * request body is logged, and responses carry statuses only, never a vector.
 */
import { EMBEDDING_MODEL, HOUR_MS, type CallableInput, type CallableOutput } from '@grouper/core';
import type { Timestamp } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { PATHS, docs } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import { rateLimitKey, takeWindow } from '../lib/rateLimits';
import type { AppDeps } from '../lib/runtime';
import { FirestoreConceptIndex, type ConceptIndex } from '../interests/assign';
import { ADD_INTERESTS_BUCKET, ART9_HOLDINGS_ENABLED, LIMITS } from '../interests/config';
import { addInterests as runPipeline } from '../interests/pipeline';
import type { PrototypeSource } from '../interests/prototypes';

type Input = CallableInput<'addInterests'>;
type Output = CallableOutput<'addInterests'>;

export interface InterestsRuntime {
  readonly prototypes: PrototypeSource;
  readonly conceptIndex?: (deps: AppDeps) => ConceptIndex;
  /** Defaults to ART9_HOLDINGS_ENABLED; tests of the sensitive path switch it on. */
  readonly art9Holdings?: boolean;
  /** The kill-switch doc; `config/app` unless a test needs its own (other suites write config/app). */
  readonly configPath?: string;
}

/** Account states that may add interests (PRIVACY.md §6: nothing may recreate a deleting user's subtree). */
const ACCEPTS_INTERESTS: ReadonlySet<string> = new Set(['active', 'paused']);

/** `config/app.features.interests` (§9): a cost brake set by onBudgetAlert. A missing doc or flag means enabled. */
async function interestsEnabled(deps: AppDeps, path: string): Promise<boolean> {
  const snap = await deps.db.doc(path).get();
  return snap.get('features.interests') !== false;
}

/** Charges one call to `rateLimits/{uid}_addInterests`; accounts younger than 24 h get half the allowance. */
async function takeCall(deps: AppDeps, call: CallContext): Promise<void> {
  const refs = docs(deps.db);
  const userRef = deps.db.doc(`users/${call.uid}`);
  const bucketRef = refs.rateLimit(rateLimitKey(call.uid, ADD_INTERESTS_BUCKET));
  const ok = await deps.db.runTransaction(async (tx) => {
    const [user, bucket] = await Promise.all([tx.get(userRef), tx.get(bucketRef)]);
    const createdAt = user.get('createdAt') as Timestamp | undefined;
    if (!user.exists || !createdAt) throw new AppError('NOT_ONBOARDED');
    // Before the window doc, whose id carries the uid, is written.
    if (!ACCEPTS_INTERESTS.has(String(user.get('status')))) throw new AppError('STATE');
    const limit = call.now - createdAt.toMillis() < LIMITS.newAccountMs ? Math.floor(LIMITS.callsPerHour / 2) : LIMITS.callsPerHour;
    const next = takeWindow(bucket.data(), call.now, { limit, windowMs: HOUR_MS });
    if (!next) return false;
    tx.set(bucketRef, next);
    return true;
  });
  if (!ok) throw new AppError('RATE_LIMITED');
}

export function addInterestsWith(rt: InterestsRuntime) {
  return async (deps: AppDeps, call: CallContext, input: Input): Promise<Output> => {
    if (!(await interestsEnabled(deps, rt.configPath ?? PATHS.configApp()))) throw new AppError('FEATURE_DISABLED');
    await takeCall(deps, call);
    const results = await runPipeline(
      {
        db: deps.db,
        conceptIndex: rt.conceptIndex?.(deps) ?? new FirestoreConceptIndex(deps.db, EMBEDDING_MODEL.dim),
        prototypes: rt.prototypes,
        hmac: deps.uidHmac(),
        art9Holdings: rt.art9Holdings ?? ART9_HOLDINGS_ENABLED,
      },
      { uid: call.uid, items: input.items, now: call.now },
    );
    return { results };
  };
}
