/**
 * The user-content bucket (photos, pending uploads, exports; DESIGN.md §8 Storage paths) behind a small interface, so
 * callables, tasks and the photo trigger can be tested without the Storage emulator. Server-written objects carry no
 * download token: clients read them with an authenticated request under the Storage rules (§9 Photos).
 */
import type { getStorage } from 'firebase-admin/storage';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export interface ObjectInfo {
  readonly name: string;
  /** The object generation, for deletes that must not race a newer upload. */
  readonly generation: string;
}

export interface UserObjectStore {
  /** The object's generation, or null when it does not exist. */
  stat(path: string): Promise<ObjectInfo | null>;
  read(path: string): Promise<Uint8Array>;
  write(path: string, data: Uint8Array, o: { readonly contentType: string; readonly cacheControl: string }): Promise<void>;
  /** Deletes only this generation; false when the object is gone or was replaced (someone else claimed it). */
  deleteGeneration(path: string, generation: string): Promise<boolean>;
  /** Deletes the object; a missing one is not an error. */
  delete(path: string): Promise<void>;
  /** Names of the objects under `prefix` (ends with `/`). */
  list(prefix: string): Promise<string[]>;
}

const NOT_FOUND = 404;
const PRECONDITION_FAILED = 412;

function code(err: unknown): unknown {
  return (err as { code?: unknown } | null)?.code;
}

export function gcsUserObjects(bucket: () => Bucket): UserObjectStore {
  return {
    async stat(path) {
      try {
        const [meta] = await bucket().file(path).getMetadata();
        return { name: path, generation: String(meta.generation) };
      } catch (err) {
        if (code(err) === NOT_FOUND) return null;
        throw err;
      }
    },
    async read(path) {
      const [data] = await bucket().file(path).download();
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    },
    async write(path, data, o) {
      await bucket()
        .file(path)
        .save(Buffer.from(data.buffer, data.byteOffset, data.byteLength), { resumable: false, contentType: o.contentType, metadata: { cacheControl: o.cacheControl } });
    },
    async deleteGeneration(path, generation) {
      try {
        await bucket().file(path).delete({ ifGenerationMatch: generation });
        return true;
      } catch (err) {
        if (code(err) === NOT_FOUND || code(err) === PRECONDITION_FAILED) return false;
        throw err;
      }
    },
    async delete(path) {
      await bucket().file(path).delete({ ignoreNotFound: true });
    },
    async list(prefix) {
      const [files] = await bucket().getFiles({ prefix });
      return files.map((f) => f.name);
    },
  };
}

/** Paths of the user-content bucket (§8 Storage paths). */
export const OBJECT_PATHS = {
  uploadsPrefix: (uid: string) => `uploads/${uid}/`,
  pendingUpload: (uid: string) => `uploads/${uid}/pending.jpg`,
  pendingThumb: (uid: string) => `uploads/${uid}/pending_256.jpg`,
  photosPrefix: (uid: string) => `photos/${uid}/`,
  photo: (uid: string, v: number) => `photos/${uid}/${v}.jpg`,
  photoThumb: (uid: string, v: number) => `photos/${uid}/${v}_256.jpg`,
  exportsPrefix: (uid: string) => `exports/${uid}/`,
  export: (uid: string, exportId: string) => `exports/${uid}/${exportId}.json`,
} as const;

/** Deletes every object under `prefix`. */
export async function deletePrefix(store: UserObjectStore, prefix: string): Promise<number> {
  const names = await store.list(prefix);
  for (const n of names) await store.delete(n);
  return names.length;
}
