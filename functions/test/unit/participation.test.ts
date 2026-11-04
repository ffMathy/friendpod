import { dropSchedule, type WeekId } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/lib/errors';
import { applyParticipation, participatesIn, type ParticipationState } from '../../src/lib/participation';

const W = '2026-W46' as WeekId;
const NEXT = '2026-W47' as WeekId;
const s = dropSchedule(W);
const WED = s.computeAt - 30 * 3_600_000;
const THU_AFTER_CUTOFF = s.optInCutoffAt + 3_600_000;
const THU_AFTER_RELEASE = s.releaseAt + 3_600_000;

const active: ParticipationState = { status: 'active', mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: null, pauseReason: null };

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? e.code : 'other';
  }
  return undefined;
};

describe('participatesIn', () => {
  it('follows mode, skip, manual opt-in and pauses', () => {
    expect(participatesIn(active, W, WED)).toBe(true);
    expect(participatesIn({ ...active, skipWeekId: W }, W, WED)).toBe(false);
    expect(participatesIn({ ...active, mode: 'manual' }, W, WED)).toBe(false);
    expect(participatesIn({ ...active, mode: 'manual', optInWeekId: W }, W, WED)).toBe(true);
    expect(participatesIn({ ...active, status: 'paused', pauseReason: 'user' }, W, WED)).toBe(false);
    expect(participatesIn({ ...active, status: 'paused', pauseReason: 'user', pausedUntil: WED - 1 }, W, WED)).toBe(true);
    expect(participatesIn({ ...active, status: 'paused', pauseReason: 'noShow', pausedUntil: WED - 1 }, W, WED)).toBe(false);
    expect(participatesIn({ ...active, status: 'suspended' }, W, WED)).toBe(false);
  });
});

describe('applyParticipation', () => {
  it('pauses at once, with an optional end', () => {
    const r = applyParticipation(active, 'pause', WED + 7 * 86_400_000, WED);
    expect(r.next).toMatchObject({ status: 'paused', pauseReason: 'user', pausedUntil: WED + 7 * 86_400_000 });
    expect(r.effectiveWeekId).toBe(W);
    expect(code(() => applyParticipation(active, 'pause', WED - 1, WED))).toBe('VALIDATION');
  });

  it('keeps an automated pause when the user pauses on top of it, and refuses to lift it', () => {
    const held: ParticipationState = { ...active, status: 'paused', pauseReason: 'reports' };
    expect(applyParticipation(held, 'pause', undefined, WED).next).toEqual(held);
    expect(code(() => applyParticipation(held, 'auto', undefined, WED))).toBe('STATE');
    expect(code(() => applyParticipation(held, 'manual', undefined, WED))).toBe('STATE');
  });

  it('lifts user, decline and ignore pauses', () => {
    for (const pauseReason of ['user', 'declines', 'ignored'] as const) {
      const r = applyParticipation({ ...active, status: 'paused', pauseReason }, 'auto', undefined, WED);
      expect(r.next).toMatchObject({ status: 'active', pauseReason: null, pausedUntil: null, skipWeekId: null });
    }
  });

  it('skips the next unreleased drop, even after the 16:00 compute', () => {
    expect(applyParticipation(active, 'skipNext', undefined, THU_AFTER_CUTOFF).next.skipWeekId).toBe(W);
    expect(applyParticipation(active, 'skipNext', undefined, THU_AFTER_RELEASE).next.skipWeekId).toBe(NEXT);
    const manual = { ...active, mode: 'manual' as const, optInWeekId: W };
    expect(applyParticipation(manual, 'skipNext', undefined, WED).next.optInWeekId).toBeNull();
  });

  it('applies an opt-in after the Thu 12:00 cutoff from next week', () => {
    const paused: ParticipationState = { ...active, status: 'paused', pauseReason: 'user' };
    const late = applyParticipation(paused, 'auto', undefined, THU_AFTER_CUTOFF);
    expect(late.effectiveWeekId).toBe(NEXT);
    expect(late.next).toMatchObject({ status: 'active', skipWeekId: W });
    expect(participatesIn(late.next, W, THU_AFTER_CUTOFF)).toBe(false);
    expect(participatesIn(late.next, NEXT, THU_AFTER_CUTOFF)).toBe(true);

    const early = applyParticipation(paused, 'auto', undefined, WED);
    expect(early.effectiveWeekId).toBe(W);
    expect(participatesIn(early.next, W, WED)).toBe(true);

    // Someone who was already in this week's drop stays in it.
    expect(applyParticipation(active, 'auto', undefined, THU_AFTER_CUTOFF).next.skipWeekId).toBeNull();
  });

  it('records a manual opt-in for one drop', () => {
    const manual = { ...active, mode: 'manual' as const };
    expect(applyParticipation(manual, 'manual', undefined, WED).next.optInWeekId).toBe(W);
    const late = applyParticipation(manual, 'manual', undefined, THU_AFTER_CUTOFF);
    expect(late.effectiveWeekId).toBe(NEXT);
    expect(participatesIn(late.next, W, THU_AFTER_CUTOFF)).toBe(false);
    expect(participatesIn(late.next, NEXT, THU_AFTER_CUTOFF)).toBe(true);
  });

  it('keeps a manual opt-in for this drop when `manual` is sent again after the cutoff', () => {
    const optedIn = applyParticipation({ ...active, mode: 'manual' }, 'manual', undefined, WED).next;
    expect(participatesIn(optedIn, W, WED)).toBe(true);
    for (const at of [THU_AFTER_CUTOFF, s.computeAt + 3_600_000]) {
      const again = applyParticipation(optedIn, 'manual', undefined, at);
      expect(again.next).toEqual(optedIn);
      expect(again.effectiveWeekId).toBe(W);
      expect(participatesIn(again.next, W, at)).toBe(true);
    }
    // Once that drop is released, `manual` opts in to the next one as usual.
    expect(applyParticipation(optedIn, 'manual', undefined, THU_AFTER_RELEASE).next.optInWeekId).toBe(NEXT);
  });

  it('refuses changes for suspended or deleting accounts', () => {
    expect(code(() => applyParticipation({ ...active, status: 'suspended' }, 'auto', undefined, WED))).toBe('STATE');
    expect(code(() => applyParticipation({ ...active, status: 'deleting' }, 'pause', undefined, WED))).toBe('STATE');
  });
});
