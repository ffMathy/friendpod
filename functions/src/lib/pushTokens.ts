/**
 * `pushTokens/{uid}` (DESIGN.md §8.2): the user's device tokens, upserted by registerPushToken. Tokens not refreshed
 * for 60 days are stale [A]: never pushed to, and dropped at the next write; tokens FCM reports as gone are dropped
 * after each push. The doc goes with the account (purgeUser).
 */
import type { Platform } from '@grouper/core';
import { DAY_MS, docs, ts } from './firestore';
import type { AppDeps } from './runtime';

export const PUSH_TOKEN_STALE_MS = 60 * DAY_MS;
/** One user rarely has more than a couple of devices; the oldest tokens go first beyond this. */
export const MAX_TOKENS_PER_USER = 10;

/** Adds or refreshes `token` and prunes stale ones, in one transaction. */
export async function upsertToken(deps: Pick<AppDeps, 'db'>, uid: string, token: string, platform: Platform, now: number): Promise<void> {
  const ref = docs(deps.db).pushTokens(uid);
  await deps.db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data()?.tokens ?? [];
    const kept = current.filter((t) => t.token !== token && t.updatedAt.toMillis() >= now - PUSH_TOKEN_STALE_MS);
    const tokens = [...kept, { token, platform, updatedAt: ts(now) }].sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()).slice(0, MAX_TOKENS_PER_USER);
    tx.set(ref, { tokens });
  });
}

/** Drops tokens FCM reported as unregistered from these users' docs. */
export async function pruneTokens(deps: Pick<AppDeps, 'db'>, uids: readonly string[], stale: readonly string[]): Promise<void> {
  const gone = new Set(stale);
  const refs = docs(deps.db);
  for (const uid of uids) {
    const ref = refs.pushTokens(uid);
    await deps.db.runTransaction(async (tx) => {
      const doc = (await tx.get(ref)).data();
      if (!doc || !doc.tokens.some((t) => gone.has(t.token))) return;
      const tokens = doc.tokens.filter((t) => !gone.has(t.token));
      if (tokens.length === 0) tx.delete(ref);
      else tx.set(ref, { tokens });
    });
  }
}
