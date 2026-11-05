import { getLaunchArea, LAUNCH_PROFILE, ALPHA_PROFILE } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { generateCity } from '../src/city';
import { simulate } from '../src/loop';
import { censoredPercentile, dominantCause } from '../src/metrics';
import { Rng, Zipf } from '../src/rng';

const START = Date.UTC(2027, 0, 14, 15);

describe('rng', () => {
  it('is reproducible per seed and roughly uniform', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    const xs = Array.from({ length: 1000 }, () => a.next());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b.next()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(new Rng(8).next()).not.toBe(new Rng(7).next());
  });

  it('samples Zipf ranks with a decreasing head', () => {
    const z = new Zipf(2000, 1, 3);
    const r = new Rng(1);
    const counts = new Array(2000).fill(0);
    for (let i = 0; i < 50_000; i++) counts[z.sample(r)]++;
    expect(counts[0]).toBeGreaterThan(counts[10]);
    expect(counts[10]).toBeGreaterThan(counts[500]);
  });
});

describe('synthetic city', () => {
  const city = generateCity({ n: 400, seed: 3, profile: LAUNCH_PROFILE, startAt: START });

  it('places every user in an Aarhus launch-area cell', () => {
    const cells = new Set(getLaunchArea('aarhus')!.cells);
    expect(city.users).toHaveLength(400);
    for (const u of city.users) expect(cells.has(u.gh5)).toBe(true);
  });

  it('matches the documented mix: ~5% sensitive concepts, ~10% same-gender, radii 5–25 km, ≥ 3 interests', () => {
    const sensitive = city.concepts.filter((c) => c.sensitive).length / city.concepts.length;
    expect(sensitive).toBeGreaterThan(0.03);
    expect(sensitive).toBeLessThan(0.07);
    const sameGender = city.users.filter((u) => u.sameGenderOnly).length / city.users.length;
    expect(sameGender).toBeGreaterThan(0.05);
    expect(sameGender).toBeLessThan(0.16);
    for (const u of city.users) {
      expect([5, 10, 15, 25]).toContain(u.maxKm);
      expect(u.holdings.length).toBeGreaterThanOrEqual(3);
      expect(u.ageMax - u.ageMin).toBeGreaterThanOrEqual(5);
      expect(u.sameGenderOnly ? u.gender !== null : u.gender === null).toBe(true);
    }
  });

  it('is deterministic per seed', () => {
    const again = generateCity({ n: 400, seed: 3, profile: LAUNCH_PROFILE, startAt: START });
    expect(again.users.map((u) => [u.gh5, u.birthYear, u.holdings])).toEqual(city.users.map((u) => [u.gh5, u.birthYear, u.holdings]));
  });
});

describe('12-week loop', () => {
  const run = (seed: number) => simulate({ n: 120, weeks: 4, profile: ALPHA_PROFILE, seed });
  const withoutTimings = (r: ReturnType<typeof run>) => {
    const { runtimeMs: _r, perWeek, ...rest } = r.metrics;
    return { ...rest, perWeek: perWeek.map(({ matchMs: _m, ...w }) => w) };
  };

  it('is reproducible for a seed (timings aside)', () => {
    expect(withoutTimings(run(1))).toEqual(withoutTimings(run(1)));
    expect(withoutTimings(run(1))).not.toEqual(withoutTimings(run(2)));
  });

  it('reports metrics in range and flags itself as synthetic', () => {
    const r = run(1);
    expect(r.synthetic).toBe(true);
    const m = r.metrics;
    expect(m.perWeek).toHaveLength(4);
    for (const x of [m.matchRate, m.inviteAcceptance, m.confirmationRate, m.neverMatchedShare]) {
      expect(x).not.toBeNull();
      expect(x!).toBeGreaterThanOrEqual(0);
      expect(x!).toBeLessThanOrEqual(1);
    }
    expect(m.proposedPods).toBeGreaterThan(0);
    for (const size of Object.keys(m.podSizes)) expect(['4', '5', '6']).toContain(size);
  });
});

describe('first-timers first (§6.2)', () => {
  const off = (p: typeof ALPHA_PROFILE) => ({ ...p, params: { ...p.params, firstTimer: { seedFirst: false, boost: 0 } } });
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  it('gives first-timers more of the seats and leaves fewer of them out than with the parameter off', () => {
    const seeds = [1, 2, 3];
    const on = seeds.map((seed) => simulate({ n: 200, weeks: 6, profile: ALPHA_PROFILE, seed }).metrics.firstTimers);
    const without = seeds.map((seed) => simulate({ n: 200, weeks: 6, profile: off(ALPHA_PROFILE), seed }).metrics.firstTimers);
    expect(sum(on.map((m) => m.seatShare!))).toBeGreaterThan(sum(without.map((m) => m.seatShare!)));
    expect(sum(on.map((m) => m.leftOut))).toBeLessThanOrEqual(sum(without.map((m) => m.leftOut)));
  });
});

describe('metric helpers', () => {
  it('computes censored percentiles', () => {
    expect(censoredPercentile([1, 2, 3, 4], 0.5)).toBe(2);
    expect(censoredPercentile([1, 2, Infinity, Infinity], 0.5)).toBe(2);
    expect(censoredPercentile([1, Infinity, Infinity, Infinity], 0.5)).toBeNull();
    expect(censoredPercentile([], 0.5)).toBeNull();
  });

  it('groups never-matched users by their dominant reason', () => {
    expect(dominantCause(['AGE', 'GENDER_POOL', 'GENDER_POOL'], false)).toBe('sameGender');
    expect(dominantCause(['SENSITIVE_DENSITY'], false)).toBe('sensitiveOnly');
    expect(dominantCause(['AGE'], true)).toBe('proposedNotConfirmed');
    expect(dominantCause([], false)).toBe('other');
  });
});
