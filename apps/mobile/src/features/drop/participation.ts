import { dropSchedule, nextDropWeek, type PAUSE_REASONS, type UserDoc } from '@grouper/core';

type PauseReason = (typeof PAUSE_REASONS)[number];

/** Pauses the user may lift themselves (functions/src/lib/participation.ts USER_LIFTABLE); the rest end on their own. */
const LIFTABLE: ReadonlySet<PauseReason> = new Set<PauseReason>(['user', 'declines', 'ignored']);

/**
 * Where the user stands for the next drop, from the same fields the server's `participatesIn` reads (§10.1). Display
 * only: `setParticipation` decides. Undoing a skip or joining as a manual user only reaches this drop before the
 * Thursday 12:00 opt-in cutoff, so the action is offered only until then.
 */
export type DropParticipation =
  | { readonly kind: 'in' }
  | { readonly kind: 'skipping'; readonly canUndo: boolean }
  | { readonly kind: 'notJoined'; readonly canJoin: boolean }
  | { readonly kind: 'paused'; readonly canResume: boolean }
  | { readonly kind: 'unavailable' };

export function dropParticipation(user: UserDoc, now: number): DropParticipation {
  const week = nextDropWeek(now);
  const p = user.participation;
  const pausedUntil = p.pausedUntil?.toMillis();
  const pauseOver = user.status === 'paused' && p.pauseReason === 'user' && pausedUntil !== undefined && pausedUntil <= now;
  if (user.status === 'paused' && !pauseOver) return { kind: 'paused', canResume: p.pauseReason === undefined || LIFTABLE.has(p.pauseReason) };
  if (user.status !== 'active' && !pauseOver) return { kind: 'unavailable' };
  const beforeCutoff = now < dropSchedule(week).optInCutoffAt;
  if (p.mode === 'auto') return p.skipWeekId === week ? { kind: 'skipping', canUndo: beforeCutoff } : { kind: 'in' };
  return p.optInWeekId === week ? { kind: 'in' } : { kind: 'notJoined', canJoin: beforeCutoff };
}
