/**
 * Cloud Tasks functions of codebase "default" (DESIGN.md §7 Cloud Tasks, §10.3). Each queue has an explicit
 * retryConfig and rateLimits. Long tasks are enqueued with `dispatchDeadlineSeconds: 1800` and deterministic
 * ids (e.g. `${weekId}-${componentId}`) by their callers.
 */
import {
  backfillPodTask,
  buildExportTask,
  deleteExportTask,
  interestsBatchTask,
  matchComponentTask,
  openAreaTask,
  purgeUserTask,
  releaseDropTask,
} from '@grouper/core';
import { onTaskDispatched, type TaskQueueOptions } from 'firebase-functions/tasks';
import { runTask } from '../lib/background';
import { notImplemented } from '../lib/errors';
import { BASE_OPTIONS, HEAVY_OPTIONS } from '../lib/options';
import { appDeps, dropsStore, handlerDeps } from '../lib/runtime';
import { POD_ID_KEY, UID_HMAC_KEY, hmacFromSecret } from '../lib/secrets';
import { backfillPod as backfillPodImpl } from '../pods/backfill';
import { releaseDrop as releaseDropImpl } from '../pods/release';
import { firestoreComponentStore, runMatchComponentTask } from './matchComponent';
import { openArea as openAreaImpl } from './openArea';

export const TASK_OPTIONS = {
  // "retry 1" (§10.3): one retry after the first attempt. The matcher is deterministic, so a retry only helps
  // with infrastructure failures; an assertion failure is logged and not retried.
  matchComponent: {
    ...BASE_OPTIONS,
    ...HEAVY_OPTIONS,
    retryConfig: { maxAttempts: 2, minBackoffSeconds: 60, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 4, maxDispatchesPerSecond: 1 },
  },
  // Pod ids are computed from the result's member sets (§6.5).
  releaseDrop: {
    ...BASE_OPTIONS,
    ...HEAVY_OPTIONS,
    secrets: [POD_ID_KEY, UID_HMAC_KEY],
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 60, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 1, maxDispatchesPerSecond: 1 },
  },
  backfillPod: {
    ...BASE_OPTIONS,
    timeoutSeconds: 300,
    secrets: [UID_HMAC_KEY],
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 30, maxBackoffSeconds: 300 },
    rateLimits: { maxConcurrentDispatches: 5, maxDispatchesPerSecond: 5 },
  },
  buildExport: {
    ...BASE_OPTIONS,
    cpu: 1,
    memory: '512MiB',
    timeoutSeconds: 540,
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 60, maxBackoffSeconds: 600 },
    rateLimits: { maxConcurrentDispatches: 2, maxDispatchesPerSecond: 1 },
  },
  deleteExport: {
    ...BASE_OPTIONS,
    retryConfig: { maxAttempts: 5, minBackoffSeconds: 300, maxBackoffSeconds: 3600 },
    rateLimits: { maxConcurrentDispatches: 5, maxDispatchesPerSecond: 5 },
  },
  // Re-classification of stored tags from their stored vectors and weekly maintenance (D1, §5.2 (8)): one batch at a
  // time, each continuing from its cursor. Callers enqueue with `dispatchDeadlineSeconds: 1800`.
  interestsBatch: {
    ...BASE_OPTIONS,
    cpu: 1,
    memory: '1GiB',
    timeoutSeconds: 1800,
    secrets: [UID_HMAC_KEY],
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 60, maxBackoffSeconds: 600 },
    rateLimits: { maxConcurrentDispatches: 1, maxDispatchesPerSecond: 1 },
  },
  // "retries 5" (§10.3); erasure must eventually complete, so backoff stretches to an hour.
  purgeUser: {
    ...BASE_OPTIONS,
    cpu: 1,
    memory: '512MiB',
    timeoutSeconds: 1800,
    secrets: [UID_HMAC_KEY],
    retryConfig: { maxAttempts: 6, minBackoffSeconds: 60, maxBackoffSeconds: 3600 },
    rateLimits: { maxConcurrentDispatches: 2, maxDispatchesPerSecond: 1 },
  },
  // Enqueued by the admin CLI after `areas set-status <areaId> live` (task id `open-{areaId}`); idempotent.
  openArea: {
    ...BASE_OPTIONS,
    cpu: 1,
    memory: '512MiB',
    timeoutSeconds: 1800,
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 60, maxBackoffSeconds: 600 },
    rateLimits: { maxConcurrentDispatches: 1, maxDispatchesPerSecond: 1 },
  },
} as const satisfies Record<string, TaskQueueOptions>;

