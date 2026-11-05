import type { App } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { gcsUserObjects, type UserObjectStore } from '../lib/objects';

/** The user bucket for a replay, or (by default) a store that holds nothing: Storage is not restored with Firestore. */
export function deletePhotoObjects(app: App, storage: boolean): UserObjectStore {
  if (storage) return gcsUserObjects(() => getStorage(app).bucket());
  return {
    stat: async () => null,
    read: async () => {
      throw new Error('replay: no objects');
    },
    write: async () => undefined,
    deleteGeneration: async () => false,
    delete: async () => undefined,
    list: async () => [],
  };
}
