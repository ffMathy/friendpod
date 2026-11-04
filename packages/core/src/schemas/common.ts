import { z } from 'zod';
import { GH5_PATTERN } from '../geo/geohash';
import { BASE32_ID_PATTERN } from '../ids/base32';
import { INTEREST_ID_LENGTH, POD_ID_LENGTH, UID_H_LENGTH } from '../ids/podId';
import { isWeekId } from '../time/weekId';
import { ART9_CATEGORIES, AVAILABILITY_ALL, GENDERS, LANGUAGES, LOCALES, PUBLIC_PLACE_TYPES, RADII_KM } from '../types/domain';
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

/**
 * What the client sends with an explicit consent (PRIVACY.md §3.4).
 * DESIGN-DEVIATION: §10 lists `{textVersion, textSha256, checked: true}`. The consent event must also record the
 * app version that showed the text (PRIVACY.md §3.4, DESIGN.md §8.2), and RNFirebase callables cannot send
 * custom headers, so the payload carries it. Version-like characters only, so it can never hold free text.
 */
export const consentPayloadSchema = z.strictObject({
  textVersion: z.string().regex(/^[a-z0-9-]{3,64}$/),
  textSha256: sha256HexSchema,
  appVersion: z.string().regex(/^[0-9A-Za-z.+-]{1,32}$/),
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

// ---------------------------------------------------------------- places (D8)

/** Coordinates are stored rounded to 4 decimals (about 11 m): enough for a map pin, no more. */
export const PLACE_COORD_DECIMALS = 4;
export function roundPlaceCoord(x: number): number {
  const f = 10 ** PLACE_COORD_DECIMALS;
  return Math.round(x * f) / f;
}
const roundedCoord = (min: number, max: number) =>
  z.number().min(min).max(max).refine((v) => Math.abs(v - roundPlaceCoord(v)) < 1e-9, { message: `round to ${PLACE_COORD_DECIMALS} decimals` });

/** The Google Maps URL of a place: built, never typed, so it can only point at that place. */
export function googleMapsPlaceUrl(placeId: string, name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`;
}

/**
 * A meetup place picked from Google Places (New) Autocomplete (D8): public place types only, no free text.
 * `address` is the formatted short address. The server checks the shape and the type; it does not call Places.
 */
export const placeSchema = z
  .strictObject({
    placeId: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/),
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(200),
    lat: roundedCoord(-90, 90),
    lng: roundedCoord(-180, 180),
    type: z.enum(PUBLIC_PLACE_TYPES),
    mapUrl: z.string().max(600),
  })
  .refine((p) => p.mapUrl === googleMapsPlaceUrl(p.placeId, p.name), { message: 'mapUrl must be googleMapsPlaceUrl(placeId, name)', path: ['mapUrl'] });
export type Place = z.infer<typeof placeSchema>;

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
