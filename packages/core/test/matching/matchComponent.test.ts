import { describe, expect, it } from 'vitest';
import { deriveContext } from '../../src/matching/context';
import { assertAllConstraints, MatchConstraintError } from '../../src/matching/constraints';
import { matchComponent } from '../../src/matching/matchComponent';
import { ALPHA_PROFILE, defaultAgeRange, LAUNCH_PROFILE, recentUntilWeek } from '../../src/matching/profiles';
import type { WeekId } from '../../src/types/ids';
import type { MatchUser } from '../../src/types/matching';
import { BASE_CONCEPTS, CELLS, concept, DROP_AT, mkInput, mkUser, ord, sens, WEEK } from './fixtures';

const DAY = 86_400_000;
const users = (n: number, o: (i: number) => Partial<MatchUser> = () => ({})): MatchUser[] =>
  Array.from({ length: n }, (_, i) => mkUser(`u${String(i).padStart(2, '0')}`, o(i)));
const run = (us: MatchUser[], params = LAUNCH_PROFILE.params) => matchComponent(mkInput(us, { params }));
const reasonOf = (r: ReturnType<typeof run>, uid: string) => r.unmatched.find((u) => u.uid === uid)?.reason;

describe('matchComponent scenarios', () => {
  it('forms one pod of 5 around a shared theme', () => {
    const r = run(users(5));
    expect(r.pods).toHaveLength(1);
    expect(r.pods[0]!.members).toEqual(['u00', 'u01', 'u02', 'u03', 'u04']);
    expect(r.pods[0]!.theme).toMatchObject({ kind: 'concept', sensitive: false });
    expect(r.unmatched).toEqual([]);
  });

  it('forms a pod of 4, never of 3', () => {
    expect(run(users(4)).pods[0]!.members).toHaveLength(4);
    const r = run(users(3));
    expect(r.pods).toEqual([]);
    expect(r.unmatched.map((u) => u.reason)).toEqual(['NO_THEME_BUCKET', 'NO_THEME_BUCKET', 'NO_THEME_BUCKET']);
  });

  it('adds a 6th seat at launch only when expected attendance of five is below 4.0; always in alpha', () => {
    expect(run(users(6)).pods.map((p) => p.members.length).sort()).toEqual([6]);
    // 0.8 × 5 = 4.0 is not below 4.0, so the greedy stops at 5; local search still places the 6th
    // leftover because B dominates the 0.2 size penalty.
    const reliable = run(users(7, () => ({ reliability: 0.9 })));
    expect(reliable.pods.map((p) => p.members.length)).toEqual([6]);
    expect(reliable.stats.inserts).toBe(1);
    expect(run(users(6, () => ({ reliability: 0.6 }))).stats.inserts).toBe(0);
    expect(run(users(6), ALPHA_PROFILE.params).stats.inserts).toBe(0);
  });

  it('splits 10 users into two pods', () => {
    const r = run(users(10));
    expect(r.pods.map((p) => p.members.length)).toEqual([5, 5]);
  });

  it('names the setting that blocks a user: radius, age, language, availability, same-gender', () => {
    expect(reasonOf(run([...users(5), mkUser('far', { gh5: CELLS.far })]), 'far')).toBe('RADIUS');
    expect(reasonOf(run([...users(5, () => ({ ageMin: 25, ageMax: 40 })), mkUser('old', { birthYear: 1950 })]), 'old')).toBe('AGE');
    expect(reasonOf(run([...users(5), mkUser('en', { languages: ['en'] })]), 'en')).toBe('LANGUAGE');
    expect(reasonOf(run([...users(5, () => ({ availability: 1 })), mkUser('sun', { availability: 32 })]), 'sun')).toBe('AVAILABILITY');
    expect(reasonOf(run([...users(5), mkUser('sg', { sameGenderOnly: true, gender: 'nonbinary' })]), 'sg')).toBe('GENDER_POOL');
  });

  it('never reveals blocks or pair history: a blocked user gets NO_FIT_THIS_WEEK', () => {
    const blocker = (i: number): Partial<MatchUser> => ({ blockedH: i < 4 ? ['h_x'] : [] });
    const r = run([...users(4, blocker), mkUser('x')]);
    expect(reasonOf(r, 'x')).toBe('NO_FIT_THIS_WEEK');
    const recent = run([...users(4, () => ({ recentH: { h_x: '2026-W50' as WeekId } })), mkUser('x')]);
    expect(reasonOf(recent, 'x')).toBe('NO_FIT_THIS_WEEK');
    const expired = run([...users(4, () => ({ recentH: { h_x: WEEK } })), mkUser('x')]);
    expect(expired.pods[0]!.members).toContain('x');
  });

  it('same-gender pods contain only users who declared the same gender (H3)', () => {
    const us = users(10, (i) => ({ sameGenderOnly: i < 4, gender: i % 2 === 0 ? 'woman' : 'man' }));
    const genderOf = new Map(us.map((u) => [u.uid, u.gender]));
    const r = run(us);
    for (const pod of r.pods.filter((p) => p.members.some((m) => Number(m.slice(1)) < 4))) {
      expect(new Set(pod.members.map((m) => genderOf.get(m))).size).toBe(1);
    }
  });

  it('excludes users who are not active, already claimed or at the active-pod cap, and those with too few interests', () => {
    const r = run([
      ...users(5),
      mkUser('paused', { status: 'paused' }),
      mkUser('claimed', { weekClaim: WEEK }),
      mkUser('busy', { activePods: 2 }),
      mkUser('few', { themes: [ord('c_a'), ord('c_b')] }),
    ]);
    expect(r.excluded).toEqual(['claimed', 'paused']);
    expect(reasonOf(r, 'busy')).toBe('MAX_ACTIVE_PODS');
    expect(reasonOf(r, 'few')).toBe('TOO_FEW_INTERESTS');
  });

  describe('sensitive themes', () => {
    const holder = (o: Partial<MatchUser> = {}): Partial<MatchUser> => ({ themes: [sens('c_s1'), ord('c_d'), ord('c_e')], ...o });
    const spread = (i: number): Partial<MatchUser> => holder({ themes: [sens('c_s1'), ord(`c_${'abcdef'[i % 6]}`), ord(`c_${'abcdef'[(i + 1) % 6]}`)] });

    it('need ≥ 12 eligible consenting holders nearby (S1)', () => {
      const thin = run(users(8, spread));
      expect(thin.stats.sensitivePods).toBe(0);
      expect(thin.unmatched.some((u) => u.reason === 'SENSITIVE_DENSITY')).toBe(true);
      const dense = run(users(12, spread));
      expect(dense.stats.sensitivePods).toBeGreaterThan(0);
      for (const pod of dense.pods.filter((p) => p.theme.kind === 'concept' && p.theme.sensitive)) {
        for (const r of Object.values(pod.reasons)) {
          expect(r.alsoShare).toEqual([]);
          expect(r.ageSpan).toBeNull();
        }
      }
    });

    it('require S5 eligibility: new accounts get SENSITIVE_ELIGIBILITY and fall back to ordinary themes', () => {
      const r = run(users(13, (i) => holder(i === 0 ? { createdAt: DROP_AT - 3 * DAY, themes: [sens('c_s1'), ord('c_a'), ord('c_b')] } : {})));
      expect(reasonOf(r, 'u00')).toBe('SENSITIVE_ELIGIBILITY');
      for (const pod of r.pods) expect(pod.members).not.toContain('u00');
    });

    it('waive the attendance gate for founder-invited testers in the alpha profile only', () => {
      const newbies = (i: number) => spread(i) as Partial<MatchUser>;
      const gated = users(12, (i) => ({ ...newbies(i), attendedVerified: 0, founderInvited: true }));
      expect(run(gated).stats.sensitivePods).toBe(0);
      expect(run(gated, ALPHA_PROFILE.params).stats.sensitivePods).toBeGreaterThan(0);
    });

    it('drop sensitive holdings without a consent reference (S3)', () => {
      const noConsent = users(12, (i) => ({ themes: [{ c: 'c_s1', starred: false, sens: true } as never, ord(`c_${'abcdef'[i % 6]}`), ord('c_f')] }));
      const r = run(noConsent);
      expect(r.stats.sensitivePods).toBe(0);
      expect(r.stats.droppedThemes.noConsent).toBe(12);
    });

    it('never treat a holding as sensitive when the concept partition disagrees', () => {
      const r = run(users(5, () => ({ themes: [ord('c_s1'), ord('c_a'), ord('c_b')] })));
      // Five themes plus the same five concepts in secondary.
      expect(r.stats.droppedThemes.partition).toBe(10);
      expect(r.pods.every((p) => p.theme.kind === 'concept' && !p.theme.sensitive)).toBe(true);
    });
  });

  it('resolves merged concepts to their target', () => {
    const concepts = [...BASE_CONCEPTS, concept('c_old', false, 'c_a')];
    const us = users(5, (i) => ({ themes: [ord(i < 2 ? 'c_old' : 'c_a'), ord(`c_r${i}`), ord(`c_q${i}`)] }));
    const r = matchComponent(mkInput(us, { concepts: [...concepts, ...us.flatMap((u) => u.themes.slice(1).map((t) => concept(t.c)))] }));
    expect(r.pods[0]).toMatchObject({ theme: { kind: 'concept', conceptId: 'c_a' } });
  });

  it('forms open-to-anyone pods for users who waited ≥ 2 weeks and opted in', () => {
    const lonely = (i: number, waited: boolean): Partial<MatchUser> => ({
      themes: [ord(`c_x${i}`), ord(`c_y${i}`), ord(`c_z${i}`)],
      openToAnyone: true,
      waitingSinceWeek: (waited ? '2026-W44' : '2026-W45') as WeekId,
    });
    const concepts = [...BASE_CONCEPTS, ...Array.from({ length: 5 }, (_, i) => ['x', 'y', 'z'].map((k) => concept(`c_${k}${i}`))).flat()];
    const waited = matchComponent(mkInput(users(5, (i) => lonely(i, true)), { concepts }));
    expect(waited.pods).toHaveLength(1);
    expect(waited.pods[0]!.theme).toEqual({ kind: 'openToAnyone' });
    expect(waited.stats.phase3Pods).toBe(1);
    expect(matchComponent(mkInput(users(5, (i) => lonely(i, false)), { concepts })).pods).toEqual([]);
  });

  it('gives longer-waiting users priority when there is not room for everyone', () => {
    const us = users(6, (i) => ({ waitingSinceWeek: (i === 5 ? '2026-W42' : WEEK) as WeekId, availability: 63, ageMin: 18, ageMax: 99 }));
    // Make room for five only: the sixth seat is blocked by pair history with everyone.
    const r = run(us.map((u, i) => (i === 0 ? { ...u, recentH: { h_u01: '2026-W50' as WeekId } } : u)));
    expect(r.pods.flatMap((p) => p.members)).toContain('u05');
    expect(r.pods[0]!.reasons['u05']!.priorityWeeks).toBe(4);
  });

  it('reports shared ordinary interests and the distance bucket in reason seeds', () => {
    const r = run(users(5, (i) => ({ gh5: i === 0 ? CELLS.w : CELLS.c })));
    const seed = r.pods[0]!.reasons['u00']!;
    expect(seed.alsoShare.length).toBeGreaterThan(0);
    expect(seed.alsoShare.length).toBeLessThanOrEqual(3);
    expect(seed.nearKm).toBe(10);
    expect(seed.ageSpan).toEqual({ min: 31, max: 31 });
  });
});

