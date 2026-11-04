/**
 * The three Cloud Scheduler jobs (DESIGN.md §4.1, §7 Scheduler, §10.3). Times are Europe/Copenhagen wall-clock
 * times; Cloud Scheduler handles DST. All three are idempotent, so a retry or a late run is safe.
 */
import { DROP_TIME_ZONE } from '@grouper/core';
import { onSchedule, type ScheduleOptions } from 'firebase-functions/scheduler';
import { runBackground } from '../lib/background';
import { notImplemented } from '../lib/errors';
import { BASE_OPTIONS, HEAVY_OPTIONS } from '../lib/options';
import { handlerDeps } from '../lib/runtime';
import { UID_HMAC_KEY } from '../lib/secrets';

export const SCHEDULE_OPTIONS = {
  // Thu 16:00: freeze inputs, one matchComponent task per component, schedule releaseDrop for 18:00.
  // The snapshot carries uidH for blocks and pair history.
  dropOrchestrator: {
    ...BASE_OPTIONS,
    ...HEAVY_OPTIONS,
    schedule: '0 16 * * 4',
    timeZone: DROP_TIME_ZONE,
    retryCount: 1,
    secrets: [UID_HMAC_KEY],
  },
  // :05 every hour; the next run catches up, so no scheduler retry.
  hourlySweeper: {
    ...BASE_OPTIONS,
    schedule: '5 * * * *',
    timeZone: DROP_TIME_ZONE,
    retryCount: 0,
    timeoutSeconds: 540,
  },
  dailyMaintenance: {
    ...BASE_OPTIONS,
    cpu: 1,
    memory: '512MiB',
    schedule: '17 3 * * *',
    timeZone: DROP_TIME_ZONE,
    retryCount: 1,
    timeoutSeconds: 1800,
    secrets: [UID_HMAC_KEY],
  },
} as const satisfies Record<string, ScheduleOptions>;

export const dropOrchestrator = onSchedule(SCHEDULE_OPTIONS.dropOrchestrator, () =>
  runBackground('schedule', 'dropOrchestrator', handlerDeps, async () => {
    throw notImplemented('§10.3');
  }),
);

// TODO(M1, §4.6): at T−24 h, together with "Still coming?", send the one generic `chatOpen` push ("Your pod chat
// is open") to the current members; the chat itself opens by time alone (sendMessage checks isChatOpen).
export const hourlySweeper = onSchedule(SCHEDULE_OPTIONS.hourlySweeper, () =>
  runBackground('schedule', 'hourlySweeper', handlerDeps, async () => {
    throw notImplemented('§4.6');
  }),
);

export const dailyMaintenance = onSchedule(SCHEDULE_OPTIONS.dailyMaintenance, () =>
  runBackground('schedule', 'dailyMaintenance', handlerDeps, async () => {
    throw notImplemented('§10.3');
  }),
);
