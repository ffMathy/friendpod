/**
 * Preview fake of @react-native-firebase/storage. Uploads succeed without sending anything; download URLs are the
 * placeholder avatars the network layer serves for photos (runtime/network.ts).
 */
import { avatarSvg } from '../runtime/network';

export interface Storage {
  readonly bucket: string;
}

export interface Reference {
  readonly fullPath: string;
  readonly name: string;
  readonly bucket: string;
}

const STORAGE: Storage = { bucket: 'demo-grouper.appspot.com' };

export const getStorage = (_app?: unknown): Storage => STORAGE;
export const connectStorageEmulator = (): void => undefined;

export function ref(_storage: Storage, path = ''): Reference {
  return { fullPath: path, name: path.split('/').pop() ?? '', bucket: STORAGE.bucket };
}

function task(reference: Reference) {
  const snapshot = { ref: reference, state: 'success', bytesTransferred: 1, totalBytes: 1, metadata: { fullPath: reference.fullPath } };
  const done = new Promise<typeof snapshot>((resolve) => setTimeout(() => resolve(snapshot), 300));
  return Object.assign(done, {
    on: (_event: string, next?: (s: typeof snapshot) => void) => {
      void done.then((s) => next?.(s));
      return () => undefined;
    },
    cancel: () => false,
    pause: () => false,
    resume: () => false,
    snapshot,
  });
}

export const putFile = (reference: Reference, _uri: string, _metadata?: unknown) => task(reference);
export const uploadBytes = async (reference: Reference) => task(reference);
export const putString = (reference: Reference) => task(reference);
export const deleteObject = async (_reference: Reference): Promise<void> => undefined;

export async function getDownloadURL(reference: Reference): Promise<string> {
  const owner = /^photos\/([^/]+)\//.exec(reference.fullPath)?.[1] ?? 'unknown';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSvg(owner))}`;
}

export default () => STORAGE;
