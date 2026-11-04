/** Event functions of codebase "default" (DESIGN.md §9, §10.3). Event retries stay off (the SDK default). */
import { onMessagePublished } from 'firebase-functions/pubsub';
import { onObjectFinalized, type StorageOptions } from 'firebase-functions/storage';
import type { PubSubOptions } from 'firebase-functions/pubsub';
import { runBackground } from '../lib/background';
import { notImplemented } from '../lib/errors';
import { BASE_OPTIONS } from '../lib/options';
import { appDeps, handlerDeps } from '../lib/runtime';
import { BUDGET_TOPIC, handleBudgetAlert } from './budget';

/** Fixed upload names cap pending uploads at one pair per uid (§8 Storage paths, §9 Storage rules). */
const PENDING_UPLOAD = /^uploads\/[^/]+\/pending(?:_256)?\.jpg$/;

export function isPendingUpload(objectName: string): boolean {
  return PENDING_UPLOAD.test(objectName);
}

export const TRIGGER_OPTIONS = {
  // The default bucket (europe-west1); a Storage trigger must run in its bucket's region.
  onPhotoUploaded: { ...BASE_OPTIONS, cpu: 1, memory: '512MiB', timeoutSeconds: 120 },
  onBudgetAlert: { ...BASE_OPTIONS, topic: BUDGET_TOPIC },
} as const satisfies { onPhotoUploaded: StorageOptions; onBudgetAlert: PubSubOptions };

export const onPhotoUploaded = onObjectFinalized(TRIGGER_OPTIONS.onPhotoUploaded, (event) =>
  runBackground('event', 'onPhotoUploaded', handlerDeps, async () => {
    // The trigger fires for every object in the bucket, including the photos and exports written by functions.
    if (!isPendingUpload(event.data.name)) return { skipped: true };
    throw notImplemented('§9');
  }),
);

export const onBudgetAlert = onMessagePublished(TRIGGER_OPTIONS.onBudgetAlert, (event) =>
  runBackground('event', 'onBudgetAlert', handlerDeps, () => {
    let payload: unknown = null;
    try {
      payload = event.data.message.json;
    } catch {
      // Not JSON: not a budget notification, so nothing to trip.
    }
    return handleBudgetAlert(appDeps().db, payload);
  }),
);
