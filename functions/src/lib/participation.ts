/**
 * Weekly participation (DESIGN.md §3.2, §4.1, §10.1 setParticipation). Pausing and skipping apply at once;
 * opting in after the Thu 12:00 cutoff applies from next week, so the current drop keeps its in/out state.
 */
import {
  nextDropWeek,
  participationEffectiveWeek,
  type AccountStatus,
  type PAUSE_REASONS,
  type ParticipationMode,
  type SetParticipationMode,
  type WeekId,
} from '@grouper/core';
import { AppError } from './errors';

export type PauseReason = (typeof PAUSE_REASONS)[number];

export interface ParticipationState {
  readonly status: AccountStatus;
  readonly mode: ParticipationMode;
  readonly skipWeekId: WeekId | null;
  /** Manual mode: the one drop the user opted in to. */
  readonly optInWeekId: WeekId | null;
  /** Epoch ms. */
  readonly pausedUntil: number | null;
  readonly pauseReason: PauseReason | null;
}

/**
 * Pauses the user may lift themselves. The others are automated safety pauses that only a human review or the
 * re-commit flow lifts (§3.7, §4.4).
 */
const USER_LIFTABLE: ReadonlySet<PauseReason> = new Set<PauseReason>(['user', 'declines', 'ignored']);

/** Whether the user takes part in `weekId`'s drop: snapshot selection and release revalidation (§10.3). */
export function participatesIn(p: ParticipationState, weekId: WeekId, nowMs: number): boolean {
  const pauseOver = p.status === 'paused' && p.pauseReason === 'user' && p.pausedUntil !== null && p.pausedUntil <= nowMs;
  if (p.status !== 'active' && !pauseOver) return false;
  return p.mode === 'auto' ? p.skipWeekId !== weekId : p.optInWeekId === weekId;
}

export interface ParticipationChange {
  readonly next: ParticipationState;
  readonly effectiveWeekId: WeekId;
}

export function applyParticipation(current: ParticipationState, mode: SetParticipationMode, until: number | undefined, nowMs: number): ParticipationChange {
  if (current.status === 'suspended' || current.status === 'deleting') throw new AppError('STATE');
  const effectiveWeekId = participationEffectiveWeek(mode, nowMs);
  const dropWeek = nextDropWeek(nowMs);

  switch (mode) {
    case 'pause': {
      if (until !== undefined && until <= nowMs) throw new AppError('VALIDATION');
      // An automated pause keeps its reason: a user pause on top must not make it liftable.
      if (current.status === 'paused' && current.pauseReason !== null && !USER_LIFTABLE.has(current.pauseReason)) {
        return { next: current, effectiveWeekId };
      }
      return { next: { ...current, status: 'paused', pauseReason: 'user', pausedUntil: until ?? null }, effectiveWeekId };
    }
    case 'skipNext':
      return {
        next: { ...current, skipWeekId: dropWeek, optInWeekId: current.optInWeekId === dropWeek ? null : current.optInWeekId },
        effectiveWeekId,
      };
    case 'auto':
    case 'manual': {
      if (current.status === 'paused' && current.pauseReason !== null && !USER_LIFTABLE.has(current.pauseReason)) throw new AppError('STATE');
      const inDrop = participatesIn(current, dropWeek, nowMs);
      const deferred = effectiveWeekId !== dropWeek;
      const resumed = { status: 'active', pausedUntil: null, pauseReason: null } as const;
      if (mode === 'auto') {
        // After the cutoff an opt-in starts next week: a user who was out of this drop stays out of it.
        return { next: { ...current, ...resumed, mode, optInWeekId: null, skipWeekId: deferred && !inDrop ? dropWeek : null }, effectiveWeekId };
      }
      // A manual user already in this drop who sends `manual` again after the cutoff (the app re-sends it when the
      // active toggle is tapped) makes no new opt-in: the drop they opted in to stays theirs.
      if (deferred && current.mode === 'manual' && inDrop) {
        return { next: { ...current, ...resumed, optInWeekId: dropWeek, skipWeekId: null }, effectiveWeekId: dropWeek };
      }
      // Manual mode's opt-in covers one drop; switching from auto after the cutoff leaves this drop, like a skip.
      return { next: { ...current, ...resumed, mode, optInWeekId: effectiveWeekId, skipWeekId: null }, effectiveWeekId };
    }
  }
}
