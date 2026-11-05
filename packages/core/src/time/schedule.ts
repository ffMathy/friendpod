import type { SetParticipationMode } from '../types/domain';
import type { WeekId } from '../types/ids';
import { addWeeks, dateInWeek, weekIdAt } from './weekId';
import { DROP_TIME_ZONE, fromLocal, toLocal } from './zone';

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Absolute timestamps (epoch ms) of one week's drop (§4.1), DST-correct for Europe/Copenhagen. */
export interface DropSchedule {
  readonly weekId: WeekId;
  /** Mon 10:00: "In this week?" nudge for manual-participation users. */
  readonly nudgeAt: number;
  /** Thu 12:00: opt-in cutoff for this week's drop. */
  readonly optInCutoffAt: number;
  /** Thu 16:00: freeze inputs and compute. */
  readonly computeAt: number;
  /** Thu 18:00: release. */
  readonly releaseAt: number;
  /** Sat 18:00: accept deadline (release + 48 h). */
  readonly acceptBy: number;
  /** Sun 18:00: latest possible backfill deadline. */
  readonly backfillLatest: number;
}

function at(weekId: WeekId, isoDay: number, hour: number, timeZone: string): number {
  const d = dateInWeek(weekId, isoDay);
  return fromLocal({ year: d.year, month: d.month, day: d.day, hour, minute: 0 }, timeZone);
}

export function dropSchedule(weekId: WeekId, timeZone: string = DROP_TIME_ZONE): DropSchedule {
  return {
    weekId,
    nudgeAt: at(weekId, 1, 10, timeZone),
    optInCutoffAt: at(weekId, 4, 12, timeZone),
    computeAt: at(weekId, 4, 16, timeZone),
    releaseAt: at(weekId, 4, 18, timeZone),
    acceptBy: at(weekId, 6, 18, timeZone),
    backfillLatest: at(weekId, 7, 18, timeZone),
  };
}

/** Where a backfill starts (D6): a `proposed` pod of drop week `weekId`, or a `planning` pod with its deadline. */
export type BackfillRound = { readonly state: 'proposed'; readonly weekId: WeekId } | { readonly state: 'planning'; readonly planDeadline: number };

/** Backfill deadline (§4.1, §4.2): min(start + 24 h, Sun 18:00) while `proposed`; min(start + 24 h, planning deadline) in `planning`. */
export function backfillDeadline(startedAt: number, round: BackfillRound, timeZone: string = DROP_TIME_ZONE): number {
  const cap = round.state === 'proposed' ? dropSchedule(round.weekId, timeZone).backfillLatest : round.planDeadline;
  return Math.min(startedAt + DAY_MS, cap);
}

/** Decision time for a proposed pod: the later of `acceptBy` and its backfill deadline, if any (§4.6). */
export function proposalDecisionAt(acceptBy: number, backfillUntil: number | null): number {
  return backfillUntil === null ? acceptBy : Math.max(acceptBy, backfillUntil);
}

export type PlanningRound = 'confirmation' | 'keep' | 'reschedule' | 'replan';

/** Planning deadline: entry + 72 h, or + 48 h for a reschedule or re-plan round (§4.6). */
export function planningDeadline(enteredAt: number, round: PlanningRound): number {
  return enteredAt + (round === 'reschedule' || round === 'replan' ? 48 : 72) * HOUR_MS;
}

/** The one planning extension when the deadline passes without a winner (D7). */
export const PLANNING_EXTENSION_MS = 24 * HOUR_MS;

/** Deadline of the "No time works yet — add another option" round: the passed deadline + 24 h. */
export function planningExtensionDeadline(passedDeadline: number): number {
  return passedDeadline + PLANNING_EXTENSION_MS;
}

/** "Still coming?" at T−3 days only when the meetup is at least this long after plan lock (D5). */
export const STILL_COMING_3D_MIN_LEAD_MS = 4 * DAY_MS;

export interface MeetupTimers {
  /** T−3 days "Still coming?"; null when the meetup is less than 4 days after plan lock. */
  readonly stillComing3d: number | null;
  /** T−24 h "Still coming?" to every member, or at plan lock when that is later; the chat opens at T−24 h regardless. */
  readonly stillComing24h: number;
  /** T−6 h second nudge to members who have not answered; null when the first ask was not before T−6 h. */
  readonly nudge6h: number | null;
  /** T−3 h (or plan lock, if later): the attendance check (fewer than 3 coming → reschedule round). */
  readonly attendanceCheck: number;
  /**
   * Whether the check marks members who never answered as 'unconfirmed'. Only after an ask and the nudge (D5): with a
   * short lead they stay 'pending', which is not counted as coming either but is not shown as "hasn't confirmed".
   */
  readonly markUnconfirmed: boolean;
  readonly reminder: number;
  /** T+2 h → `happened`. */
  readonly happened: number;
}

/**
 * Timers around a meetup (§4.1, D5), as absolute offsets like the chat window. `planLockedAt` is when the pod
 * entered `scheduled`. Nothing is due before the plan locks: an option can start a few hours after the planning
 * deadline, so each pre-meetup timer is clamped to `planLockedAt`.
 */
