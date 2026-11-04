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

// TODO(M1, §4.6): every timer in podState.timers that has passed, each idempotent:
// - planDeadline: planningDeadlineOutcome(): 'schedule' locks the plan; 'extend' (once per round, D7) sets
//   planningExtended, pods.planning.extended and planDeadline = planningExtensionDeadline(); 'dissolve' / 'archive'.
//   Backfill only while canBackfill(state, used, planLockedAt set): before the plan first locks, never after (D6);
//   its deadline is backfillDeadline(start, {state: 'planning', planDeadline}).
//   Locking copies planLockedAt onto pods.planning too, so the app derives the same meetupTimers().
// - stillComing3d (null unless the meetup is ≥ 4 days after plan lock) and stillComing24h (never before plan lock):
//   "Still coming?" to every member (D5). At T−24 h also the one generic `chatOpen` push ("Your pod chat is open");
//   the chat itself opens by time alone (sendMessage checks isChatOpen).
// - nudge6h (null when the first ask was not before T−6 h): a second "Still coming?" to membersToNudge() only.
// - attendanceCheck (T−3 h, never before plan lock): markUnconfirmed() into podState and pods.attendance ("<firstName>
//   hasn't confirmed") only when timers.markUnconfirmed, then attendanceCheckPasses(); neither pending nor
//   unconfirmed is coming, and below 3 the existing single reschedule round runs.
//   No answer is never a no-show by itself.
// - feedbackPush (10:00 Europe/Copenhagen the morning after) and feedbackReminder (3 days later), from
//   feedbackTimers(); feedbackCloses stays 7 days (D12).
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
