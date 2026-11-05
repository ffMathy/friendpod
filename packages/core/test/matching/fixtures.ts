import fc from 'fast-check';
import { encodeGeohash } from '../../src/geo/geohash';
import { ALPHA_PROFILE, LAUNCH_PROFILE } from '../../src/matching/profiles';
import { dropSchedule } from '../../src/time/schedule';
import type { ConsentRef, NonSensitiveConceptId, WeekId } from '../../src/types/ids';
import type { ConceptProjection, MatchInput, MatchParams, MatchTheme, MatchUser } from '../../src/types/matching';
import { xxhash32 } from '../../src/util/xxhash32';

export const WEEK = '2026-W46' as WeekId;
export const DROP_AT = dropSchedule(WEEK).computeAt;
const DAY = 86_400_000;

/** Cells around Aarhus (all within ~8 km of each other) and one in Copenhagen. */
export const CELLS = {
  c: encodeGeohash(56.1535, 10.2034, 5),
  n: encodeGeohash(56.19, 10.19, 5),
  w: encodeGeohash(56.15, 10.11, 5),
  s: encodeGeohash(56.12, 10.19, 5),
  e: encodeGeohash(56.17, 10.25, 5),
  far: encodeGeohash(55.6759, 12.5691, 5),
} as const;

function randomUnit(seed: string): Float32Array {
  const v = new Float32Array(128);
  let s = xxhash32(seed);
  let norm = 0;
  for (let i = 0; i < 128; i++) {
    s = xxhash32(String(s), i);
    v[i] = (s / 0xffffffff) * 2 - 1;
    norm += v[i]! * v[i]!;
  }
  for (let i = 0; i < 128; i++) v[i]! /= Math.sqrt(norm);
  return v;
}

const COMMON = randomUnit('common-direction');

