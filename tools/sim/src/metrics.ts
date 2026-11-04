import type { UnmatchedReason } from '@grouper/core';

/** Percentile of censored values (Infinity = never); null when the percentile falls on a censored value. */
export function censoredPercentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const v = sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]!;
  return Number.isFinite(v) ? v : null;
}

export type StarvationCause =
  | 'sameGender'
  | 'sensitiveOnly'
  | 'age'
  | 'language'
  | 'radius'
  | 'availability'
  | 'noSharedTheme'
  | 'competition'
  | 'tooFewInterests'
  | 'proposedNotConfirmed'
  | 'other';

const CAUSE: Partial<Record<UnmatchedReason, StarvationCause>> = {
  GENDER_POOL: 'sameGender',
  GENDER: 'sameGender',
  SENSITIVE_ELIGIBILITY: 'sensitiveOnly',
  SENSITIVE_DENSITY: 'sensitiveOnly',
  AGE: 'age',
  LANGUAGE: 'language',
  RADIUS: 'radius',
  AVAILABILITY: 'availability',
  NO_THEME_BUCKET: 'noSharedTheme',
  NO_FIT_THIS_WEEK: 'competition',
  TOO_FEW_INTERESTS: 'tooFewInterests',
};

/** The most frequent cause among a never-matched user's weekly reasons (ties: the earlier week). */
export function dominantCause(reasons: readonly UnmatchedReason[], wasProposed: boolean): StarvationCause {
  if (wasProposed) return 'proposedNotConfirmed';
  const counts = new Map<StarvationCause, number>();
  let best: StarvationCause = 'other';
  let bestN = 0;
  for (const r of reasons) {
    const c = CAUSE[r] ?? 'other';
    const n = (counts.get(c) ?? 0) + 1;
    counts.set(c, n);
    if (n > bestN) {
      best = c;
      bestN = n;
    }
  }
  return best;
}

export const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);
export const round = (x: number | null, digits = 3): number | null => (x === null ? null : Number(x.toFixed(digits)));
