/**
 * Synthetic city (DESIGN.md §6.9). Every number here is an assumption for simulation, not data:
 * Gaussian-mixture home locations around Aarhus, an adult age mix skewed young, Zipf–Mandelbrot interests
 * over ~2k concepts with ~5% sensitive, radii 5–25 km, 10% same-gender, a few random blocks.
 * Danish/English wording variants are assumed already merged into concepts (seed concepts, §5.2 (8)).
 */
import {
  AVAILABILITY,
  type ConceptProjection,
  defaultAgeRange,
  encodeGeohash,
  type Gender,
  getLaunchArea,
  type Language,
  type MatchingProfile,
  type RadiusKm,
} from '@grouper/core';
import { Rng, Zipf } from './rng';

export interface CityOptions {
  readonly n: number;
  readonly seed: number;
  readonly profile: MatchingProfile;
  readonly concepts?: number;
  readonly sensitiveShare?: number;
  /** Epoch ms of the first drop; accounts are created in the days before it. */
  readonly startAt: number;
  /**
   * Alpha recruiting (§6.10): testers are recruited in cohorts around this many seed themes, and each
   * user also holds one of them. The seed themes are the top-ranked concepts, kept ordinary. 0 = open recruiting.
   */
  readonly cohorts?: number;
}

export interface SimUser {
  readonly uid: string;
  readonly uidH: string;
  readonly gh5: string;
  readonly birthYear: number;
  readonly ageMin: number;
  readonly ageMax: number;
  readonly maxKm: RadiusKm;
  readonly sameGenderOnly: boolean;
  readonly gender: Gender | null;
  readonly languages: readonly Language[];
  readonly availability: number;
  /** Concept ids with starred flag and whether the holding is sensitive (always consented in the sim). */
  readonly holdings: readonly { readonly c: string; readonly starred: boolean; readonly sens: boolean }[];
  readonly openToAnyone: boolean;
  readonly founderInvited: boolean;
  readonly createdAt: number;
  blockedH: string[];
}

export interface City {
  readonly users: SimUser[];
  readonly concepts: ConceptProjection[];
}

const MIXTURE: readonly (readonly [{ lat: number; lon: number; sdKm: number }, number])[] = [
  [{ lat: 56.1535, lon: 10.2034, sdKm: 2.0 }, 0.3], // Aarhus C
  [{ lat: 56.19, lon: 10.19, sdKm: 2.5 }, 0.15], // Aarhus N / Skejby
  [{ lat: 56.125, lon: 10.16, sdKm: 2.5 }, 0.15], // Viby / Højbjerg
  [{ lat: 56.155, lon: 10.1, sdKm: 2.0 }, 0.1], // Brabrand
  [{ lat: 56.21, lon: 10.26, sdKm: 2.5 }, 0.1], // Risskov / Egå
  [{ lat: 56.235, lon: 10.24, sdKm: 1.5 }, 0.05], // Lystrup
  [{ lat: 56.17, lon: 10.1, sdKm: 2.0 }, 0.1], // Tilst / Hasselager
  [{ lat: 56.07, lon: 10.17, sdKm: 2.0 }, 0.05], // Mårslet / Beder
];

const AGE_BANDS: readonly (readonly [[number, number], number])[] = [
  [[18, 24], 0.18],
  [[25, 34], 0.3],
  [[35, 44], 0.2],
  [[45, 54], 0.14],
  [[55, 64], 0.1],
  [[65, 75], 0.08],
];

const RADII: readonly (readonly [RadiusKm, number])[] = [
  [5, 0.15],
  [10, 0.45],
  [15, 0.25],
  [25, 0.15],
];

const INTEREST_COUNTS: readonly (readonly [number, number])[] = [
  [3, 0.2],
  [4, 0.2],
  [5, 0.2],
  [6, 0.15],
  [7, 0.1],
  [8, 0.08],
  [10, 0.07],
];

const AVAILABILITY_P: readonly (readonly [number, number])[] = [
  [AVAILABILITY.weekdayDay, 0.25],
  [AVAILABILITY.weekdayEvening, 0.75],
  [AVAILABILITY.saturdayDay, 0.6],
  [AVAILABILITY.saturdayEvening, 0.5],
  [AVAILABILITY.sundayDay, 0.6],
  [AVAILABILITY.sundayEvening, 0.3],
];

const TOPICS = 40;
export const ZIPF_S = 1.0;
export const ZIPF_Q = 3;

function unit(v: Float32Array): Float32Array {
  let n = 0;
  for (const x of v) n += x * x;
  const s = 1 / Math.sqrt(n);
  for (let i = 0; i < v.length; i++) v[i]! *= s;
  return v;
}

/**
 * Concepts in topical clusters inside EmbeddingGemma 2's narrow cone [CAL]: a shared direction plus a topic
 * plus noise, so unrelated concepts sit at cos ≈ 0.81 and same-topic concepts at ≈ 0.90.
 */
