/**
 * Pair history beyond the H5 defaults (D9): the "Would you meet them again?" answers of two people about each other.
 * Both "yes" → they may be matched again after `meetAgainWeeks` instead of the co-member window. Either "no" → never
 * again, as a soft block that neither of them can see (not a formal block: no H4 entry, no notice). Both outcomes
 * live only in server-side `recentH`, so they cost the matcher nothing new.
 */
import { addWeeks } from '../time/weekId';
import type { WeekId } from '../types/ids';
import type { MatchingProfile } from './profiles';

/** `recentH` value for a pair that must never be matched again; later than any real drop week. */
export const NEVER_WEEK_ID = '9999-W52' as WeekId;

export type MeetAgainAnswer = boolean | null;
export type PairOutcome = 'never' | 'relaxed' | 'pending' | 'none';

/**
 * Either "no" → never (one answer is enough, so a "no" never waits for the other side). Both "yes" → relaxed.
 * One "yes" and no answer yet → pending. Otherwise (no answers, or one "yes" whose window closed) → none.
 */
export function meetAgainOutcome(aAboutB: MeetAgainAnswer, bAboutA: MeetAgainAnswer, feedbackClosed = false): PairOutcome {
  if (aAboutB === false || bAboutA === false) return 'never';
  if (aAboutB === true && bAboutA === true) return 'relaxed';
  if ((aAboutB === true || bAboutA === true) && !feedbackClosed) return 'pending';
  return 'none';
}

/**
 * The `recentH` value both sides get for this pair after a meetup in `meetWeek`, or null for no change.
 * Write it with `setRecentAfterMeetAgain`, not `mergeRecentUntil`, because a relaxation shortens the window.
 */
export function recentUntilAfterMeetAgain(meetWeek: WeekId, outcome: PairOutcome, profile: MatchingProfile): WeekId | null {
  if (outcome === 'never') return NEVER_WEEK_ID;
  if (outcome !== 'relaxed') return null;
  const h5 = profile.defaults.h5;
  return addWeeks(meetWeek, Math.min(h5.meetAgainWeeks, h5.coMemberWeeks));
}

/** Combine two H5 windows for one pair, e.g. a new release on top of an older entry: the later one wins. */
export function mergeRecentUntil(existing: WeekId | undefined, next: WeekId): WeekId {
  return existing !== undefined && existing > next ? existing : next;
}

/**
 * Apply a meet-again result to one side's `recentH` entry. NEVER is final; a relaxation replaces the co-member window
 * but keeps any later window the pair has earned since (e.g. a newer co-proposal).
 */
export function setRecentAfterMeetAgain(existing: WeekId | undefined, next: WeekId, coMemberUntil: WeekId): WeekId {
  if (existing === NEVER_WEEK_ID || next === NEVER_WEEK_ID) return NEVER_WEEK_ID;
  if (existing === undefined || existing <= coMemberUntil) return next;
  return mergeRecentUntil(existing, next);
}
