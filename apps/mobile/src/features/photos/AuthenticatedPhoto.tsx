import { getApp } from '@react-native-firebase/app';
import { getToken } from '@react-native-firebase/app-check';
import { getIdToken } from '@react-native-firebase/auth';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Platform, type StyleProp, type ImageStyle } from 'react-native';
import { appCheck, auth, EMULATOR_PORTS } from '@/firebase';
import { emulatorHost, useEmulators } from '@/lib/env';

/**
 * Pod members' photos (§9 Photos): an authenticated REST download (ID token + App Check header),
 * never `getDownloadURL()`, whose token URLs would bypass grant revocation. Cached per `{owner}:{v}`.
 */
function storageObjectUrl(path: string): string {
  const bucket = getApp().options.storageBucket;
  const host = useEmulators
    ? `http://${Platform.OS === 'android' && emulatorHost === 'localhost' ? '10.0.2.2' : emulatorHost}:${EMULATOR_PORTS.storage}`
    : 'https://firebasestorage.googleapis.com';
  return `${host}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

function useStorageHeaders(): Record<string, string> | null {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let active = true;
    const user = auth().currentUser;
    if (!user) return undefined;
    void Promise.all([getIdToken(user), getToken(appCheck())]).then(([idToken, check]) => {
      if (active) setHeaders({ Authorization: `Firebase ${idToken}`, 'X-Firebase-AppCheck': check.token });
    });
    return () => {
      active = false;
    };
  }, []);
  return headers;
}

export interface AuthenticatedPhotoProps {
  readonly owner: string;
  readonly version: number;
  readonly size: 'thumb' | 'full';
  readonly accessibilityLabel: string;
  readonly style?: StyleProp<ImageStyle>;
}

export function AuthenticatedPhoto({ owner, version, size, accessibilityLabel, style }: AuthenticatedPhotoProps) {
  const headers = useStorageHeaders();
  if (!headers) return null;
  const file = size === 'thumb' ? `${version}_256.jpg` : `${version}.jpg`;
  return (
    <Image
      source={{ uri: storageObjectUrl(`photos/${owner}/${file}`), headers, cacheKey: `${owner}:${version}:${size}` }}
      cachePolicy="memory-disk"
      accessibilityLabel={accessibilityLabel}
      style={style}
    />
  );
}
