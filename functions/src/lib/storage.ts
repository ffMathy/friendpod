/** Server-only object storage behind a small interface, so task bodies can be tested with fakes. */
import type { getStorage } from 'firebase-admin/storage';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export interface ObjectStore {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array, contentType: string): Promise<void>;
}

export function gcsObjectStore(bucket: Bucket): ObjectStore {
  return {
    async read(path) {
      const [data] = await bucket.file(path).download();
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    },
    async write(path, data, contentType) {
      await bucket.file(path).save(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { contentType, resumable: false });
    },
  };
}
