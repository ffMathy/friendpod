import { addWeeks } from '../time/weekId';
import type { MatchingProfileId } from '../types/domain';
import type { WeekId } from '../types/ids';
import type { MatchParams } from '../types/matching';
import { MAX_AGE, MIN_AGE, MIN_AGE_RANGE_WIDTH } from '../schemas/profile';

/** Defaults outside the matcher itself that a profile changes (§6.10). */
export interface ProfileDefaults {
  /** Default age range: own age ± this. */
  readonly ageHalfWidth: number;
  /** "Open to anyone" (Q12): opt-in at launch, on by default (opt-out) in the alpha. */
  readonly openToAnyoneDefault: boolean;
  /**
   * H5 windows written into `recentH`: at release, and after a mutual meet-again "yes" (D9), which shortens the
   * pair's co-member window to `meetAgainWeeks` (never lengthens it).
   */
  readonly h5: { readonly coMemberWeeks: number; readonly coProposedWeeks: number; readonly meetAgainWeeks: number };
  readonly confirmationMin: number;
}

export interface MatchingProfile {
  readonly id: MatchingProfileId;
  readonly params: MatchParams;
  readonly defaults: ProfileDefaults;
}

const SHARED = {
  minSize: 4,
  targetSize: 5,
  maxSize: 6,
  weights: { B: 1, wT: 0.3, wF: 0.3, wR: 0.15, wP: 0.6 },
  // [A] uncalibrated: v2 cosines of unrelated vectors already sit at 0.78–0.85 [CAL], so τ must be in that band.
  tau: 0.85,
  topThemes: 5,
  topK: 60,
  candidateScan: 300,
  moveBudget: 2e7,
  maxPasses: 4,
  minDelta: 1e-9,
  maxActivePods: 2,
  minInterests: 3,
  openToAnyone: { enabled: true, minWeeksWaiting: 2, q: 0.3 },
} as const;

const SENSITIVE = {
  densityMin: 12,
  densityKm: 25,
  minAccountAgeDays: 14,
  minVerifiedAttended: 1,
  maxProposalsPer12Weeks: 3,
  maxHoldings: 5,
} as const;

export const LAUNCH_PROFILE: MatchingProfile = {
  id: 'launch',
  params: {
    ...SHARED,
    profile: 'launch',
    overbook: { mode: 'expectedAttendance', sumRBelow: 4.0 },
    sizePenalty: { 4: 0.5, 5: 0, 6: 0.2 },
    sensitive: { ...SENSITIVE, waiveActivityForFounderInvited: false },
  },
  defaults: { ageHalfWidth: 7, openToAnyoneDefault: false, h5: { coMemberWeeks: 26, coProposedWeeks: 4, meetAgainWeeks: 4 }, confirmationMin: 4 },
};

/** Thin-market profile for the 50–150-tester alpha (A26). S1 density is a privacy guard and is never relaxed. */
export const ALPHA_PROFILE: MatchingProfile = {
  id: 'alpha',
  params: {
    ...SHARED,
    profile: 'alpha',
    overbook: { mode: 'always' },
    sizePenalty: { 4: 0.5, 5: 0.1, 6: 0 },
    sensitive: { ...SENSITIVE, waiveActivityForFounderInvited: true },
  },
  defaults: { ageHalfWidth: 10, openToAnyoneDefault: true, h5: { coMemberWeeks: 8, coProposedWeeks: 2, meetAgainWeeks: 4 }, confirmationMin: 4 },
};

export const MATCHING_PROFILES: Readonly<Record<MatchingProfileId, MatchingProfile>> = {
  launch: LAUNCH_PROFILE,
  alpha: ALPHA_PROFILE,
};

export function getMatchingProfile(id: MatchingProfileId): MatchingProfile {
  return MATCHING_PROFILES[id];
}

/** Own age ± the profile's half-width, at least 18 and at least 5 years wide (§3.1 step 8). */
export function defaultAgeRange(age: number, profile: MatchingProfile): { ageMin: number; ageMax: number } {
  let ageMin = Math.max(MIN_AGE, age - profile.defaults.ageHalfWidth);
  let ageMax = Math.min(MAX_AGE, age + profile.defaults.ageHalfWidth);
  if (ageMax - ageMin < MIN_AGE_RANGE_WIDTH) {
    if (ageMin === MIN_AGE) ageMax = ageMin + MIN_AGE_RANGE_WIDTH;
    else ageMin = ageMax - MIN_AGE_RANGE_WIDTH;
  }
  return { ageMin, ageMax };
}

/** Exclusive `untilWeek` for `recentH` after a pod in `weekId` (H5). */
export function recentUntilWeek(weekId: WeekId, kind: 'coMember' | 'coProposed', profile: MatchingProfile): WeekId {
  return addWeeks(weekId, kind === 'coMember' ? profile.defaults.h5.coMemberWeeks : profile.defaults.h5.coProposedWeeks);
}
