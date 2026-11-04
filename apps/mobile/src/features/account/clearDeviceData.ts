import { clearPersistence, terminate } from '@react-native-firebase/firestore';
import { Image } from 'expo-image';
import { bumpFirestoreGeneration } from '@/data/firestoreGeneration';
import { queryClient } from '@/data/queryClient';
import { db } from '@/firebase';

/**
 * Removes what the device caches about the account (§9 Photos, PRIVACY.md §5 "Device caches"):
 * Firestore's offline cache (sensitive interests, pod docs), expo-image memory and disk caches,
 * and the in-memory query cache.
 */
export async function clearDeviceData(): Promise<void> {
  await clearFirestoreCache();
  await clearImageCaches();
  queryClient.clear();
}

/**
 * Firestore's persistent cache. RNFirebase cannot evict single documents, and a document the user may no longer
 * read (a pod they were removed from) stays in the cache after its listener fails with permission-denied.
 * Live listeners re-subscribe on the new instance.
 */
export async function clearFirestoreCache(): Promise<void> {
  const firestore = db();
  await terminate(firestore);
  await clearPersistence(firestore);
  bumpFirestoreGeneration();
}

/** Photos only: at the first open after a pod left the active list (left, dissolved, archived, block). */
export async function clearImageCaches(): Promise<void> {
  await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
}
