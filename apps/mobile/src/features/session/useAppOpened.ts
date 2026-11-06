import { useEffect } from 'react';
import { AppState } from 'react-native';
import { callFunction } from '@/firebase/callables';

/** The server records activity at most once a day; this only spares calls when the app is switched to and fro. */
export const APP_OPENED_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Tells the server the app was opened (DESIGN.md §8.1), at start and whenever it returns to the foreground, so the
 * 12-month inactivity deletion only reaches people who really stopped using it, notifications on or off. Mounted
 * only for an onboarded user (ProfileEffects). A failed call is retried at the next foreground.
 */
export function useAppOpened(now: () => number = Date.now): void {
  useEffect(() => {
    let last = -Infinity;
    const ping = () => {
      const t = now();
      if (t - last < APP_OPENED_MIN_INTERVAL_MS) return;
      last = t;
      void callFunction('appOpened', {}).catch(() => {
        last = -Infinity;
      });
    };
    ping();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') ping();
    });
    return () => sub.remove();
  }, [now]);
}
