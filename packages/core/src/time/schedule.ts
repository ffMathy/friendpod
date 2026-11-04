import type { SetParticipationMode } from '../types/domain';
import type { WeekId } from '../types/ids';
import { addWeeks, dateInWeek, weekIdAt } from './weekId';
import { DROP_TIME_ZONE, fromLocal } from './zone';

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

/** Backfill deadline: min(backfill start + 24 h, Sun 18:00) (§4.1). */
export function backfillDeadline(startedAt: number, weekId: WeekId, timeZone: string = DROP_TIME_ZONE): number {
  return Math.min(startedAt + DAY_MS, dropSchedule(weekId, timeZone).backfillLatest);
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

export interface MeetupTimers {
  readonly stillComingAt: number;
  readonly attendanceCheckAt: number;
  readonly reminderAt: number;
  readonly happenedAt: number;
}

/** T−24 h, T−6 h, T−2 h and T+2 h around a meetup (§4.1). */
export function meetupTimers(meetupAt: number): MeetupTimers {
  return {
    stillComingAt: meetupAt - 24 * HOUR_MS,
    attendanceCheckAt: meetupAt - 6 * HOUR_MS,
    reminderAt: meetupAt - 2 * HOUR_MS,
    happenedAt: meetupAt + 2 * HOUR_MS,
  };
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
