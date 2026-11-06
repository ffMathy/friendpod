/**
 * addInterests (DESIGN.md §5.2, §10.1; D1). The app embeds each tag on the device with the pinned EmbeddingGemma 2
 * q4 and sends `{text, vector, detector}`. This callable trusts the vector, an accepted manipulation risk: a client
 * can misplace its own holding, or poison the stored vector and margin of a text nobody has added before. Sensitivity is
 * the on-device model's decision (F38): the server uses the phone's margin and never recomputes it, so a crafted
 * client can make its own holding look less sensitive; a later holder's own phone can still raise it for their
 * holding. The rest of the pipeline is in interests/. Order: kill switch → per-uid window (and account state) → pipeline. Nothing about the
 * request body is logged, and responses carry statuses only, never a vector.
 */
import { EMBEDDING_MODEL, HOUR_MS, type CallableInput, type CallableOutput } from '@grouper/core';
import type { Timestamp } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { DAY_MS, PATHS, docs, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import { rateLimitKey, takeWindow } from '../lib/rateLimits';
import type { AppDeps } from '../lib/runtime';
import { FirestoreConceptIndex, type ConceptIndex } from '../interests/assign';
import { ADD_INTEREST_ITEMS_BUCKET, ADD_INTERESTS_BUCKET, ART9_HOLDINGS_ENABLED, LIMITS } from '../interests/config';
import { addInterests as runPipeline } from '../interests/pipeline';
import { recomputePodInterests } from '../interests/podInterests';

type Input = CallableInput<'addInterests'>;
type Output = CallableOutput<'addInterests'>;

export interface InterestsRuntime {
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
async function takeCall(deps: AppDeps, call: CallContext, items: number): Promise<void> {
  const refs = docs(deps.db);
  const userRef = deps.db.doc(`users/${call.uid}`);
  const bucketRef = refs.rateLimit(rateLimitKey(call.uid, ADD_INTERESTS_BUCKET));
  const itemsRef = refs.rateLimit(rateLimitKey(call.uid, ADD_INTEREST_ITEMS_BUCKET));
  const ok = await deps.db.runTransaction(async (tx) => {
    const [user, bucket, itemBucket] = await Promise.all([tx.get(userRef), tx.get(bucketRef), tx.get(itemsRef)]);
    const createdAt = user.get('createdAt') as Timestamp | undefined;
    if (!user.exists || !createdAt) throw new AppError('NOT_ONBOARDED');
    // Before the window doc, whose id carries the uid, is written.
    if (!ACCEPTS_INTERESTS.has(String(user.get('status')))) throw new AppError('STATE');
    const young = call.now - createdAt.toMillis() < LIMITS.newAccountMs;
    const limit = young ? Math.floor(LIMITS.callsPerHour / 2) : LIMITS.callsPerHour;
    const next = takeWindow(bucket.data(), call.now, { limit, windowMs: HOUR_MS });
    if (!next) return false;
    // 100 items per day (half for new accounts, §4.3): the whole request is refused if it does not fit.
    const itemLimit = young ? Math.floor(LIMITS.itemsPerDay / 2) : LIMITS.itemsPerDay;
    const prev = itemBucket.data();
    const fresh = prev === undefined || call.now - prev.windowStart.toMillis() >= DAY_MS;
    const used = fresh ? 0 : prev.count;
    if (used + items > itemLimit) return false;
    const start = fresh ? call.now : prev.windowStart.toMillis();
    tx.set(bucketRef, next);
    tx.set(itemsRef, { count: used + items, windowStart: ts(start), expiresAt: ts(start + DAY_MS) });
    return true;
  });
  if (!ok) throw new AppError('RATE_LIMITED');
}

export function addInterestsWith(rt: InterestsRuntime) {
  return async (deps: AppDeps, call: CallContext, input: Input): Promise<Output> => {
    if (!(await interestsEnabled(deps, rt.configPath ?? PATHS.configApp()))) throw new AppError('FEATURE_DISABLED');
    await takeCall(deps, call, input.items.length);
    const results = await runPipeline(
      {
        db: deps.db,
        conceptIndex: rt.conceptIndex?.(deps) ?? new FirestoreConceptIndex(deps.db, EMBEDDING_MODEL.dim),
        hmac: deps.uidHmac(),
        art9Holdings: rt.art9Holdings ?? ART9_HOLDINGS_ENABLED,
      },
      { uid: call.uid, items: input.items, now: call.now },
    );
    // A holding that moved partition changes what the user shares with their pods (§10.2): never a private one.
    if (results.some((r) => r.status === 'madePrivate' || r.status === 'madeOrdinary')) await recomputePodInterests(deps, call.uid, call.now);
    return { results };
  };
}
