import * as SecureStore from 'expo-secure-store';
import { clearOnboardingFlag } from '@/features/session/onboardingFlag';
import { clearDeviceData } from './clearDeviceData';
import { forgetActivePods } from './useDeviceCacheHygiene';

/**
 * The uid whose data this device may hold. A session can end without the app's own signOut(): the account was
 * deleted on another device, purged after 12 months of inactivity or by an admin, or its refresh token was
 * revoked. The SDK then reports only `null` (often at the next start), so the device data of the uid recorded
 * here is cleared whenever the signed-in uid is no longer it (§9, PRIVACY.md §5 "Device caches").
 */
const LAST_UID = 'session.lastUid';

let ending: Promise<void> | null = null;

/** Clears the device data of the recorded uid; concurrent callers share one run. */
export function endDeviceSession(): Promise<void> {
  ending ??= (async () => {
    const uid = await SecureStore.getItemAsync(LAST_UID);
    await clearDeviceData();
    if (uid !== null) await Promise.all([forgetActivePods(uid), clearOnboardingFlag(uid)]);
    await SecureStore.deleteItemAsync(LAST_UID);
  })().finally(() => {
    ending = null;
  });
  return ending;
}

/** Called for every auth state, before anything is read for `uid`. */
export async function syncDeviceSession(uid: string | null): Promise<void> {
  const last = await SecureStore.getItemAsync(LAST_UID);
  if (last !== null && last !== uid) await endDeviceSession();
  if (uid !== null && last !== uid) await SecureStore.setItemAsync(LAST_UID, uid);
}
