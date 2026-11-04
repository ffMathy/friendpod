import { describe, expect, it } from 'vitest';
import { matchingComponents } from '../../src/matching/components';
import { deriveContext } from '../../src/matching/context';
import { pairScore, podValue, reliability, secScore, specificity, waitingPriority } from '../../src/matching/score';
import { decodeMatchSnapshot, encodeMatchSnapshot } from '../../src/matching/snapshot';
import { matchComponent } from '../../src/matching/matchComponent';
import { matchSnapshotSchema } from '../../src/schemas/matching';
import type { WeekId } from '../../src/types/ids';
import { encodeGeohash } from '../../src/geo/geohash';
import { BASE_CONCEPTS, CELLS, concept, mkInput, mkUser, ord, sens, WEEK } from './fixtures';

describe('scoring (§6.2)', () => {
  it('reliability starts at 0.8 and follows (attended + 4)/(attended + noShowW + 5)', () => {
    expect(reliability({ attended: 0, noShows: 0, lateCancels: 0 })).toBeCloseTo(0.8);
    expect(reliability({ attended: 4, noShows: 1, lateCancels: 2 })).toBeCloseTo(8 / 11);
  });

  it('specificity is clamped to [0.3, 1]', () => {
    expect(specificity(1, 100)).toBe(1);
    expect(specificity(10, 100)).toBeCloseTo(0.5);
    expect(specificity(100, 100)).toBe(0.3);
    expect(specificity(5, 1)).toBe(1);
  });

  it('waiting priority caps at 4 weeks and adds 1 after a no-fault dissolve', () => {
    expect(waitingPriority(0, false)).toBe(0);
    expect(waitingPriority(2, false)).toBe(0.5);
    expect(waitingPriority(9, true)).toBe(2);
  });

  it('computes pair and pod value exactly as the formulas say', () => {
    const a = mkUser('a', { birthYear: 1990, themes: [ord('c_a', true), ord('c_b'), ord('c_c')] });
    const b = mkUser('b', { birthYear: 1996, gh5: CELLS.n, maxKm: 10, themes: [ord('c_a'), ord('c_b'), ord('c_d')] });
    const ctx = deriveContext(mkInput([a, b]));
    const d = ctx.distKm(ctx.users[0]!.cell, ctx.users[1]!.cell);
    const pa = ctx.users[0]!.p!;
    const pb = ctx.users[1]!.p!;
    let cos = 0;
    for (let i = 0; i < 128; i++) cos += pa[i]! * pb[i]!;
    const tau = ctx.params.tau;
    expect(cos).toBeGreaterThan(tau);
    const sec = 0.5 * Math.max(0, (cos - tau) / (1 - tau)) + 0.5 * Math.min(1, 2 / 3);
    expect(secScore(ctx, 0, 1)).toBeCloseTo(sec, 12);
    const pair = 0.6 * sec + 0.2 * Math.exp(-6 / 6) + 0.2 * (1 - d / 10);
    expect(pairScore(ctx, 0, 1)).toBeCloseTo(pair, 12);
    // V(P, c_a) for the pair, q(c_a) = 0.3 with 2 holders of 2 users; f = 0, r = 0.8; sizePen(2) = 0.
    const perUser = (s: number) => 1 + 0.3 * 0.3 * s + 0.15 * 0.8 + 0.6 * pair;
    expect(podValue(ctx, [0, 1], 0)).toBeCloseTo(perUser(1.0) + perUser(0.8), 12);
  });

  it('scores a concept held twice (another wording, or merged into it) with the strongest strength', () => {
    const concepts = [...BASE_CONCEPTS.filter((c) => c.id !== 'c_b'), concept('c_b', false, 'c_a')];
    for (const themes of [[ord('c_a'), ord('c_b', true)], [ord('c_b', true), ord('c_a')], [ord('c_a'), ord('c_a', true)]]) {
      const ctx = deriveContext(mkInput([mkUser('a', { themes: [...themes, ord('c_c')] }), mkUser('b')], { concepts }));
      const a = ctx.users.find((u) => u.uid === 'a')!;
      expect(a.themeS.get(ctx.conceptIds.indexOf('c_a'))).toBe(1.0);
    }
  });

  it('never lets sensitive holdings into the secondary score (S2)', () => {
    const a = mkUser('a', { themes: [ord('c_a'), ord('c_b'), sens('c_s1')] });
    const b = mkUser('b', { themes: [ord('c_c'), ord('c_d'), sens('c_s1')] });
    const ctx = deriveContext(mkInput([a, b]));
    expect(Array.from(ctx.users[0]!.secondary)).toEqual([0, 1]);
    const leaky = deriveContext(mkInput([{ ...a, secondary: [...a.secondary, 'c_s1' as never] }, { ...b, secondary: [...b.secondary, 'c_s1' as never] }]));
    expect(secScore(leaky, 0, 1)).toBe(secScore(ctx, 0, 1));
  });
});

