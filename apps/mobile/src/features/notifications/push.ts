import {
  AuthorizationStatus,
  deleteToken,
  getToken,
  hasPermission,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { messaging } from '@/firebase';
import { callFunction } from '@/firebase/callables';

/**
 * FCM direct, generic payloads only (A14, S4). FCM auto-init is off (firebase.json), so no token or
 * installation ID exists until the user grants the permission here.
 */
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
  const status = await requestPermission(messaging(), { alert: true, badge: true, sound: true });
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

export async function pushPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return Platform.Version < 33 || PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  const status = await hasPermission(messaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

export async function registerPushToken(): Promise<void> {
  const m = messaging();
  if (Platform.OS === 'ios') await registerDeviceForRemoteMessages(m);
  const token = await getToken(m);
  await callFunction('registerPushToken', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
}

/** Keeps the server's copy current while the app runs (only after the user opted in). */
export function watchPushTokenRefresh(): () => void {
  return onTokenRefresh(messaging(), (token) => {
    void callFunction('registerPushToken', { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' }).catch(() => undefined);
  });
}

/** Turning notifications off in Settings drops this device's FCM token. */
export async function unregisterPush(): Promise<void> {
  await deleteToken(messaging());
}
