/**
 * Pure pod-lifecycle rules (§3.5, §3.6, §4.4, §4.6) that the callables and the sweeper apply inside their podState
 * transaction: the winning option, the meetup-option window, late cancels, the no-show majority rule and the
 * `noShowEvents` window.
 */
import { DAY_MS, HOUR_MS } from '../time/schedule';
import { weeksBetween } from '../time/weekId';
import { DROP_TIME_ZONE, toLocal } from '../time/zone';
import type { Uid, WeekId } from '../types/ids';
import { WINNING_YES_VOTES } from './planning';

export interface OptionVotes {
  readonly id: string;
  /** Epoch ms. */
  readonly startsAt: number;
  readonly votes: Readonly<Record<Uid, 'yes' | 'no'>>;
}

/** Yes votes from current members only: a member who left takes their votes with them. */
export function yesVotes(option: OptionVotes, memberUids: readonly Uid[]): number {
  return memberUids.filter((uid) => option.votes[uid] === 'yes').length;
}

/** Every current member said yes: the plan locks early (§3.5). */
export function unanimousYes(option: OptionVotes, memberUids: readonly Uid[]): boolean {
  return memberUids.length > 0 && yesVotes(option, memberUids) === memberUids.length;
}

/**
 * The option that wins at the planning deadline (§3.5, §4.6): the most yes votes, at least WINNING_YES_VOTES; ties go
 * to the earlier time, then the lower id (deterministic). Options whose time has already come are out.
 */
export function winningOption(options: readonly OptionVotes[], memberUids: readonly Uid[], now: number): OptionVotes | null {
  let best: OptionVotes | null = null;
  let bestYes = 0;
  for (const o of options) {
    if (o.startsAt <= now) continue;
    const yes = yesVotes(o, memberUids);
    if (yes < WINNING_YES_VOTES) continue;
    if (best === null || yes > bestYes || (yes === bestYes && (o.startsAt < best.startsAt || (o.startsAt === best.startsAt && o.id < best.id)))) {
      best = o;
      bestYes = yes;
    }
  }
  return best;
}

/** Options start within 14 days, between 08:00 and 22:00 local time (§4.3). */
export const OPTION_MAX_AHEAD_MS = 14 * DAY_MS;
export const OPTION_EARLIEST_LOCAL_MINUTE = 8 * 60;
export const OPTION_LATEST_LOCAL_MINUTE = 22 * 60;
export const OPTIONS_PER_POD = 3;
export const OPTIONS_PER_MEMBER = 2;

export function optionTimeOk(startsAt: number, now: number, timeZone: string = DROP_TIME_ZONE): boolean {
  if (startsAt <= now || startsAt > now + OPTION_MAX_AHEAD_MS) return false;
  const l = toLocal(startsAt, timeZone);
  const minute = l.hour * 60 + l.minute;
  return minute >= OPTION_EARLIEST_LOCAL_MINUTE && minute <= OPTION_LATEST_LOCAL_MINUTE;
}

/** "Can't make it" under 24 h before the meetup is a late cancel, 0.5 of a no-show (§4.4). */
export const LATE_CANCEL_BEFORE_MS = 24 * HOUR_MS;
export function isLateCancel(meetupAt: number, now: number): boolean {
  return now > meetupAt - LATE_CANCEL_BEFORE_MS;
}

/** One member's "Who was there?" answer, as stored in `podFeedback` (resolved with attendanceFromNotThere). */
export interface FeedbackAttendance {
  readonly met: boolean;
  readonly attendance: Readonly<Record<Uid, 'came' | 'noShow'>>;
}

export type ResolvedAttendance = 'attended' | 'noShow' | 'cancelled' | 'unknown';

export interface AttendanceResolution {
  readonly outcome: ResolvedAttendance;
  /** Co-members who said this member came: ≥ 2 makes it a verified attendance (S5). */
  readonly cameVotes: number;
}

/**
 * The no-show majority rule (§4.4, D2, D15). Responders are the other members who answered "Who was there?" with
 * `met: true`. A member is a no-show only if more than half of the responders unticked them and they did not cancel;
 * there is no dispute. A member attended when someone ticked them or they said they met. No answer is never a no-show.
 */
export function resolveAttendance(members: readonly Uid[], feedback: Readonly<Record<Uid, FeedbackAttendance>>, cancelled: ReadonlySet<Uid>): Record<Uid, AttendanceResolution> {
  const out: Record<Uid, AttendanceResolution> = {};
  for (const m of members) {
    let responders = 0;
    let noShow = 0;
    for (const r of members) {
      if (r === m) continue;
      const fb = feedback[r];
      if (!fb?.met) continue;
      responders++;
      if (fb.attendance[m] === 'noShow') noShow++;
    }
    const cameVotes = responders - noShow;
    let outcome: ResolvedAttendance;
    if (cancelled.has(m)) outcome = 'cancelled';
    else if (responders > 0 && noShow * 2 > responders) outcome = 'noShow';
    else if (cameVotes > 0 || feedback[m]?.met === true) outcome = 'attended';
    else outcome = 'unknown';
    out[m] = { outcome, cameVotes };
  }
  return out;
}

export interface NoShowEvent {
  readonly weekId: WeekId;
  readonly w: 1 | 0.5;
}

export const NO_SHOW_EVENTS_MAX = 8;
export const NO_SHOW_EVENTS_MAX_AGE_WEEKS = 26;

/** Appends an event and keeps the last 8 within 26 weeks of `currentWeek` (§4.4). */
export function appendNoShowEvent(events: readonly NoShowEvent[], event: NoShowEvent, currentWeek: WeekId): NoShowEvent[] {
  return [...events, event].filter((e) => weeksBetween(e.weekId, currentWeek) < NO_SHOW_EVENTS_MAX_AGE_WEEKS).slice(-NO_SHOW_EVENTS_MAX);
}
