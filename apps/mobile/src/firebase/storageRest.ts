/**
 * Authenticated Storage downloads over REST (§9 Photos, §3.9): the ID token and an App Check token as headers, never
 * `getDownloadURL()`, whose bearer-token URLs would outlive grant revocation and work for anyone holding the link.
 * Used for pod members' photos and for the data export.
 */
import { getApp } from '@react-native-firebase/app';
import { getToken } from '@react-native-firebase/app-check';
import { getIdToken } from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { emulatorHost, useEmulators } from '@/lib/env';
import { appCheck, auth, EMULATOR_PORTS } from './index';

/** `GET …/o/<path>?alt=media` on the default bucket, or on the Storage emulator in emulator builds. */
export function storageObjectUrl(path: string): string {
  const bucket = getApp().options.storageBucket;
  const host = useEmulators
    ? `http://${Platform.OS === 'android' && emulatorHost === 'localhost' ? '10.0.2.2' : emulatorHost}:${EMULATOR_PORTS.storage}`
    : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/** Headers for one authenticated download; throws when signed out. */
export async function storageAuthHeaders(): Promise<Record<string, string>> {
  const user = auth().currentUser;
  if (!user) throw new Error('not signed in');
  const [idToken, check] = await Promise.all([getIdToken(user), getToken(appCheck())]);
  return { Authorization: `Firebase ${idToken}`, 'X-Firebase-AppCheck': check.token };
}
