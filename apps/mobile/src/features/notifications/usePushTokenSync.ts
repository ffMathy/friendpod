import { useEffect } from 'react';
import { pushPermissionGranted, registerPushToken, watchPushTokenRefresh } from './push';

/** Re-registers this device's token at app start, only if the user already granted notifications. */
export function usePushTokenSync(): void {
  useEffect(() => {
    let stop: (() => void) | null = null;
    let active = true;
    void pushPermissionGranted().then(async (granted) => {
      if (!granted || !active) return;
      await registerPushToken().catch(() => undefined);
      stop = watchPushTokenRefresh();
    });
    return () => {
      active = false;
      stop?.();
    };
  }, []);
}