export const matchComponent = onTaskDispatched(TASK_OPTIONS.matchComponent, (req) =>
  runTask('matchComponent', matchComponentTask, req.data, handlerDeps, async (task) => {
    const deps = appDeps();
    const { outcome, fields } = await runMatchComponentTask({ components: firestoreComponentStore(deps.db), drops: dropsStore(), now: deps.now, log: deps.log }, task);
    return { outcome, ...fields };
  }),
);

// Release revalidation, podState and cards with create(), matchProfiles with lastUpdateTime preconditions, the
// firstProposal funnel stage in the same batch (§6.8), staggered generic pushes and snapshot cleanup (pods/release.ts).
export const releaseDrop = onTaskDispatched(TASK_OPTIONS.releaseDrop, (req) =>
  runTask('releaseDrop', releaseDropTask, req.data, handlerDeps, async (task) => {
    const deps = appDeps();
    return releaseDropImpl(
      { ...deps, drops: dropsStore(), podIdHmac: () => hmacFromSecret(POD_ID_KEY.value()), wait: (ms) => new Promise((r) => setTimeout(r, ms)) },
      task.weekId,
    );
  }),
);

// One backfill round before the plan locks (D6); the invitation counts as a first proposal (§6.8).
export const backfillPod = onTaskDispatched(TASK_OPTIONS.backfillPod, (req) =>
  runTask('backfillPod', backfillPodTask, req.data, handlerDeps, async (task) => {
    const { outcome, invited } = await backfillPodImpl(appDeps(), task);
    return { outcome, invited };
  }),
);

// The export lists "about me" (D4) and the user's own meetup-chat messages that still exist (text, pod id, time),
// found through podState.memberList and pods/{podId}/messages where authorUid == uid; never other members' (§3.9).
// Reports about the user include the copy of their reported message (text, date), without the reporter or the report
// text (PRIVACY.md §6). The user's own meet-again answers come from podFeedback; pairSignals adds only the other member's answer, which is
// theirs and never shown (D9).
export const buildExport = onTaskDispatched(TASK_OPTIONS.buildExport, (req) =>
  runTask('buildExport', buildExportTask, req.data, handlerDeps, async () => {
    throw notImplemented('§3.9');
  }),
);

export const deleteExport = onTaskDispatched(TASK_OPTIONS.deleteExport, (req) =>
  runTask('deleteExport', deleteExportTask, req.data, handlerDeps, async () => {
    throw notImplemented('§3.9');
  }),
);

// The erasure steps include the user's meetup-chat messages (authorUid == uid) in every pod in podState.memberList
// (PRIVACY.md §6 step 3) and their rateLimits buckets, whose ids start with `{uid}_` (the per-pod chat and chat-push
// buckets included). Step 3 order: find the pods through memberList, leave memberUids, delete the messages, and
// leave podState.members and memberList last, so that a retry still finds every pod. Reports keep their copy of a
// reported message, with targetH instead of targetUid (step 5). "About me" goes with the users doc. Pair signals
// (D9): delete pairSignals where uidHs array-contains the user's uidH, and remove that uidH from the other member's
// matchProfiles.recentH.
// rescan: re-run decideSensitivity on each stored tag (stored vector, margin from prototypes.bin, lexicon and
// known-ordinary list of this build) and move holdings whose partition changed, leaving `notSensitiveForMe` holdings
// alone; maintenance: concept garbage collection and links. Embedding never happens here (D1).
export const interestsBatch = onTaskDispatched(TASK_OPTIONS.interestsBatch, (req) =>
  runTask('interestsBatch', interestsBatchTask, req.data, handlerDeps, async () => {
    throw notImplemented('§5.2 (8)');
  }),
);

// The match profile goes through eraseMatchProfileAndAreaCount (lib/areas.ts): one transaction deletes it, with its
// funnel milestones, and decrements areas/{areaId}.waitlistCount, so a retry cannot decrement twice.
export const purgeUser = onTaskDispatched(TASK_OPTIONS.purgeUser, (req) =>
  runTask('purgeUser', purgeUserTask, req.data, handlerDeps, async () => {
    // TODO(M1, PRIVACY.md §6): await eraseMatchProfileAndAreaCount(appDeps(), uid) among the erasure steps.
    throw notImplemented('§10.3');
  }),
);

export const openArea = onTaskDispatched(TASK_OPTIONS.openArea, (req) =>
  runTask('openArea', openAreaTask, req.data, handlerDeps, async (task) => {
    const { outcome, marked, pushed } = await openAreaImpl(appDeps(), task.areaId);
    return { outcome, marked, pushed };
  }),
);
