import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import type { ImageStyle, StyleProp } from 'react-native';
import { storageAuthHeaders, storageObjectUrl } from '@/firebase/storageRest';

/**
 * Photos (§9 Photos): an authenticated REST download (ID token + App Check header), never `getDownloadURL()`, whose
 * token URLs would bypass grant revocation. Cached per `{owner}:{v}`; a new version is a new cache key.
 */
function useStorageHeaders(): Record<string, string> | null {
  const [headers, setHeaders] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    let active = true;
    storageAuthHeaders().then(
      (h) => {
        if (active) setHeaders(h);
      },
      // Signed out or no App Check token yet: no photo, as for a member without one.
      () => undefined,
    );
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
      accessibilityRole="image"
      style={style}
    />
  );
}
