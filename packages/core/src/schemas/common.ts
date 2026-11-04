import { z } from 'zod';
import { GH5_PATTERN } from '../geo/geohash';
import { BASE32_ID_PATTERN } from '../ids/base32';
import { INTEREST_ID_LENGTH, POD_ID_LENGTH, UID_H_LENGTH } from '../ids/podId';
import { isWeekId } from '../time/weekId';
import { ART9_CATEGORIES, AVAILABILITY_ALL, GENDERS, LANGUAGES, LOCALES, RADII_KM } from '../types/domain';
import type { WeekId } from '../types/ids';

export const uidSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const uidHSchema = z.string().length(UID_H_LENGTH).regex(BASE32_ID_PATTERN);
export const podIdSchema = z.string().length(POD_ID_LENGTH).regex(BASE32_ID_PATTERN);
export const interestIdSchema = z.string().length(INTEREST_ID_LENGTH).regex(BASE32_ID_PATTERN);
/** `c_` + 20 hex (+ `_p` for a private assignment), or a seed concept `seed_<slug>`. */
export const conceptIdSchema = z.string().regex(/^(?:c_[0-9a-f]{20}(?:_p)?|seed_[a-z0-9]+(?:_[a-z0-9]+)*)$/);
/** Firestore auto-ids and our own generated ids. */
export const docIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const weekIdSchema = z
  .string()
  .refine(isWeekId, { message: 'invalid ISO week id' })
  .transform((v) => v as WeekId);
export const gh5Schema = z.string().regex(GH5_PATTERN);
export const localeSchema = z.enum(LOCALES);
export const languageSchema = z.enum(LANGUAGES);
export const genderSchema = z.enum(GENDERS);
export const art9CategorySchema = z.enum(ART9_CATEGORIES);
export const radiusKmSchema = z.literal(RADII_KM);
/** At least one of weekday/Saturday/Sunday × day/evening. */
export const availabilitySchema = z.int().min(1).max(AVAILABILITY_ALL);
/** Epoch milliseconds; callables exchange instants as numbers. */
export const epochMsSchema = z.int().min(0);
export const sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const languagesSchema = z
  .array(languageSchema)
  .min(1)
  .max(LANGUAGES.length)
  .refine((a) => new Set(a).size === a.length, { message: 'duplicate language' });

/** `YYYY-MM-DD`, a real calendar date. */
export const ymdDateSchema = z.string().refine(
  (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() + 1 === Number(m[2]) && d.getUTCDate() === Number(m[3]);
  },
  { message: 'invalid date' },
);

/** First name, 1–30 characters: letters, marks, spaces, apostrophes, periods and hyphens (no contact details). */
export const firstNameSchema = z
  .string()
  .transform((v) => v.normalize('NFC').replace(/\s+/gu, ' ').trim())
  .pipe(
    z
      .string()
      .refine((v) => [...v].length >= 1 && [...v].length <= 30, { message: 'length 1-30' })
      .refine((v) => /^[\p{L}\p{M}][\p{L}\p{M}' .’-]*$/u.test(v), { message: 'letters only' }),
  );

/** What the client sends with an explicit consent (PRIVACY.md §3.4). */
export const consentPayloadSchema = z.strictObject({
  textVersion: z.string().regex(/^[a-z0-9-]{3,64}$/),
  textSha256: sha256HexSchema,
  checked: z.literal(true),
});

/**
 * An https URL without credentials. Regex-based on purpose: React Native's URL polyfill does not
 * implement `hostname`, and these schemas also validate forms on the device.
 */
const HTTPS_URL = /^https:\/\/([a-z0-9.-]+)(?::\d{1,5})?(?:[/?#][^\s]*)?$/i;
export const httpsUrlSchema = z.string().max(500).regex(HTTPS_URL);
export function urlHost(url: string): string | null {
  return HTTPS_URL.exec(url)?.[1]?.toLowerCase() ?? null;
}

export const legalVersionSchema = z.string().regex(/^[a-z0-9.-]{1,64}$/);

/**
 * Firestore Timestamp in document schemas. Both firebase-admin and RNFirebase Timestamps have toMillis();
 * core stays free of either SDK.
 */
export interface TimestampLike {
  toMillis(): number;
}
export const timestampSchema = z.custom<TimestampLike>(
  (v) => typeof v === 'object' && v !== null && typeof (v as { toMillis?: unknown }).toMillis === 'function',
  { message: 'expected a Firestore Timestamp' },
);
