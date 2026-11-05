/**
 * `pushTokens/{uid}` (DESIGN.md §8.2): the user's device tokens, upserted by registerPushToken. Tokens not refreshed
 * for 60 days are stale [A]: never pushed to, and dropped at the next write; tokens FCM reports as gone are dropped
 * after each push. A token belongs to one account only, the one that registered it last: a device that signs in to
 * another account moves its token there (`tokenHs`, SHA-256 of each token, finds it). The doc goes with the account
 * (purgeUser).
 */
import { createHash } from 'node:crypto';
import type { Platform } from '@grouper/core';
import { DAY_MS, docs, ts, type DocOf } from './firestore';
import type { AppDeps } from './runtime';

export const PUSH_TOKEN_STALE_MS = 60 * DAY_MS;
/** One user rarely has more than a couple of devices; the oldest tokens go first beyond this. */
export const MAX_TOKENS_PER_USER = 10;

export const tokenH = (token: string): string => createHash('sha256').update(token).digest('hex');

type Tokens = DocOf<'pushTokens'>['tokens'];
const withHashes = (tokens: Tokens) => ({ tokens, tokenHs: tokens.map((t) => tokenH(t.token)) });

/** Adds or refreshes `token` for `uid`, removes it from every other account and prunes stale ones, in one transaction. */
export async function upsertToken(deps: Pick<AppDeps, 'db'>, uid: string, token: string, platform: Platform, now: number): Promise<void> {
  const refs = docs(deps.db);
  const ref = refs.pushTokens(uid);
  const h = tokenH(token);
  await deps.db.runTransaction(async (tx) => {
    const [own, holders] = await Promise.all([tx.get(ref), tx.get(deps.db.collection('pushTokens').where('tokenHs', 'array-contains', h))]);
    for (const other of holders.docs) {
      if (other.id === uid) continue;
      const rest = ((other.get('tokens') as Tokens | undefined) ?? []).filter((t) => t.token !== token);
      if (rest.length === 0) tx.delete(other.ref);
      else tx.set(refs.pushTokens(other.id), withHashes(rest));
    }
    const current = own.data()?.tokens ?? [];
    const kept = current.filter((t) => t.token !== token && t.updatedAt.toMillis() >= now - PUSH_TOKEN_STALE_MS);
    const tokens = [...kept, { token, platform, updatedAt: ts(now) }].sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis()).slice(0, MAX_TOKENS_PER_USER);
    tx.set(ref, withHashes(tokens));
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
      else tx.set(ref, withHashes(tokens));
    });
  }
}

export interface FreshToken {
  readonly token: string;
  readonly updatedAtMs: number;
}

/** The tokens a push may use at `now`: refreshed within 60 days. */
export function freshTokens(doc: { readonly tokens: readonly { token: string; updatedAt: { toMillis(): number } }[] } | undefined, now: number): FreshToken[] {
  return (doc?.tokens ?? []).map((t) => ({ token: t.token, updatedAtMs: t.updatedAt.toMillis() })).filter((t) => t.updatedAtMs >= now - PUSH_TOKEN_STALE_MS);
}

/**
 * One device, one account: a token listed under several uids (docs written before `tokenHs`) goes only to the uid
 * that refreshed it last. Returns, per uid, the tokens it keeps.
 */
export function dedupeTokens(byUid: ReadonlyMap<string, readonly FreshToken[]>): Map<string, string[]> {
  const owner = new Map<string, { uid: string; at: number }>();
  for (const [uid, list] of byUid) {
    for (const t of list) {
      const o = owner.get(t.token);
      if (!o || t.updatedAtMs > o.at || (t.updatedAtMs === o.at && uid > o.uid)) owner.set(t.token, { uid, at: t.updatedAtMs });
    }
  }
  const out = new Map<string, string[]>();
  for (const [uid, list] of byUid) out.set(uid, [...new Set(list.filter((t) => owner.get(t.token)?.uid === uid).map((t) => t.token))]);
  return out;
}