/** Deterministic c128 in EmbeddingGemma 2's band: unrelated concepts at cos ≈ 0.8, as measured [CAL]. */
export function vec(id: string): Float32Array {
  const noise = randomUnit(id);
  const v = COMMON.map((c, i) => 0.9 * c + 0.44 * noise[i]!);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

export function concept(id: string, sensitive = false, mergedInto: string | null = null): ConceptProjection {
  return { id, c128: vec(id), sensitive, status: mergedInto ? 'merged' : 'active', mergedInto };
}

export const ord = (c: string, starred = false): MatchTheme => ({ c, starred, sens: false });
export const sens = (c: string, consentRef = `ce_${c}`): MatchTheme => ({ c, starred: false, sens: true, consentRef: consentRef as ConsentRef });

export function mkUser(uid: string, o: Partial<MatchUser> = {}): MatchUser {
  const themes = o.themes ?? [ord('c_a'), ord('c_b'), ord('c_c')];
  return {
    uid,
    uidH: `h_${uid}`,
    status: 'active',
    gh5: CELLS.c,
    birthYear: 1995,
    ageMin: 18,
    ageMax: 99,
    maxKm: 25,
    sameGenderOnly: false,
    gender: null,
    languages: ['da'],
    availability: 63,
    secondary: themes.filter((t) => !t.sens).map((t) => t.c as NonSensitiveConceptId),
    blockedH: [],
    recentH: {},
    reliability: 0.8,
    waitingSinceWeek: WEEK,
    priority: false,
    firstTimer: false,
    openToAnyone: false,
    activePods: 0,
    activeSensitivePods: 0,
    sensitiveProposals: [],
    sensitiveHold: null,
    attendedVerified: 1,
    founderInvited: false,
    openReportCount: 0,
    weekClaim: null,
    createdAt: DROP_AT - 100 * DAY,
    ...o,
    themes,
  };
}

export const BASE_CONCEPTS = [concept('c_a'), concept('c_b'), concept('c_c'), concept('c_d'), concept('c_e'), concept('c_f'), concept('c_s1', true), concept('c_s2', true)];

export function mkInput(users: MatchUser[], o: { params?: MatchParams; concepts?: ConceptProjection[]; seed?: string } = {}): MatchInput {
  return { weekId: WEEK, dropAt: DROP_AT, users, concepts: o.concepts ?? BASE_CONCEPTS, params: o.params ?? LAUNCH_PROFILE.params, seed: o.seed ?? WEEK };
}

const ORDINARY = ['c_a', 'c_b', 'c_c', 'c_d', 'c_e', 'c_f'];
const RARE = Array.from({ length: 8 }, (_, i) => `c_r${i}`);
export const ALL_CONCEPTS = [...BASE_CONCEPTS, ...RARE.map((c) => concept(c))];

/** The easy value most of the time, the hard alternative with probability `hard` percent. */
function mostly<T>(easy: T, hardArb: fc.Arbitrary<T>, hard: number): fc.Arbitrary<T> {
  const h = Math.round(hard);
  return fc.oneof({ arbitrary: fc.constant(easy), weight: 100 - h }, { arbitrary: hardArb, weight: h });
}

const userArb = (i: number, hard: number): fc.Arbitrary<MatchUser> =>
  fc
    .record({
      cell: mostly<string>(CELLS.c, fc.constantFrom(CELLS.n, CELLS.w, CELLS.s, CELLS.e, CELLS.far), hard + 20),
      birthYear: fc.integer({ min: 1975, max: 2006 }),
      range: mostly<[number, number]>([18, 99], fc.constantFrom<[number, number]>([20, 40], [30, 60], [25, 35]), hard),
      maxKm: mostly<5 | 10 | 15 | 25>(25, fc.constantFrom<5 | 10 | 15>(5, 10, 15), hard),
      sameGender: mostly(false, fc.constant(true), hard / 2),
      gender: fc.constantFrom(null, 'woman', 'man', 'nonbinary'),
      languages: mostly<('da' | 'en')[]>(['da'], fc.constantFrom<('da' | 'en')[]>(['da', 'en'], ['en']), hard),
      availability: mostly(63, fc.constantFrom(3, 12, 48, 5, 1), hard),
      ordinary: fc.subarray(ORDINARY, { minLength: 2, maxLength: 4 }),
      rare: fc.subarray(RARE, { maxLength: 3 }),
      starred: fc.subarray(ORDINARY, { maxLength: 2 }),
      sensitive: fc.constantFrom<string[]>([], ['c_s1'], ['c_s1'], ['c_s1', 'c_s2'], ['c_s2']),
      missingConsent: mostly(false, fc.constant(true), hard),
      leakSensitiveIntoSecondary: mostly(false, fc.constant(true), hard),
      reliability: fc.constantFrom(0.5, 0.7, 0.8, 0.9),
      waited: fc.integer({ min: 0, max: 6 }),
      priority: mostly(false, fc.constant(true), 15),
      firstTimer: fc.boolean(),
      openToAnyone: fc.boolean(),
      activePods: mostly(0, fc.constantFrom(1, 2), hard),
      attendedVerified: mostly(1, fc.constant(0), hard),
      newAccount: mostly(false, fc.constant(true), hard),
      founderInvited: fc.boolean(),
      openReportCount: mostly(0, fc.constant(1), hard / 2),
      blocked: mostly<number[]>([], fc.subarray([0, 1, 2, 3, 4, 5, 6, 7], { minLength: 1, maxLength: 2 }), hard),
      recent: mostly<number[]>([], fc.subarray([0, 1, 2, 3, 4, 5, 6, 7], { minLength: 1, maxLength: 2 }), hard),
      claimed: mostly(false, fc.constant(true), hard / 4),
      status: mostly<MatchUser['status']>('active', fc.constant('paused'), hard / 4),
    })
    .map((r) => {
      const uid = `u${String(i).padStart(3, '0')}`;
      const themes: MatchTheme[] = [
        ...[...r.ordinary, ...r.rare].map((c) => ord(c, r.starred.includes(c))),
        // A sensitive holding without a consent reference must be dropped (S3).
        ...r.sensitive.map((c) => (r.missingConsent && c === 'c_s2' ? ({ c, starred: false, sens: true } as unknown as MatchTheme) : sens(c))),
      ];
      const secondary = [...r.ordinary, ...r.rare, ...(r.leakSensitiveIntoSecondary ? r.sensitive : [])] as NonSensitiveConceptId[];
      const sameGenderOnly = r.sameGender && r.gender !== null;
      return mkUser(uid, {
        gh5: r.cell,
        birthYear: r.birthYear,
        ageMin: r.range[0],
        ageMax: r.range[1],
        maxKm: r.maxKm,
        sameGenderOnly,
        gender: sameGenderOnly ? (r.gender as MatchUser['gender']) : null,
        languages: r.languages,
        availability: r.availability,
        themes,
        secondary,
        reliability: r.reliability,
        waitingSinceWeek: `2026-W${String(46 - r.waited).padStart(2, '0')}` as WeekId,
        priority: r.priority,
        firstTimer: r.firstTimer,
        openToAnyone: r.openToAnyone,
        activePods: r.activePods,
        attendedVerified: r.attendedVerified,
        founderInvited: r.founderInvited,
        createdAt: r.newAccount ? DROP_AT - 3 * DAY : DROP_AT - 100 * DAY,
        openReportCount: r.openReportCount,
        blockedH: r.blocked.map((j) => `h_u${String(j).padStart(3, '0')}`),
        recentH: Object.fromEntries(r.recent.map((j) => [`h_u${String(j).padStart(3, '0')}`, '2026-W50' as WeekId])),
        weekClaim: r.claimed ? WEEK : null,
        status: r.status,
      });
    });

/**
 * Small random components with every constraint in play, including S3/S2 violations in the raw input.
 * Each input draws a hardness (percent of users with a restrictive setting), so both crowded and
 * starved components appear.
 */
export const matchInputArb: fc.Arbitrary<MatchInput> = fc
  .tuple(
    fc.integer({ min: 0, max: 40 }),
    fc.constantFrom(5, 20, 50),
    fc.constantFrom(LAUNCH_PROFILE.params, ALPHA_PROFILE.params),
    fc.string({ minLength: 1, maxLength: 8 }),
  )
  .chain(([n, hard, params, seed]) =>
    fc.tuple(...Array.from({ length: n }, (_, i) => userArb(i, hard))).map((users) => mkInput(users, { params, seed, concepts: ALL_CONCEPTS })),
  );
