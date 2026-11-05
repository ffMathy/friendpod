/**
 * First-timers first (DESIGN.md §6.2, founder decision 2026-11-05): users who never had a confirmed pod seed first
 * and get `params.firstTimer.boost` in f(u). Deterministic, a profile parameter, and never at the cost of a constraint.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { deriveContext, seedPriorityCompare } from '../../src/matching/context';
import { matchComponent } from '../../src/matching/matchComponent';
import { ALPHA_PROFILE, LAUNCH_PROFILE, MATCHING_PROFILES } from '../../src/matching/profiles';
import { waitingPriority } from '../../src/matching/score';
import type { WeekId } from '../../src/types/ids';
import type { MatchParams } from '../../src/types/matching';
import { matchInputArb, mkInput, mkUser, WEEK } from './fixtures';

const OFF: MatchParams = { ...LAUNCH_PROFILE.params, firstTimer: { seedFirst: false, boost: 0 } };
const weeksAgo = (n: number) => `2026-W${String(46 - n).padStart(2, '0')}` as WeekId;

describe('first-timer parameters', () => {
  it('is a profile parameter, on in both profiles', () => {
    for (const p of Object.values(MATCHING_PROFILES)) {
      expect(p.params.firstTimer.seedFirst).toBe(true);
      expect(p.params.firstTimer.boost).toBeGreaterThan(0);
    }
    expect(ALPHA_PROFILE.params.firstTimer).toEqual(LAUNCH_PROFILE.params.firstTimer);
  });

  it('adds the boost to f(u), and only for first-timers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), fc.boolean(), fc.double({ min: 0, max: 2, noNaN: true }), (weeks, priority, boost) => {
        expect(waitingPriority(weeks, priority, boost)).toBeCloseTo(waitingPriority(weeks, priority) + boost, 12);
        expect(waitingPriority(weeks, priority, 0)).toBe(waitingPriority(weeks, priority));
      }),
    );
    const ctx = deriveContext(mkInput([mkUser('a', { firstTimer: true }), mkUser('b', { firstTimer: false })]));
    expect(ctx.users[0]!.f - ctx.users[1]!.f).toBeCloseTo(LAUNCH_PROFILE.params.firstTimer.boost, 12);
    const off = deriveContext(mkInput([mkUser('a', { firstTimer: true }), mkUser('b', { firstTimer: false })], { params: OFF }));
    expect(off.users[0]!.f).toBe(off.users[1]!.f);
  });
});

describe('seed order (property)', () => {
  it('puts every first-timer ahead of every other user, then orders by f(u)', () => {
    fc.assert(
      fc.property(matchInputArb, (input) => {
        const ctx = deriveContext(input);
        const order = ctx.users.map((u) => u.idx).sort((a, b) => seedPriorityCompare(ctx, a, b) || ctx.users[a]!.tie - ctx.users[b]!.tie || a - b);
        const firstNonFirstTimer = order.findIndex((i) => !ctx.users[i]!.firstTimer);
        if (firstNonFirstTimer >= 0) expect(order.slice(firstNonFirstTimer).every((i) => !ctx.users[i]!.firstTimer)).toBe(true);
        for (let k = 1; k < order.length; k++) {
          const a = ctx.users[order[k - 1]!]!;
          const b = ctx.users[order[k]!]!;
          if (a.firstTimer === b.firstTimer) expect(a.f).toBeGreaterThanOrEqual(b.f);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('is antisymmetric and falls back to f(u) alone when seedFirst is off', () => {
    fc.assert(
      fc.property(matchInputArb, (input) => {
        const ctx = deriveContext({ ...input, params: OFF });
        for (const a of ctx.users) for (const b of ctx.users) {
          expect(Math.sign(seedPriorityCompare(ctx, a.idx, b.idx))).toBe(-Math.sign(seedPriorityCompare(ctx, b.idx, a.idx)) || 0);
          expect(seedPriorityCompare(ctx, a.idx, b.idx)).toBe(b.f - a.f);
        }
      }),
      { numRuns: 50 },
    );
  });
});

describe('scarce seats go to first-timers (property)', () => {
  // 5–7 interchangeable users in one cell can fill one pod only (two need 8), so someone may be left out. With equal
  // waiting, a first-timer is never left out while a user who already had a pod is placed.
  it('leaves out a non-first-timer whenever there is one', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 7 }), fc.array(fc.boolean(), { minLength: 7, maxLength: 7 }), fc.integer({ min: 0, max: 4 }), fc.constantFrom(LAUNCH_PROFILE, ALPHA_PROFILE), (n, flags, waited, profile) => {
        const users = Array.from({ length: n }, (_, i) => mkUser(`u${i}`, { firstTimer: flags[i]!, waitingSinceWeek: weeksAgo(waited) }));
        const result = matchComponent(mkInput(users, { params: profile.params }));
        expect(result.pods).toHaveLength(1);
        const placed = new Set(result.pods[0]!.members);
        const leftOut = users.filter((u) => !placed.has(u.uid));
        const placedVeterans = users.filter((u) => placed.has(u.uid) && !u.firstTimer);
        if (placedVeterans.length > 0) expect(leftOut.filter((u) => u.firstTimer)).toEqual([]);
      }),
      { numRuns: 150 },
    );
  });

  it('is deterministic with first-timers in the input', () => {
    fc.assert(
      fc.property(matchInputArb, (input) => {
        expect(matchComponent(input)).toEqual(matchComponent(input));
      }),
      { numRuns: 50 },
    );
  });

  it('changes who is placed only through the parameter (a fixed example)', () => {
    // Seven users, one seat short; u6 is the only first-timer and has waited no longer than anyone else.
    const users = Array.from({ length: 7 }, (_, i) => mkUser(`u${i}`, { firstTimer: i === 6, waitingSinceWeek: WEEK }));
    const on = matchComponent(mkInput(users));
    expect(on.pods[0]!.members).toContain('u6');
    const off = matchComponent(mkInput(users, { params: OFF }));
    expect(off.pods).toHaveLength(1);
  });
});
