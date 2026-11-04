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

/** GDPR Art. 9 categories named on the consent sheet (PRIVACY.md §3.3). */
export const ART9_CATEGORIES = ['health', 'religion', 'sexualOrientation', 'politics', 'ethnicOrigin', 'tradeUnion'] as const;
export type Art9Category = (typeof ART9_CATEGORIES)[number];

/** `sensitiveInterests.source` (§8.1). */
export const SENSITIVITY_SOURCES = ['review', 'lexicon', 'self', 'model'] as const;
export type SensitivitySource = (typeof SENSITIVITY_SOURCES)[number];

export const REPORT_CATEGORIES = ['harassment', 'safety', 'noShow', 'content', 'underage', 'notGenuine'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export const REPORT_TARGET_TYPES = ['user', 'option', 'interest', 'message'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** One-tap meetup-chat messages; only the key is stored, each device renders it in its own language. */
export const QUICK_REPLIES = ['onMyWay', 'runningLate', 'imHere', 'cantMakeIt'] as const;
export type QuickReply = (typeof QUICK_REPLIES)[number];
export const POD_MESSAGE_KINDS = ['text', 'quickReply'] as const;
export type PodMessageKind = (typeof POD_MESSAGE_KINDS)[number];

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

export const REVIEW_KINDS = ['tagSensitivity', 'conceptMerge', 'abuseHold', 'report', 'sensitiveAnomaly'] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const SENSITIVE_HOLD_REASONS = ['notGenuine', 'anomaly'] as const;
export type SensitiveHoldReason = (typeof SENSITIVE_HOLD_REASONS)[number];

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
