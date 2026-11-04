/**
 * Fixed-window counters in `rateLimits/{uid}_{bucket}` (DESIGN.md §9 Rate limits, §8.2). A window starts at its
 * first take and lasts `windowMs`: simpler than a sliding window, and at most 2× the limit across a boundary.
 * Callers read and write the bucket inside their own transaction, so the charge commits with what it guards.
 */
import { DAY_MS, ts, type DocOf } from './firestore';

type Bucket = DocOf<'rateLimit'>;

export interface WindowLimit {
  readonly limit: number;
  /** At most a day: a bucket expires (TTL) a day after its window started. */
  readonly windowMs: number;
}

/** The bucket after one more take at `nowMs`, or null when its window is full (nothing to write). */
export function takeWindow(bucket: Bucket | undefined, nowMs: number, { limit, windowMs }: WindowLimit): Bucket | null {
  const fresh = bucket === undefined || nowMs - bucket.windowStart.toMillis() >= windowMs;
  const startMs = fresh ? nowMs : bucket.windowStart.toMillis();
  const count = fresh ? 0 : bucket.count;
  if (count >= limit) return null;
  return { count: count + 1, windowStart: ts(startMs), expiresAt: ts(startMs + DAY_MS) };
}

/** Document id of a per-user bucket, `{uid}_{bucket}` or, scoped to one pod, `{uid}_{bucket}_{podId}`. */
export function rateLimitKey(uid: string, bucket: string, podId?: string): string {
  return podId === undefined ? `${uid}_${bucket}` : `${uid}_${bucket}_${podId}`;
}
