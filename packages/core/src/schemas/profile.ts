import { z } from 'zod';
import { availabilitySchema, languagesSchema, radiusKmSchema } from './common';

export const MIN_AGE = 18;
export const MAX_AGE = 99;
/** Minimum width of the age range [A] (§4.3). */
export const MIN_AGE_RANGE_WIDTH = 5;

const prefsShape = {
  ageMin: z.int().min(MIN_AGE).max(MAX_AGE),
  ageMax: z.int().min(MIN_AGE).max(MAX_AGE),
  maxKm: radiusKmSchema,
  languages: languagesSchema,
  availability: availabilitySchema,
  sameGenderOnly: z.boolean(),
  // DESIGN-DEVIATION: §8.1 prefs has no field for Q12's "open to meet anyone" fallback; it is needed
  // per user (opt-in at launch, opt-out in the alpha profile, §6.10).
  openToAnyone: z.boolean(),
};

const ageRangeOk = (p: { ageMin?: number | undefined; ageMax?: number | undefined }): boolean =>
  p.ageMin === undefined || p.ageMax === undefined || p.ageMax - p.ageMin >= MIN_AGE_RANGE_WIDTH;
const ageRangeIssue = { message: `age range must span at least ${MIN_AGE_RANGE_WIDTH} years`, path: ['ageMax'] };

export const prefsSchema = z.object(prefsShape).refine(ageRangeOk, ageRangeIssue);
export type Prefs = z.infer<typeof prefsSchema>;

/** Partial preferences in a callable; the server re-validates the merged result with prefsSchema. */
export const prefsPatchSchema = z.strictObject(prefsShape).partial().refine(ageRangeOk, ageRangeIssue);
export type PrefsPatch = z.infer<typeof prefsPatchSchema>;