describe('assertAllConstraints fails closed', () => {
  it('throws with a constraint code and pod index, never a uid', () => {
    const input = mkInput([...users(5), mkUser('far', { gh5: CELLS.far })]);
    const ctx = deriveContext(input);
    const at = (uid: string) => ctx.users.findIndex((u) => u.uid === uid);
    const [a, b, c, d, e, far] = ['u00', 'u01', 'u02', 'u03', 'u04', 'far'].map(at) as [number, number, number, number, number, number];
    expect(() => assertAllConstraints(ctx, [{ members: [a, b, c], theme: 0 }])).toThrow(MatchConstraintError);
    expect(() => assertAllConstraints(ctx, [{ members: [a, b, c, d], theme: 0 }])).not.toThrow();
    let caught: unknown;
    try {
      assertAllConstraints(ctx, [{ members: [a, b, c, d], theme: 0 }, { members: [b, c, d, e], theme: 0 }]);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MatchConstraintError);
    expect((caught as MatchConstraintError).constraint).toBe('DUPLICATE');
    expect((caught as MatchConstraintError).podIndex).toBe(1);
    expect((caught as Error).message).not.toMatch(/u0|far/);
    expect(() => assertAllConstraints(ctx, [{ members: [a, b, c, far], theme: 0 }])).toThrow(/H2/);
  });

  it('rejects duplicate uids in the input', () => {
    expect(() => matchComponent(mkInput([mkUser('a'), mkUser('a')]))).toThrow(/duplicate uid/);
  });
});

