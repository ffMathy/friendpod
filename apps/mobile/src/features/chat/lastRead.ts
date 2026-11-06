import { DAY_MS, type PodMessageDoc } from '@grouper/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import type { WithId } from '@/data/live';

/**
 * How far the viewer has read each pod's meetup chat, kept on this device only: podId → the `createdAt` (ms, server
 * time) of the newest message the chat screen has shown. It drives the "3 new" badge on the pod page's Chat row
 * (storyboard 3.4). Nothing is sent anywhere. Pod ids are server HMACs; a chat lives from T−24 h until its messages
 * expire at T+72 h, so entries older than two weeks are dropped on every write.
 */
const KEEP_MS = 14 * DAY_MS;
const storeKey = (uid: string) => `chatRead.${uid}`;
const queryKey = (uid: string, podId: string) => ['chatLastRead', uid, podId] as const;

type ReadMap = Record<string, number>;

async function readAll(uid: string): Promise<ReadMap> {
  try {
    const raw = await SecureStore.getItemAsync(storeKey(uid));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed !== null && typeof parsed === 'object' ? (parsed as ReadMap) : {};
  } catch {
    return {};
  }
}

let queue: Promise<unknown> = Promise.resolve();
/** One write at a time, so two pods marked read together do not drop each other's entry. */
function writeLastRead(uid: string, podId: string, readTo: number): Promise<void> {
  const run = queue.then(async () => {
    const all = await readAll(uid);
    if ((all[podId] ?? 0) >= readTo) return;
    const cutoff = Date.now() - KEEP_MS;
    const kept = Object.fromEntries(Object.entries(all).filter(([, ms]) => typeof ms === 'number' && ms > cutoff));
    await SecureStore.setItemAsync(storeKey(uid), JSON.stringify({ ...kept, [podId]: readTo }));
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Drops the whole record at sign-out and account deletion, after any write still queued (PRIVACY.md §5 "Device caches"). */
export function forgetChatRead(uid: string): Promise<void> {
  const run = queue.then(() => SecureStore.deleteItemAsync(storeKey(uid)));
  queue = run.catch(() => undefined);
  return run;
}

/** The newest message time the viewer has seen in the pod's chat: null when none, undefined while it loads. */
export function useChatLastRead(uid: string, podId: string): number | null | undefined {
  const read = useQuery({
    queryKey: queryKey(uid, podId),
    queryFn: async () => (await readAll(uid))[podId] ?? null,
    staleTime: Infinity,
  });
  return read.data;
}

/** Other members' messages after `lastRead`; 0 while it loads, so no badge flashes. */
export function countUnread(messages: readonly WithId<PodMessageDoc>[] | undefined, uid: string, lastRead: number | null | undefined): number {
  if (!messages || lastRead === undefined) return 0;
  return messages.filter((m) => m.data.authorUid !== uid && (lastRead === null || m.data.createdAt.toMillis() > lastRead)).length;
}

/** Marks every message the chat screen shows as read, as they arrive. */
export function useMarkChatRead(uid: string, podId: string, messages: readonly WithId<PodMessageDoc>[] | undefined): void {
  const client = useQueryClient();
  const newest = messages && messages.length > 0 ? Math.max(...messages.map((m) => m.data.createdAt.toMillis())) : null;
  useEffect(() => {
    if (newest === null) return;
    const key = queryKey(uid, podId);
    const apply = () => client.setQueryData<number | null>(key, (old) => (typeof old === 'number' && old >= newest ? old : newest));
    apply();
    // A first read still in flight would otherwise land after this and put the older value back.
    void client.cancelQueries({ queryKey: key }).then(apply);
    writeLastRead(uid, podId, newest).catch(() => undefined);
  }, [client, uid, podId, newest]);
}
