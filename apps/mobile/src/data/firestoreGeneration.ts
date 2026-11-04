import { useSyncExternalStore } from 'react';

/**
 * Bumped after the Firestore instance was terminated and its cache cleared: every live listener (useLive)
 * depends on it and subscribes again on the new instance.
 */
let generation = 0;
const listeners = new Set<() => void>();

export function bumpFirestoreGeneration(): void {
  generation += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFirestoreGeneration(): number {
  return useSyncExternalStore(subscribe, () => generation);
}
