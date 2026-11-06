import { getInitialNotification, onNotificationOpenedApp, type RemoteMessage } from '@react-native-firebase/messaging';
import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { usePodCards } from '@/data/docs';
import { messaging } from '@/firebase';
import { isPushKind, openPushRoute, routeForPush, type PushKind } from './routing';

/** The notification that started the app is delivered once per process, not on every remount. */
let initialChecked = false;

function kindOf(message: RemoteMessage | null): PushKind | null {
  const kind = message?.data?.kind;
  return isPushKind(kind) ? kind : null;
}

/**
 * Opens the right screen when the user taps a push, from the background or from a cold start (mounted once the
 * session is `ready`, so a tap during sign-in or onboarding waits until then). The route waits for the pod cards. A pod
 * page opens in the Pods tab, the chat and the notices over the tabs (`openPushRoute`).
 */
export function useNotificationRouting(uid: string): void {
  const router = useRouter();
  const segments = useSegments();
  const cards = usePodCards(uid);
  const [pending, setPending] = useState<PushKind | null>(null);

  useEffect(() => {
    const m = messaging();
    const stop = onNotificationOpenedApp(m, (message) => {
      const kind = kindOf(message);
      if (kind) setPending(kind);
    });
    if (!initialChecked) {
      initialChecked = true;
      getInitialNotification(m).then(
        (message) => {
          const kind = kindOf(message);
          if (kind) setPending(kind);
        },
        () => undefined,
      );
    }
    return stop;
  }, []);

  useEffect(() => {
    if (!pending || !cards.data) return;
    setPending(null);
    openPushRoute(router, routeForPush(pending, cards.data), segments);
  }, [pending, cards.data, router, segments]);
}

/** Tests only: lets a test start from a fresh process. */
export function resetInitialNotificationForTests(): void {
  initialChecked = false;
}
