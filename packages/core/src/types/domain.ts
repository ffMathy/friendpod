export const LOCALES = ['da', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Meetup languages (A9, H6). */
export const LANGUAGES = ['da', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const GENDERS = ['woman', 'man', 'nonbinary'] as const;
export type Gender = (typeof GENDERS)[number];

export const RADII_KM = [5, 10, 15, 25] as const;
export type RadiusKm = (typeof RADII_KM)[number];
export const DEFAULT_RADIUS_KM: RadiusKm = 10;

export const ACCOUNT_STATUSES = ['active', 'paused', 'suspended', 'deleting'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const PARTICIPATION_MODES = ['auto', 'manual'] as const;
export type ParticipationMode = (typeof PARTICIPATION_MODES)[number];
export const SET_PARTICIPATION_MODES = ['auto', 'manual', 'skipNext', 'pause'] as const;
export type SetParticipationMode = (typeof SET_PARTICIPATION_MODES)[number];

export const POD_STATES = ['proposed', 'planning', 'scheduled', 'happened', 'archived', 'dissolved'] as const;
export type PodState = (typeof POD_STATES)[number];
export const ACTIVE_POD_STATES: readonly PodState[] = ['planning', 'scheduled'];

export const CARD_MEMBER_STATUSES = ['invited', 'accepted', 'declined', 'left'] as const;
export type CardMemberStatus = (typeof CARD_MEMBER_STATUSES)[number];

export const LAUNCH_AREA_STATUSES = ['waitlist', 'beta', 'live'] as const;
export type LaunchAreaStatus = (typeof LAUNCH_AREA_STATUSES)[number];

export const MATCHING_PROFILE_IDS = ['launch', 'alpha'] as const;
export type MatchingProfileId = (typeof MATCHING_PROFILE_IDS)[number];

/** GDPR Art. 9 categories named in the blanket consent (PRIVACY.md §3.3); the lexicon files its terms under them. */
export const ART9_CATEGORIES = ['health', 'religion', 'sexualOrientation', 'politics', 'ethnicOrigin', 'tradeUnion'] as const;
export type Art9Category = (typeof ART9_CATEGORIES)[number];

/** `sensitiveInterests.source` (§8.1). There is no human review (D2). */
export const SENSITIVITY_SOURCES = ['lexicon', 'self', 'model'] as const;
export type SensitivitySource = (typeof SENSITIVITY_SOURCES)[number];

export const REPORT_CATEGORIES = ['harassment', 'safety', 'noShow', 'content', 'underage', 'notGenuine'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
// No 'interest' target: an interest's wording could only be acted on by a human reviewer (D2).
export const REPORT_TARGET_TYPES = ['user', 'option', 'message'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/**
 * A member's answer to "Still coming?" (D5). A yes vote for the winning option counts as 'coming' at plan lock;
 * 'unconfirmed' is set when the T−6 h nudge also goes unanswered. Only 'coming' counts for the attendance check,
 * and no answer is never a no-show by itself.
 */
export const ATTENDANCE_STATUSES = ['pending', 'coming', 'notComing', 'unconfirmed'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/** Pod states in which a backfill invite may still be sent (D6): never once the plan is locked. */
export const BACKFILL_POD_STATES: readonly PodState[] = ['proposed', 'planning'];

/**
 * Google Places (New) primary types a meetup option may use (D8, §4.5): public places only. The app filters
 * Autocomplete predictions to these, and proposeOption refuses any other.
 */
export const PUBLIC_PLACE_TYPES = [
  'cafe',
  'coffee_shop',
  'tea_house',
  'bakery',
  'ice_cream_shop',
  'restaurant',
  'bar',
  'pub',
  'wine_bar',
  'library',
  'book_store',
  'museum',
  'art_gallery',
  'cultural_center',
  'community_center',
  'movie_theater',
  'bowling_alley',
  'park',
  'dog_park',
  'botanical_garden',
  'hiking_area',
  'plaza',
  'tourist_attraction',
  'zoo',
  'aquarium',
] as const;
export type PublicPlaceType = (typeof PUBLIC_PLACE_TYPES)[number];

export const PLATFORMS = ['ios', 'android'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DROP_OUTCOMES = ['proposed', 'unmatched', 'excluded'] as const;
export type DropOutcome = (typeof DROP_OUTCOMES)[number];

export const CONSENT_SCOPES = ['art9', 'gender'] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
export const CONSENT_ACTIONS = ['grant', 'withdraw', 'superseded'] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

export const ERASURE_KINDS = ['account', 'interest', 'consentWithdrawal', 'gender', 'photo', 'block', 'unblock'] as const;
export type ErasureKind = (typeof ERASURE_KINDS)[number];

/** Automatic holds on sensitive-themed pods; nobody reviews them, so each expires on its own (D2). */
export const SENSITIVE_HOLD_REASONS = ['notGenuine', 'anomaly'] as const;
export type SensitiveHoldReason = (typeof SENSITIVE_HOLD_REASONS)[number];
/** [A] Length of an automatic sensitive hold. */
export const SENSITIVE_HOLD_DAYS = 28;

/**
 * Availability is a 6-bit mask: weekday / Saturday / Sunday × day / evening (A9).
 * Pods need a non-zero AND over all members (§6.1).
 */
export const AVAILABILITY = {
  weekdayDay: 1,
  weekdayEvening: 2,
  saturdayDay: 4,
  saturdayEvening: 8,
  sundayDay: 16,
  sundayEvening: 32,
} as const;
export const AVAILABILITY_ALL = 0b111111;
