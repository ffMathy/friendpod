/**
 * Limits and switches of the interest pipeline (DESIGN.md §4.3, §5.2, §9). The model, prompts, dimension and
 * thresholds are core's (`EMBEDDING_MODEL`), shared with the app that embeds every tag (D1); nothing here may
 * restate them.
 */
import { HOUR_MS } from '@friendpod/core';

export const LIMITS = {
  /** Holdings per user, sensitive included (§4.3). */
  maxInterests: 20,
  /** Holdings that become sensitive per account per 7 days, new or "Keep this private" (S5, §4.3). */
  sensitiveAddsPer7Days: 3,
  sensitiveAddsWindowMs: 7 * 24 * HOUR_MS,
  /** addInterests calls per uid per hour; halved for accounts younger than 24 h (§9). */
  callsPerHour: 30,
  /** Items per uid per day (also halved for accounts younger than 24 h, §4.3). */
  itemsPerDay: 100,
  newAccountMs: 24 * HOUR_MS,
} as const;

/** `rateLimits/{uid}_{bucket}` ids. */
export const ADD_INTERESTS_BUCKET = 'addInterests';
export const ADD_INTEREST_ITEMS_BUCKET = 'addInterestItems';
export const SENSITIVE_ADDS_BUCKET = 'sensitiveAdds';

/**
 * Whether sensitive (Art. 9) holdings are accepted at all. On since removeInterest and the holding steps of
 * withdrawArt9Consent exist: withdrawing consent is as easy as giving it and takes effect at once (Art. 7(3),
 * PRIVACY.md §3.5). Switched off, every sensitive holding is answered `limit`/SENSITIVE_UNAVAILABLE and nothing about
 * it is kept. A test fails if this is on while removeInterest is a stub or withdrawArt9Consent cannot remove holdings.
 */
export const ART9_HOLDINGS_ENABLED = true;

/** 128-d float32 copy of each centroid for the matcher (A2, §6.4): truncated, then re-normalized. */
export const C128_DIM = 128;
/** `findNearest` result count over the holding's partition (§5.2 (6)). */
export const CONCEPT_SEARCH_LIMIT = 3;
/** Concept snapshot generation; stays 0 until the in-memory shortlist stage (§5.2 (6), above 20k concepts). */
export const CONCEPT_GEN = 0;