export function generateConcepts(count: number, sensitiveShare: number, rng: Rng, ordinaryHead = 0): ConceptProjection[] {
  const randomUnit = (): Float32Array => unit(Float32Array.from({ length: 128 }, () => rng.normal()));
  const common = randomUnit();
  const topics = Array.from({ length: TOPICS }, randomUnit);
  return Array.from({ length: count }, (_, rank) => {
    const topic = topics[rng.int(0, TOPICS - 1)]!;
    const noise = randomUnit();
    const c128 = unit(Float32Array.from({ length: 128 }, (_, k) => 0.9 * common[k]! + 0.3 * topic[k]! + 0.316 * noise[k]!));
    const sensitive = rng.chance(sensitiveShare) && rank >= ordinaryHead;
    // Valid concept ids (c_ + 20 hex); the `_p` suffix marks the sensitive partition, as for self-flags.
    const id = `c_${rank.toString(16).padStart(20, '0')}${sensitive ? '_p' : ''}`;
    return { id, c128, sensitive, status: 'active' as const, mergedInto: null };
  });
}

function homeCell(rng: Rng, areaCells: ReadonlySet<string>): string {
  for (;;) {
    const m = rng.weighted(MIXTURE);
    const lat = m.lat + (rng.normal() * m.sdKm) / 111;
    const lon = m.lon + (rng.normal() * m.sdKm) / (111 * Math.cos((m.lat * Math.PI) / 180));
    const cell = encodeGeohash(lat, lon, 5);
    if (areaCells.has(cell)) return cell;
  }
}

const B32 = 'abcdefghijklmnopqrstuvwxyz234567';
/** A stand-in for the HMAC uidH: 20 base32 characters, unique per index. */
function pseudoUidH(i: number): string {
  let out = '';
  for (let x = i, k = 0; k < 20; k++, x = Math.floor(x / 32)) out = B32[x % 32]! + out;
  return out;
}

export function generateCity(opts: CityOptions): City {
  const rng = new Rng(opts.seed);
  const conceptCount = opts.concepts ?? 2000;
  const cohorts = opts.cohorts ?? 0;
  const concepts = generateConcepts(conceptCount, opts.sensitiveShare ?? 0.05, rng.fork('concepts'), cohorts);
  const zipf = new Zipf(conceptCount, ZIPF_S, ZIPF_Q);
  const area = getLaunchArea('aarhus');
  if (!area) throw new Error('aarhus launch area missing');
  const areaCells = new Set(area.cells);
  const startYear = new Date(opts.startAt).getUTCFullYear();
  const alpha = opts.profile.id === 'alpha';
  const r = rng.fork('users');

  const users: SimUser[] = Array.from({ length: opts.n }, (_, i) => {
    const [lo, hi] = r.weighted(AGE_BANDS);
    const age = r.int(lo, hi);
    const range = defaultAgeRange(age, opts.profile);
    // [A] 15% of users narrow their age range to ±4 years.
    const narrow = r.chance(0.15) ? { ageMin: Math.max(18, age - 4), ageMax: Math.max(18, age - 4) + 8 } : range;
    const sameGenderOnly = r.chance(0.1);
    const gender = r.weighted<Gender>([
      ['woman', 0.52],
      ['man', 0.45],
      ['nonbinary', 0.03],
    ]);
    let availability = 0;
    for (const [bit, p] of AVAILABILITY_P) if (r.chance(p)) availability |= bit;
    if (availability === 0) availability = AVAILABILITY.weekdayEvening;
    const k = r.weighted(INTEREST_COUNTS);
    const picked = new Set<number>();
    if (cohorts > 0) picked.add(r.int(0, cohorts - 1));
    while (picked.size < k) picked.add(zipf.sample(r));
    let stars = 0;
    const holdings = [...picked].map((rank) => {
      const c = concepts[rank]!;
      const starred = stars < 3 && r.chance(0.3);
      if (starred) stars++;
      return { c: c.id, starred, sens: c.sensitive };
    });
    return {
      uid: `sim${String(i).padStart(6, '0')}`,
      uidH: pseudoUidH(i),
      gh5: homeCell(r, areaCells),
      birthYear: startYear - age,
      ...narrow,
      maxKm: r.weighted(RADII),
      sameGenderOnly,
      gender: sameGenderOnly ? gender : null,
      languages: r.weighted<Language[]>([
        [['da'], 0.7],
        [['da', 'en'], 0.22],
        [['en'], 0.08],
      ]),
      availability,
      holdings,
      // Q12: opt-out in the alpha profile (assume 15% opt out), opt-in at launch (assume 25% opt in).
      openToAnyone: alpha ? r.chance(0.85) : r.chance(0.25),
      founderInvited: alpha,
      createdAt: opts.startAt - r.int(1, 3) * 86_400_000,
      blockedH: [],
    };
  });
  // [A] 0.5% of users block one random other user (stored in both profiles, H4).
  for (const u of users) {
    if (!r.chance(0.005) || users.length < 2) continue;
    const other = users[r.int(0, users.length - 1)]!;
    if (other === u) continue;
    u.blockedH.push(other.uidH);
    other.blockedH.push(u.uidH);
  }
  return { users, concepts };
}