describe('profiles (§6.10)', () => {
  it('default age ranges are ±7 at launch and ±13 in alpha (Q19 c), at least 18 and 5 years wide', () => {
    expect(defaultAgeRange(30, LAUNCH_PROFILE)).toEqual({ ageMin: 23, ageMax: 37 });
    expect(defaultAgeRange(30, ALPHA_PROFILE)).toEqual({ ageMin: 18, ageMax: 43 });
    expect(defaultAgeRange(18, LAUNCH_PROFILE)).toEqual({ ageMin: 18, ageMax: 25 });
  });

  it('writes H5 windows of 26/4 weeks at launch and 8/2 in alpha', () => {
    expect(recentUntilWeek(WEEK, 'coMember', LAUNCH_PROFILE)).toBe('2027-W19');
    expect(recentUntilWeek(WEEK, 'coProposed', LAUNCH_PROFILE)).toBe('2026-W50');
    expect(recentUntilWeek(WEEK, 'coMember', ALPHA_PROFILE)).toBe('2027-W01');
    expect(recentUntilWeek(WEEK, 'coProposed', ALPHA_PROFILE)).toBe('2026-W48');
  });

  it('never relaxes S1 density', () => {
    expect(ALPHA_PROFILE.params.sensitive.densityMin).toBe(12);
    expect(LAUNCH_PROFILE.params.sensitive.densityMin).toBe(12);
  });
});
