/**
 * Day-1 funnel (DESIGN.md §6.8, founder decision 2026-11-05): aggregate, uid-free counters per launch area and ISO
 * week, in `funnel/{areaId}_{weekId}` (server-only). Each user counts once per stage: the server sets a milestone
 * timestamp on the user's server-only `matchProfiles/{uid}.milestones` in the same transaction as the increment, and
 * increments only when the milestone was absent. Milestones go with the account (erasure deletes the profile); the
 * counters hold no uid and are kept 24 months (PRIVACY.md P18). No analytics SDK.
 */
import { addWeeks, dateInWeek, weekIdAt } from '../time/weekId';
import type { WeekId } from '../types/ids';

export const FUNNEL_STAGES = [
  /** The Firebase Auth user was created (counted at onboarding, or when an abandoned sign-up is cleaned up). */
  'signup',
  /** `completeOnboarding` succeeded. */
  'onboarded',
  /** Onboarded (or moved) into an area on the waitlist. */
  'waitlisted',
  /** In a live area: onboarded or moved there, or the area went live while the user was in it. */
  'firstDropEligible',
  /** First pod proposal (release or backfill). */
  'firstProposal',
  /** First confirmed pod. */
  'firstConfirmed',
  /** First meetup that happened. */
  'firstMeetupHappened',
  /** Second meetup that happened (continuation, the §6.8 north star). */
  'secondMeetup',
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/**
 * "Where did you hear about Friendpod?" (optional, single choice, skippable; coordinator addition 2026-11-05). The
 * answer is never stored on the user: completeOnboarding increments `funnel/{areaId}_{weekId}.sources.<choice>` once
 * (onboarding succeeds once per account), and readers suppress cells under 10 like every other funnel cell.
 */
export const HEARD_FROM_SOURCES = ['dadsGroup', 'newcomerEvent', 'university', 'venuePoster', 'friend', 'socialMedia', 'press', 'other'] as const;
export type HeardFromSource = (typeof HEARD_FROM_SOURCES)[number];

/** The milestone field on `matchProfiles/{uid}.milestones` for each stage. */
export const FUNNEL_MILESTONE_FIELD = {
  signup: 'signupAt',
  onboarded: 'onboardedAt',
  waitlisted: 'waitlistedAt',
  firstDropEligible: 'firstDropEligibleAt',
  firstProposal: 'firstProposalAt',
  firstConfirmed: 'firstConfirmedAt',
  firstMeetupHappened: 'firstMeetupHappenedAt',
  secondMeetup: 'secondMeetupAt',
} as const satisfies Record<FunnelStage, string>;
export type MilestoneField = (typeof FUNNEL_MILESTONE_FIELD)[FunnelStage];

/** The funnel row of users outside every launch area (`area.areaId: null`). Never a launch-area id. */
export const FUNNEL_NO_AREA = 'none';

/** Funnel counters are kept 24 months (PRIVACY.md §5, P18). */
export const FUNNEL_RETENTION_WEEKS = 104;

/** Cells under this are shown as "<10" by every reader (§6.6). */
export const FUNNEL_SUPPRESS_BELOW = 10;

/** `funnel/{areaId}_{weekId}`; the week is the ISO week of the event in Europe/Copenhagen. */
export function funnelDocId(areaId: string | null, weekId: WeekId): string {
  return `${areaId ?? FUNNEL_NO_AREA}_${weekId}`;
}

export function funnelWeekId(atMs: number): WeekId {
  return weekIdAt(atMs);
}

/** The TTL instant of a funnel doc: the Monday of its week + 104 weeks, 00:00 UTC (a day either way is irrelevant). */
export function funnelExpiresAtMs(weekId: WeekId): number {
  const d = dateInWeek(addWeeks(weekId, FUNNEL_RETENTION_WEEKS), 1);
  return Date.UTC(d.year, d.month - 1, d.day);
}

/**
 * The stage a happened meetup reaches for a user: the first one, then the second (continuation), then nothing.
 * Deterministic from the milestones alone, so a retried event cannot count twice.
 */
export function meetupMilestone(milestones: Partial<Record<MilestoneField, unknown>>): FunnelStage | null {
  if (milestones.firstMeetupHappenedAt === undefined) return 'firstMeetupHappened';
  if (milestones.secondMeetupAt === undefined) return 'secondMeetup';
  return null;
}

/** The stages not reached yet among `stages`, in funnel order (each user counts once per stage). */
export function newMilestones(milestones: Partial<Record<MilestoneField, unknown>>, stages: readonly FunnelStage[]): FunnelStage[] {
  return FUNNEL_STAGES.filter((s) => stages.includes(s) && milestones[FUNNEL_MILESTONE_FIELD[s]] === undefined);
}

export type FunnelCounts = Readonly<Record<FunnelStage, number>>;
export type SuppressedFunnelCounts = Readonly<Record<FunnelStage, number | '<10'>>;

/** The same suppression for the source counters. */
export function suppressSourceCounts(counts: Partial<Record<HeardFromSource, number>>): Readonly<Record<HeardFromSource, number | '<10'>> {
  return Object.fromEntries(
    HEARD_FROM_SOURCES.map((s) => {
      const n = counts[s] ?? 0;
      return [s, n > 0 && n < FUNNEL_SUPPRESS_BELOW ? '<10' : n];
    }),
  ) as Readonly<Record<HeardFromSource, number | '<10'>>;
}

/** Small-count suppression for display (§6.6): 1–9 → "<10"; 0 stays 0. */
export function suppressFunnelCounts(counts: Partial<Record<FunnelStage, number>>): SuppressedFunnelCounts {
  return Object.fromEntries(
    FUNNEL_STAGES.map((s) => {
      const n = counts[s] ?? 0;
      return [s, n > 0 && n < FUNNEL_SUPPRESS_BELOW ? '<10' : n];
    }),
  ) as SuppressedFunnelCounts;
}
