import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { usePodCards } from '@/data/docs';
import { queryClient } from '@/data/queryClient';
import { clearFirestoreCache, clearImageCaches } from './clearDeviceData';

const ACTIVE_STATES = new Set(['proposed', 'planning', 'scheduled', 'happened']);
const key = (uid: string) => `activePods.${uid}`;

/**
 * When a pod leaves the active list (left, dissolved, archived, a block, or a theme withdrawal that deleted
 * its card), including changes that happened while the app was closed, clears the photo caches and the cached
 * pod docs: the roster (co-members' first names and uids), theme and options (§9 Photos "Device caches",
 * PRIVACY.md §3.5 step 8). Pod ids are server HMACs, so storing them reveals nothing new.
 */
export function useDeviceCacheHygiene(uid: string): void {
  const cards = usePodCards(uid);
  useEffect(() => {
    if (!cards.data) return;
    const active = cards.data
      .filter((c) => ACTIVE_STATES.has(c.data.state) && c.data.myStatus !== 'left' && c.data.myStatus !== 'declined')
      .map((c) => c.id);
    void (async () => {
      const previous: string[] = JSON.parse((await SecureStore.getItemAsync(key(uid))) ?? '[]');
      const current = new Set(active);
      const gone = previous.filter((id) => !current.has(id));
      if (gone.length > 0) await forgetPods(gone);
      await SecureStore.setItemAsync(key(uid), JSON.stringify(active));
    })();
  }, [cards.data, uid]);
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

export async function forgetActivePods(uid: string): Promise<void> {
  await SecureStore.deleteItemAsync(key(uid));
}
