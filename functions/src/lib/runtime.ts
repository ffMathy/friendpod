/**
 * Production dependencies, created lazily on first use so importing a module (function discovery, unit tests)
 * initializes nothing. Tests pass their own deps to the inner handlers instead.
 */
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import { PROTOTYPES_OBJECT, prototypeLoader, type PrototypeSource } from '../interests/prototypes';
import type { HandlerDeps } from './handler';
import { log } from './log';
import { sendGenericPush, type PushSender } from './push';
import { UID_HMAC_KEY, hmacFromSecret } from './secrets';
import { gcsObjectStore, type DropObjectStore } from './storage';
import { cloudTasks, type TaskEnqueuer } from './tasks';

export interface AppDeps extends HandlerDeps {
  readonly db: Firestore;
  readonly auth: Auth;
  readonly push: PushSender;
  readonly tasks: TaskEnqueuer;
}

export const handlerDeps: HandlerDeps = {
  now: () => Date.now(),
  uidHmac: () => hmacFromSecret(UID_HMAC_KEY.value()),
  log,
};

function app() {
  return getApps().length > 0 ? getApp() : initializeApp();
}

let cached: AppDeps | undefined;

export function appDeps(): AppDeps {
  cached ??= {
    ...handlerDeps,
    db: getFirestore(app()),
    auth: getAuth(app()),
    push: (kind, recipients, params) => sendGenericPush(getMessaging(app()), kind, recipients, params),
    tasks: cloudTasks(app),
  };
  return cached;
}

/** `gs://grouper-<env>-drops` (§7 Storage): the project id is `grouper-<env>`. */
export function dropsStore(): DropObjectStore {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT is not set');
  return gcsObjectStore(getStorage(app()).bucket(`${projectId}-drops`));
}

/** `gs://grouper-<env>-models` (§7 Storage): the EU mirror of the pinned model files and prototypes.bin (D1). */
function modelsBucket() {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT is not set');
  return getStorage(app()).bucket(`${projectId}-models`);
}

/** The detector prototypes for addInterests, read once per instance; absent until prototypes.bin is uploaded. */
export const modelsPrototypes: PrototypeSource = prototypeLoader({
  read: async () => {
    const file = modelsBucket().file(PROTOTYPES_OBJECT);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [data] = await file.download();
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  },
  now: () => Date.now(),
  onUnavailable: (reason) => log.warn('addInterests.prototypesUnavailable', { reason }),
});
