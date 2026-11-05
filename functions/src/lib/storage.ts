/** Server-only object storage behind a small interface, so task bodies can be tested with fakes. */
import type { getStorage } from 'firebase-admin/storage';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export interface ObjectStore {
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array, contentType: string): Promise<void>;
}

/** The drops bucket also deletes (after release) and creates without overwriting (the frozen input, §6.5). */
export interface DropObjectStore extends ObjectStore {
  /** Writes only if no object exists at `path`; false when one already does. */
  createIfAbsent(path: string, data: Uint8Array, contentType: string): Promise<boolean>;
  /** Deletes the object; a missing object is not an error. */
  delete(path: string): Promise<void>;
}

const PRECONDITION_FAILED = 412;

export function gcsObjectStore(bucket: Bucket): DropObjectStore {
  return {
    async read(path) {
      const [data] = await bucket.file(path).download();
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    },
    async write(path, data, contentType) {
      await bucket.file(path).save(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { contentType, resumable: false });
    },
    async createIfAbsent(path, data, contentType) {
      try {
        await bucket
          .file(path)
          .save(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { contentType, resumable: false, preconditionOpts: { ifGenerationMatch: 0 } });
        return true;
      } catch (err) {
        if ((err as { code?: unknown } | null)?.code === PRECONDITION_FAILED) return false;
        throw err;
      }
    },
    async delete(path) {
      await bucket.file(path).delete({ ignoreNotFound: true });
    },
  };
}