export function meetupTimers(meetupAt: number, planLockedAt: number): MeetupTimers {
  const notBeforeLock = (t: number) => Math.max(t, planLockedAt);
  const stillComing24h = notBeforeLock(meetupAt - 24 * HOUR_MS);
  const nudge6h = meetupAt - 6 * HOUR_MS;
  const hasNudge = stillComing24h < nudge6h;
  return {
    stillComing3d: meetupAt - planLockedAt >= STILL_COMING_3D_MIN_LEAD_MS ? meetupAt - 3 * DAY_MS : null,
    stillComing24h,
    nudge6h: hasNudge ? nudge6h : null,
    attendanceCheck: notBeforeLock(meetupAt - 3 * HOUR_MS),
    markUnconfirmed: hasNudge,
    reminder: notBeforeLock(meetupAt - 2 * HOUR_MS),
    happened: meetupAt + 2 * HOUR_MS,
  };
}

/** When "Still coming?" is first asked: T−3 d when the meetup was planned far enough ahead, else T−24 h (D5). */
export function firstAttendanceAsk(t: MeetupTimers): number {
  return t.stillComing3d ?? t.stillComing24h;
}

/** The feedback push goes out at this local hour on the morning after the meetup (D12). */
export const FEEDBACK_PUSH_LOCAL_HOUR = 10;
export const FEEDBACK_REMINDER_AFTER_DAYS = 3;

export interface FeedbackTimers {
  /** 10:00 local on the calendar day after the meetup. */
  readonly push: number;
  /** One reminder 3 calendar days later, again at 10:00 local (so 71, 72 or 73 h later across DST). */
  readonly reminder: number;
}

function localDayPlus(instantMs: number, days: number, hour: number, timeZone: string): number {
  const l = toLocal(instantMs, timeZone);
  const d = new Date(Date.UTC(l.year, l.month - 1, l.day + days));
  return fromLocal({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute: 0 }, timeZone);
}

/** Feedback push and its one reminder (D12); the feedback window itself stays 7 days (`feedbackClosesAt`). */
export function feedbackTimers(meetupAt: number, timeZone: string = DROP_TIME_ZONE): FeedbackTimers {
  const push = localDayPlus(meetupAt, 1, FEEDBACK_PUSH_LOCAL_HOUR, timeZone);
  return { push, reminder: localDayPlus(push, FEEDBACK_REMINDER_AFTER_DAYS, FEEDBACK_PUSH_LOCAL_HOUR, timeZone) };
}

export const CHAT_OPENS_BEFORE_MS = 24 * HOUR_MS;
export const CHAT_CLOSES_AFTER_MS = 24 * HOUR_MS;
export const CHAT_DELETE_AFTER_MS = 72 * HOUR_MS;

export interface ChatWindow {
  readonly opensAt: Date;
  readonly closesAt: Date;
  /** Every message's `expiresAt`; the TTL policy deletes it up to about a day later. */
  readonly deleteAt: Date;
}

/**
 * The meetup chat around `meetupAt`: opens at T−24 h together with the T−24 h "Still coming?" and closes at T+24 h.
 * Like the other meetup timers these are absolute offsets, so across a DST change the wall-clock gap is 23 or 25 h.
 */
export function chatWindow(meetupAt: Date): ChatWindow {
  const t = meetupAt.getTime();
  return {
    opensAt: new Date(t - CHAT_OPENS_BEFORE_MS),
    closesAt: new Date(t + CHAT_CLOSES_AFTER_MS),
    deleteAt: new Date(t + CHAT_DELETE_AFTER_MS),
  };
}

/** `opensAt <= now < closesAt`. An invalid date is never open. */
export function isChatOpen(meetupAt: Date, now: Date): boolean {
  const { opensAt, closesAt } = chatWindow(meetupAt);
  const n = now.getTime();
  return opensAt.getTime() <= n && n < closesAt.getTime();
}

/** Feedback closes 7 days after `happened` (§4.6). */
export function feedbackClosesAt(happenedAt: number): number {
  return happenedAt + 7 * DAY_MS;
}

/** The ISO week whose drop is next to be released at `now` (this week until Thu 18:00, then next week). */
export function nextDropWeek(now: number, timeZone: string = DROP_TIME_ZONE): WeekId {
  const week = weekIdAt(now, timeZone);
  return now < dropSchedule(week, timeZone).releaseAt ? week : addWeeks(week, 1);
}

/**
 * The first drop a `setParticipation` call affects (§10.1). Pausing applies at once, and skipping
 * targets the next unreleased drop (release revalidation drops the user if it is already computed).
 * Opting in after Thu 12:00 applies from next week.
 */
export function participationEffectiveWeek(mode: SetParticipationMode, now: number, timeZone: string = DROP_TIME_ZONE): WeekId {
  const week = weekIdAt(now, timeZone);
  if (mode === 'pause' || mode === 'skipNext') return nextDropWeek(now, timeZone);
  return now < dropSchedule(week, timeZone).optInCutoffAt ? week : addWeeks(week, 1);
}

/** The drop released most recently at `now`: its unmatched users are the backfill pool (§4.2, `lastDrop.weekId`). */
export function latestReleasedDropWeek(now: number, timeZone: string = DROP_TIME_ZONE): WeekId {
  const week = weekIdAt(now, timeZone);
  return now >= dropSchedule(week, timeZone).releaseAt ? week : addWeeks(week, -1);
}
