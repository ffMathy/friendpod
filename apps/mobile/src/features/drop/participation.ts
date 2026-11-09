/**
 * Whether the viewer is in the next drop, as Home shows it (drop-home "You're in this week"). Mirrors the server's
 * `participatesIn` (functions/src/lib/participation.ts) for the drop week, plus who may lift a pause themselves.
 */
import type { UserDoc, WeekId } from '@friendpod/core';

export type DropParticipation =
  /** In the next drop. */
  | { readonly kind: 'in' }
  /** Auto mode, skipping this drop. */
  | { readonly kind: 'skipping' }
  /** Manual mode, not opted in to this drop. */
  | { readonly kind: 'notIn' }
  /** Paused (or suspended). `liftable`: the user's own pause or an auto-pause after declines, which they may end. */
  | { readonly kind: 'paused'; readonly until: number | null; readonly liftable: boolean };

/** Pauses the user may lift (functions/src/lib/participation.ts USER_LIFTABLE). */
const LIFTABLE = new Set(['user', 'declines', 'ignored']);

export function dropParticipation(user: Pick<UserDoc, 'status' | 'participation'>, dropWeek: WeekId, now: number): DropParticipation {
  const p = user.participation;
  const until = p.pausedUntil?.toMillis() ?? null;
  const pauseOver = user.status === 'paused' && p.pauseReason === 'user' && until !== null && until <= now;
  if ((user.status === 'paused' && !pauseOver) || user.status === 'suspended') {
    return { kind: 'paused', until, liftable: user.status === 'paused' && (p.pauseReason === undefined || LIFTABLE.has(p.pauseReason)) };
  }
  if (p.mode === 'auto') return p.skipWeekId === dropWeek ? { kind: 'skipping' } : { kind: 'in' };
  return p.optInWeekId === dropWeek ? { kind: 'in' } : { kind: 'notIn' };
}
