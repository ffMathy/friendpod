import { useCallback, useSyncExternalStore } from 'react';

/** Pods whose "waiting for the others" note (storyboard 2.4) the viewer closed with "Okay" in this app session. */
const closed = new Set<string>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Whether the viewer has closed the waiting note on this pod's card with "Okay", and the function that closes it.
 * Like `useFeedbackSent`, it lasts for the app session: the note is a one-time explanation after accepting, and the
 * card keeps the count of yeses either way.
 */
export function useWaitingNoteClosed(podId: string): readonly [boolean, () => void] {
  const isClosed = useSyncExternalStore(subscribe, () => closed.has(podId));
  const close = useCallback(() => {
    if (closed.has(podId)) return;
    closed.add(podId);
    listeners.forEach((listener) => listener());
  }, [podId]);
  return [isClosed, close] as const;
}
