/**
 * Reason codes (DESIGN.md §6.7). Cards carry these; the client renders them.
 * THEME and ALSO_SHARE carry only the viewer's own wording, never another member's text or a concept label.
 */
export type PodReason =
  | { readonly code: 'THEME'; readonly yourWording: string }
  | { readonly code: 'ALSO_SHARE'; readonly yourWordings: readonly string[] }
  | { readonly code: 'AREA'; readonly label: string }
  | { readonly code: 'NEAR_YOU'; readonly km: number }
  | { readonly code: 'AGE_SPAN'; readonly min: number; readonly max: number }
  | { readonly code: 'PRIORITY'; readonly weeks: number }
  | { readonly code: 'SOFT_THEME'; readonly yourTag: string; readonly podTheme: string }
  | { readonly code: 'OPEN_TO_ANYONE' };

export type PodReasonCode = PodReason['code'];
export const POD_REASON_CODES = [
  'THEME',
  'ALSO_SHARE',
  'AREA',
  'NEAR_YOU',
  'AGE_SPAN',
  'PRIORITY',
  'SOFT_THEME',
  'OPEN_TO_ANYONE',
] as const satisfies readonly PodReasonCode[];

export const ALSO_SHARE_MAX = 3;

export const UNMATCHED_REASONS = [
  'NO_THEME_BUCKET',
  'RADIUS',
  'AGE',
  'GENDER',
  'GENDER_POOL',
  'LANGUAGE',
  'AVAILABILITY',
  'MAX_ACTIVE_PODS',
  'TOO_FEW_INTERESTS',
  'SENSITIVE_ELIGIBILITY',
  'SENSITIVE_DENSITY',
  'AREA_WAITLIST',
  'OUTSIDE_AREAS',
  // DESIGN-DEVIATION: §6.7 has no code for "enough compatible people exist, but no pod fit this week"
  // (competition, or constraints we must not reveal such as blocks and pair history). Without it the
  // matcher would have to name a wrong setting.
  'NO_FIT_THIS_WEEK',
] as const;
export type UnmatchedReason = (typeof UNMATCHED_REASONS)[number];

/**
 * Reasons that only apply to holders of a sensitive interest. Each user sees their own; stored aggregates fold
 * them into NO_FIT_THIS_WEEK, so no shared count of sensitive-interest holders exists (PRIVACY.md §4.3).
 */
export const SENSITIVE_UNMATCHED_REASONS: readonly UnmatchedReason[] = ['SENSITIVE_ELIGIBILITY', 'SENSITIVE_DENSITY'];

/** Reasons that name a user-set constraint, so Home can name the setting after 3 drops (§6.7). */
export const USER_SETTING_REASONS: readonly UnmatchedReason[] = ['RADIUS', 'AGE', 'GENDER_POOL', 'LANGUAGE', 'AVAILABILITY'];

/** Input-time rejection codes for `addInterests` (§5.2 (2)); rendered as DSA Art. 17 statements of reasons on the device. */
export const MODERATION_REASONS = [
  'TAG_TOO_SHORT',
  'TAG_TOO_LONG',
  'PII',
  'BLOCKLIST',
  'THIRD_PARTY_SENSITIVE',
  'INTEREST_LIMIT',
  'SENSITIVE_ADD_LIMIT',
  // A tag that is sensitive for this holding while the user has not given the blanket Art. 9 consent (D3).
  // Refusing it, rather than asking per tag, keeps the app usable without consent, so the consent stays free.
  'ART9_CONSENT_REQUIRED',
  // DESIGN-DEVIATION: not in §5.2. Sensitive holdings are refused until withdrawal (withdrawArt9Consent,
  // removeInterest) exists, because withdrawing must be as easy as consenting (Art. 7(3)). TODO(M1): remove.
  'SENSITIVE_UNAVAILABLE',
] as const;
export type ModerationReason = (typeof MODERATION_REASONS)[number];

export interface CardReasonInput {
  readonly themeSensitive: boolean;
  readonly openToAnyone: boolean;
  /** The viewer's own `display` of their theme holding (absent for open-to-anyone pods). */
  readonly yourThemeWording: string | null;
  /** The viewer's own wording of up to 3 shared ordinary interests. */
  readonly alsoShareWordings: readonly string[];
  readonly areaLabel: string;
  readonly nearKm: number;
  readonly ageSpan: { readonly min: number; readonly max: number } | null;
  readonly priorityWeeks: number | null;
}

/**
 * Builds the reasons for one viewer's card. Sensitive themes never carry ALSO_SHARE or AGE_SPAN:
 * invitees are not members yet, and those details could narrow down the local holders (§3.2).
 */
export function buildCardReasons(input: CardReasonInput): PodReason[] {
  const reasons: PodReason[] = [];
  if (input.openToAnyone) {
    reasons.push({ code: 'OPEN_TO_ANYONE' });
  } else {
    if (input.yourThemeWording === null) throw new Error('buildCardReasons: a concept theme needs the viewer wording');
    reasons.push({ code: 'THEME', yourWording: input.yourThemeWording });
  }
  if (!input.themeSensitive && input.alsoShareWordings.length > 0) {
    reasons.push({ code: 'ALSO_SHARE', yourWordings: input.alsoShareWordings.slice(0, ALSO_SHARE_MAX) });
  }
  reasons.push({ code: 'AREA', label: input.areaLabel });
  reasons.push({ code: 'NEAR_YOU', km: input.nearKm });
  if (!input.themeSensitive && input.ageSpan) {
    reasons.push({ code: 'AGE_SPAN', min: input.ageSpan.min, max: input.ageSpan.max });
  }
  if (input.priorityWeeks !== null && input.priorityWeeks > 0) {
    reasons.push({ code: 'PRIORITY', weeks: input.priorityWeeks });
  }
  return reasons;
}
