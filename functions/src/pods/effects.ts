/**
 * Runs one pod transaction and then its effects (DESIGN.md §4.6): generic pushes (S4) and task enqueues happen only
 * after the commit, so a transaction that Firestore retries never pushes twice. Push failures are logged, never
 * thrown: the state change has committed and the app reads it from Firestore anyway.
 */
import type { AppErrorCode } from '@grouper/core';
import { AppError } from '../lib/errors';
import { docs } from '../lib/firestore';
import { errorFields } from '../lib/log';
import type { PushKind, PushRecipient } from '../lib/push';
import type { AppDeps } from '../lib/runtime';
import { PodTx, type Effects } from './context';

/** Recipients of a pod push: each uid's tokens and locale; accounts being deleted get nothing. */
export async function recipientsFor(deps: AppDeps, uids: readonly string[]): Promise<PushRecipient[]> {
  const refs = docs(deps.db);
  const found = await Promise.all(
    uids.map(async (uid): Promise<PushRecipient | null> => {
      const [tokens, user] = await Promise.all([refs.pushTokens(uid).get(), refs.user(uid).get()]);
      const list = tokens.data()?.tokens.map((t) => t.token) ?? [];
      const u = user.data();
      return list.length > 0 && u && u.status !== 'deleting' ? { locale: u.locale, tokens: list } : null;
    }),
  );
  return found.filter((r) => r !== null);
}

export async function pushTo(deps: AppDeps, kind: PushKind, uids: readonly string[]): Promise<number> {
  try {
    const recipients = await recipientsFor(deps, uids);
    return recipients.length > 0 ? (await deps.push(kind, recipients)).sent : 0;
  } catch (err) {
    deps.log.warn('pod.pushFailed', { kind, ...errorFields(err) });
    return 0;
  }
}

export async function deliver(deps: AppDeps, effects: Effects): Promise<void> {
  for (const t of effects.tasks) {
    try {
      await deps.tasks.enqueue(t.queue, t.data, t.options);
    } catch (err) {
      deps.log.error('pod.enqueueFailed', { queue: t.queue, ...errorFields(err) });
    }
  }
  for (const p of effects.pushes) await pushTo(deps, p.kind, p.uids);
}

/** Concurrent accepts, votes and the sweeper contend on one podState document; let Firestore retry more often. */
const MAX_TX_ATTEMPTS = 12;

/**
 * One podState transaction with `version + 1` on commit. `body` throws an AppError to refuse (nothing is written).
 * A missing pod is `missing`: NOT_FOUND, or NOT_MEMBER for member-only callables, which then reveal nothing about
 * whether a pod id exists.
 */
export async function withPod<T>(deps: AppDeps, podId: string, now: number, body: (ctx: PodTx) => Promise<T>, missing: AppErrorCode = 'NOT_FOUND'): Promise<T> {
  const { result, effects } = await deps.db.runTransaction(async (tx) => {
    const ctx = await PodTx.open(deps, tx, podId, now);
    if (!ctx) throw new AppError(missing);
    const result = await body(ctx);
    return { result, effects: await ctx.commit() };
  }, { maxAttempts: MAX_TX_ATTEMPTS });
  await deliver(deps, effects);
  return result;
}
