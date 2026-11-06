import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { usePodCards } from '@/data/docs';
import { queryClient } from '@/data/queryClient';
import { forgetChatRead } from '@/features/chat/lastRead';
import { clearFirestoreCache, clearImageCaches } from './clearDeviceData';

const ACTIVE_STATES = new Set(['proposed', 'planning', 'scheduled', 'happened']);
const key = (uid: string) => `activePods.${uid}`;
/** podId → the latest meetup-chat `expiresAt` (ms) this device has cached for that pod. */
const chatKey = (uid: string) => `chatCaches.${uid}`;
type ChatCaches = Record<string, number>;

let queue: Promise<unknown> = Promise.resolve();
/** The chat screen and the hygiene run both rewrite `chatKey`; one at a time, so neither loses the other's entry. */
function serially<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readChatCaches(uid: string): Promise<ChatCaches> {
  return JSON.parse((await SecureStore.getItemAsync(chatKey(uid))) ?? '{}') as ChatCaches;
}

/**
 * When a pod leaves the active list (left, dissolved, archived, a block, or a theme withdrawal that deleted
 * its card), including changes that happened while the app was closed, clears the photo caches and the cached
 * pod docs: the roster (co-members' first names and uids), theme, options and chat messages (§9 Photos
 * "Device caches", PRIVACY.md §3.5 step 8). Pod ids are server HMACs, so storing them reveals nothing new.
 */
export function useDeviceCacheHygiene(uid: string): void {
  const cards = usePodCards(uid);
  useEffect(() => {
    if (!cards.data) return;
    const active = cards.data
      .filter((c) => ACTIVE_STATES.has(c.data.state) && c.data.myStatus !== 'left' && c.data.myStatus !== 'declined')
      .map((c) => c.id);
    void syncDeviceCaches(uid, active, Date.now());
  }, [cards.data, uid]);
}

/**
 * One hygiene run. Besides pods that left the active list, it clears the Firestore cache once the cached chat
 * messages of a still-active pod have expired: a Keep-loop pod stays active for weeks, and the cache keeps copies
 * that TTL, erasure or a withdrawal deleted on the server while no listener was attached (PRIVACY.md §5).
 */
export function syncDeviceCaches(uid: string, active: readonly string[], now: number): Promise<void> {
  return serially(async () => {
    const previous: string[] = JSON.parse((await SecureStore.getItemAsync(key(uid))) ?? '[]');
    const current = new Set(active);
    const gone = previous.filter((id) => !current.has(id));
    const chats = await readChatCaches(uid);
    const expired = Object.keys(chats).filter((id) => chats[id]! <= now);
    if (gone.length > 0) await forgetPods(gone);
    else if (expired.length > 0) await clearFirestoreCache();
    // Either clear removed every pod's cached messages, so none of the entries is needed any more.
    if (gone.length > 0 || expired.length > 0) await SecureStore.deleteItemAsync(chatKey(uid));
    await SecureStore.setItemAsync(key(uid), JSON.stringify(active));
  });
}

/** Called whenever the device has read a pod's chat messages; the next hygiene run after `expiresAtMs` clears them. */
export function rememberCachedMessages(uid: string, podId: string, expiresAtMs: number): Promise<void> {
  return serially(async () => {
    const chats = await readChatCaches(uid);
    if ((chats[podId] ?? 0) >= expiresAtMs) return;
    await SecureStore.setItemAsync(chatKey(uid), JSON.stringify({ ...chats, [podId]: expiresAtMs }));
  });
}

export async function forgetPods(podIds: readonly string[]): Promise<void> {
  await clearImageCaches();
  // Firestore does not evict a document whose listener now fails with permission-denied.
  await clearFirestoreCache();
  const paths = podIds.map((id) => `pods/${id}`);
  queryClient.removeQueries({
    predicate: (q) => {
      const path = q.queryKey[1];
      return typeof path === 'string' && paths.some((p) => path === p || path.startsWith(`${p}/`));
    },
  });
}

/** Sign-out and account deletion: the pod list, the chat-cache record and how far each pod's chat was read. */
export async function forgetActivePods(uid: string): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(key(uid)), SecureStore.deleteItemAsync(chatKey(uid)), forgetChatRead(uid)]);
}
