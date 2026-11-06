import { useSyncExternalStore } from 'react';

/**
 * "3 new" on the pod screen's chat row: when the viewer last had a pod's chat open, kept in memory only. Nothing about
 * a pod is written to the device for this (no pod id survives sign-out or app restart); after a restart the viewer's
 * own latest message stands in for it, since anything written before that has been seen.
 */
const seenAt = new Map<string, number>();
const listeners = new Set<() => void>();

export function markChatSeen(podId: string, latestMs: number): void {
  if ((seenAt.get(podId) ?? 0) >= latestMs) return;
  seenAt.set(podId, latestMs);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The newest message time the viewer has seen in this pod's chat during this app session, or 0. */
export function useChatSeenAt(podId: string): number {
  return useSyncExternalStore(
    subscribe,
    () => seenAt.get(podId) ?? 0,
    () => 0,
  );
}

export interface ChatMessageLike {
  readonly data: { readonly authorUid: string; readonly createdAt: { toMillis(): number } };
}

/** Messages from others newer than both the read marker and the viewer's own latest message. */
export function unreadCount(rows: readonly ChatMessageLike[], uid: string, seen: number): number {
  const ownLatest = rows.reduce((max, r) => (r.data.authorUid === uid ? Math.max(max, r.data.createdAt.toMillis()) : max), 0);
  const since = Math.max(seen, ownLatest);
  return rows.filter((r) => r.data.authorUid !== uid && r.data.createdAt.toMillis() > since).length;
}
