/**
 * The three Cloud Scheduler jobs (DESIGN.md §4.1, §7 Scheduler, §10.3). Times are Europe/Copenhagen wall-clock
 * times; Cloud Scheduler handles DST. All three are idempotent, so a retry or a late run is safe.
 */
import { DROP_TIME_ZONE } from '@grouper/core';
import { onSchedule, type ScheduleOptions } from 'firebase-functions/scheduler';
import { runBackground } from '../lib/background';
import { notImplemented } from '../lib/errors';
import { BASE_OPTIONS, HEAVY_OPTIONS } from '../lib/options';
import { appDeps, dropsStore, handlerDeps } from '../lib/runtime';
import { orchestrateDrop } from '../pods/orchestrator';
import { sweepPods } from '../pods/sweeper';
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
  // :05 every hour; the next run catches up, so no scheduler retry. Meet-again pair keys and uidH need the HMAC key.
  hourlySweeper: {
    ...BASE_OPTIONS,
    schedule: '5 * * * *',
    timeZone: DROP_TIME_ZONE,
    retryCount: 0,
    timeoutSeconds: 540,
    secrets: [UID_HMAC_KEY],
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
    const deps = appDeps();
    return orchestrateDrop({ ...deps, drops: dropsStore() }, deps.now());
  }),
);

// Every pod timer that is due (§4.1, §4.6; pods/transitions.ts): accept and backfill deadlines, the planning deadline
// with its one extension round, "Still coming?" at T−3 d / T−24 h (with the one "Your pod chat is open"), the T−6 h
// nudge, the T−3 h unconfirmed marking and attendance check, the T−2 h reminder, T+2 h → happened (funnel: first or
// second meetup), the feedback push at 10:00 the next morning and its day-3 reminder, and feedback close (meet-again
// outcomes, no-show majority, the Keep loop). Not yet here: the Monday 10:00 nudge and lifting expired sanctions.
export const hourlySweeper = onSchedule(SCHEDULE_OPTIONS.hourlySweeper, () =>
  runBackground('schedule', 'hourlySweeper', handlerDeps, async () => {
    const deps = appDeps();
    return sweepPods(deps, deps.now());
  }),
);

export const dailyMaintenance = onSchedule(SCHEDULE_OPTIONS.dailyMaintenance, () =>
  runBackground('schedule', 'dailyMaintenance', handlerDeps, async () => {
    // TODO(M1, §6.8): an abandoned sign-up (Auth user, no users doc after 7 days) never reached completeOnboarding,
    // so its sign-up is counted when the reconciliation deletes it: in one batch per page,
    // new FunnelIncrements().stage(null, Date.parse(record.metadata.creationTime), 'signup').write(db, batch).
    throw notImplemented('§10.3');
  }),
);
