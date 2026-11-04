import type { Brand } from './brand';

/** Firebase Auth uid. */
export type Uid = string;
/** `base32(HMAC-SHA256(UID_HMAC_KEY, 'uid|' + uid))[0..20]` (§8). Pseudonymous, not anonymous. */
export type UidH = string;
/** `base32(HMAC-SHA256(POD_ID_KEY, weekId|sortedUids))[0..20]` (§6.5). */
export type PodId = string;
/** `base32(HMAC(UID_HMAC_KEY, 'interest|' + uid + '|' + norm))[0..16]` (§8.1). */
export type InterestId = string;
export type ConceptId = string;
/** Geohash-5 cell, the only location we store. */
export type Gh5 = string;
/** ISO week id, e.g. `2026-W46`. */
export type WeekId = `${number}-W${string}`;

/**
 * A concept id that came from an ordinary holding (`users/{uid}/interests`).
 * Only these may feed secondary scoring, ALSO_SHARE, podInterests, chips and counts (S2, §5.2 (5)).
 */
export type NonSensitiveConceptId = Brand<ConceptId, 'NonSensitiveConceptId'>;
/** A concept id in the sensitive partition (tag-sensitive or self-flagged holding). */
export type SensitiveConceptId = Brand<ConceptId, 'SensitiveConceptId'>;
/** `consentEventId` of the grant that covers a sensitive holding. */
export type ConsentRef = Brand<string, 'ConsentRef'>;
