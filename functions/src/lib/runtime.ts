/**
 * Production dependencies, created lazily on first use so importing a module (function discovery, unit tests)
 * initializes nothing. Tests pass their own deps to the inner handlers instead.
 */
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';
import type { HandlerDeps } from './handler';
import { log } from './log';
import { sendGenericPush, type PushSender } from './push';
import { UID_HMAC_KEY, hmacFromSecret } from './secrets';
import { gcsObjectStore, type ObjectStore } from './storage';

export interface AppDeps extends HandlerDeps {
  readonly db: Firestore;
  readonly auth: Auth;
  readonly push: PushSender;
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
    push: (kind, recipients) => sendGenericPush(getMessaging(app()), kind, recipients),
  };
  return cached;
}

/** `gs://grouper-<env>-drops` (§7 Storage): the project id is `grouper-<env>`. */
export function dropsStore(): ObjectStore {
  const projectId = process.env.GCLOUD_PROJECT;
  if (!projectId) throw new Error('GCLOUD_PROJECT is not set');
  return gcsObjectStore(getStorage(app()).bucket(`${projectId}-drops`));
}