describe('matching components (§6.4)', () => {
  it('links cells ≤ 25 km apart, names each component by its lowest geohash, and keeps far cities apart', () => {
    const comps = matchingComponents([CELLS.far, CELLS.c, CELLS.n, CELLS.w, CELLS.e]);
    expect(comps).toHaveLength(2);
    expect(comps[0]!.cells).toEqual([CELLS.c, CELLS.e, CELLS.n, CELLS.w].sort());
    expect(comps[0]!.componentId).toBe([CELLS.c, CELLS.e, CELLS.n, CELLS.w].sort()[0]);
    expect(comps[1]).toEqual({ componentId: CELLS.far, cells: [CELLS.far] });
  });

  it('chains through intermediate cells (why components are compute shards, not areas)', () => {
    // Three cells about 11 km apart in a row: with a 12 km link the ends (22 km apart) share a component.
    const row = [10.0, 10.18, 10.36].map((lon) => encodeGeohash(56.15, lon, 5));
    expect(matchingComponents(row, 12)).toHaveLength(1);
    expect(matchingComponents(row, 5)).toHaveLength(3);
  });
});

describe('drop snapshot codec (§6.5)', () => {
  it('round-trips and drops sensitive themes without consent at decode (S3)', () => {
    const cid = (i: number) => `c_${String(i).padStart(20, '0')}`;
    const concepts = [concept(cid(1)), concept(cid(2)), concept(cid(3)), concept(cid(9), true)];
    const users = Array.from({ length: 6 }, (_, i) =>
      mkUser(`u${i}`, { uidH: `${'a'.repeat(19)}${'abcdef'[i]}`, themes: [ord(cid(1)), ord(cid(2)), ord(cid(3))] }),
    );
    const broken = { ...users[0]!, themes: [...users[0]!.themes, { c: cid(9), starred: false, sens: true } as never] };
    const snap = encodeMatchSnapshot({ weekId: WEEK, componentId: CELLS.c, profile: 'launch', dropAt: 1 }, [broken, ...users.slice(1)], concepts);
    const json = JSON.parse(JSON.stringify(snap));
    expect(matchSnapshotSchema.safeParse(json).success).toBe(true);
    const decoded = decodeMatchSnapshot(json);
    expect(decoded.droppedNoConsent).toBe(1);
    expect(decoded.input.seed).toBe(WEEK);
    expect(Array.from(decoded.input.concepts[0]!.c128)).toEqual(Array.from(concepts[0]!.c128));
    const direct = matchComponent({ ...mkInput(users, { concepts }), dropAt: 1 });
    expect(matchComponent(decoded.input).pods).toEqual(direct.pods);
  });

  it('rejects malformed snapshots', () => {
    expect(() => decodeMatchSnapshot({ v: 1, weekId: '2026-W99' as WeekId })).toThrow();
  });
});
