import { geohashCentroid } from '../geo/geohash';
import { haversineKm } from '../geo/haversine';
import type { UnmatchedReason } from '../reasons';
import { parseWeekId, weeksBetween } from '../time/weekId';
import type { ConceptProjection, MatchInput, MatchParams, MatchUser } from '../types/matching';
import type { Gender } from '../types/domain';
import type { WeekId } from '../types/ids';
import { xxhash32 } from '../util/xxhash32';
import { specificity, themeStrength, waitingPriority } from './score';

/** Theme reference inside the matcher: a concept index, or OPEN_THEME for "open to anyone" (Q12). */
export const OPEN_THEME = -1;

const DAY_MS = 86_400_000;

/** Bit 1 = Danish, bit 2 = English (H6 is a non-zero AND). */
export type LanguageMask = 0 | 1 | 2 | 3;

export interface DerivedUser {
  readonly idx: number;
  readonly uid: string;
  readonly uidH: string;
  readonly cell: number;
  readonly age: number;
  readonly ageMin: number;
  readonly ageMax: number;
  readonly maxKm: number;
  readonly sameGenderOnly: boolean;
  readonly gender: Gender | null;
  readonly langMask: LanguageMask;
  readonly avail: number;
  /** Eligible theme candidates (S3 consent, S5 eligibility applied): concept index → s(u,t). */
  readonly themeS: ReadonlyMap<number, number>;
  /** Eligible themes, sorted by concept index. */
  readonly themes: readonly number[];
  /** Sensitive concepts held with consent, eligible or not (for reason codes only). */
  readonly heldSensitive: readonly number[];
  /** Ordinary holdings' concept indices, sorted (S2). */
  readonly secondary: Int32Array;
  /** normalize(Σ c128 of secondary), or null without ordinary holdings. */
  readonly p: Float32Array | null;
  readonly blocked: ReadonlySet<string>;
  /** Active H5 entries (untilWeek after this drop's week). */
  readonly recent: ReadonlySet<string>;
  readonly tie: number;
  readonly weeksWaiting: number;
  readonly f: number;
  readonly r: number;
  readonly openToAnyone: boolean;
  readonly s5Eligible: boolean;
  /** Why the user cannot be placed at all this week; null if eligible. 'excluded' users get no reason code. */
  readonly ineligible: UnmatchedReason | 'excluded' | null;
}

export interface MatchContext {
  readonly params: MatchParams;
  readonly weekId: WeekId;
  readonly users: readonly DerivedUser[];
  readonly cells: readonly string[];
  readonly conceptIds: readonly string[];
  readonly conceptSensitive: Uint8Array;
  /** Eligible holders of each theme by cell, each list ordered by (tie, idx). */
  readonly holders: ReadonlyMap<number, ReadonlyMap<number, readonly number[]>>;
  readonly holderCount: Int32Array;
  readonly openHolders: ReadonlyMap<number, readonly number[]>;
  /** Cells within `km` of a cell, nearest first; precomputed for every radius in use. */
  cellsWithin(cell: number, km: number): readonly number[];
  distKm(a: number, b: number): number;
  themeQ(theme: number): number;
  themeS(user: number, theme: number): number;
  readonly dropped: { noConsent: number; partition: number; unknownConcept: number };
}

function resolveConcepts(concepts: readonly ConceptProjection[]) {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const active = [...concepts].filter((c) => c.status === 'active').sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const index = new Map(active.map((c, i) => [c.id, i]));
  /** Follows `mergedInto` to an active concept (§5.2 (8)); null if the chain is broken or cyclic. */
  const resolve = (id: string): number | null => {
    let cur = byId.get(id);
    for (let hops = 0; cur && hops < 16; hops++) {
      if (cur.status === 'active') return index.get(cur.id) ?? null;
      cur = cur.mergedInto ? byId.get(cur.mergedInto) : undefined;
    }
    return null;
  };
  return { active, resolve };
}

function s5Eligible(u: MatchUser, sensitiveCount: number, input: MatchInput): boolean {
  const s = input.params.sensitive;
  const accountOldEnough = input.dropAt - u.createdAt >= s.minAccountAgeDays * DAY_MS;
  const activityOk = u.attendedVerified >= s.minVerifiedAttended || (s.waiveActivityForFounderInvited && u.founderInvited);
  const recentProposals = u.sensitiveProposals.filter((w) => {
    const ago = weeksBetween(w, input.weekId);
    return ago >= 0 && ago < 12;
  }).length;
  return (
    accountOldEnough &&
    activityOk &&
    u.openReportCount === 0 &&
    u.sensitiveHold === null &&
    u.activeSensitivePods === 0 &&
    // "≤ 3 sensitive-themed proposals in the last 12 weeks": a new one must not exceed the cap.
    recentProposals < s.maxProposalsPer12Weeks &&
    sensitiveCount <= s.maxHoldings
  );
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** derive(U) of §6.3: sorts by uid, resolves concepts, applies S3/S5, builds indexes. Pure. */
export function deriveContext(input: MatchInput): MatchContext {
  const p = input.params;
  const sorted = [...input.users].sort((a, b) => cmp(a.uid, b.uid));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.uid === sorted[i - 1]!.uid) throw new Error('matchComponent: duplicate uid in input');
  }
  const { active, resolve } = resolveConcepts(input.concepts);
  const conceptSensitive = Uint8Array.from(active.map((c) => (c.sensitive ? 1 : 0)));
  const dropYear = parseWeekId(input.weekId).year;
  const dropped = { noConsent: 0, partition: 0, unknownConcept: 0 };

  const cells = [...new Set(sorted.map((u) => u.gh5))].sort(cmp);
  const cellIndex = new Map(cells.map((c, i) => [c, i]));
  const centroids = cells.map((c) => geohashCentroid(c));
  const nc = cells.length;
  const dist = new Float64Array(nc * nc);
  for (let i = 0; i < nc; i++) {
    for (let j = i + 1; j < nc; j++) {
      const d = haversineKm(centroids[i]!, centroids[j]!);
      dist[i * nc + j] = d;
      dist[j * nc + i] = d;
    }
  }
  const distKm = (a: number, b: number): number => dist[a * nc + b]!;

  const users: DerivedUser[] = sorted.map((u, idx) => {
    const themeS = new Map<number, number>();
    const heldSensitive: number[] = [];
    const seen = new Set<number>();
    let sensitiveCount = 0;
    for (const t of u.themes) {
      const ci = resolve(t.c);
      if (ci === null) {
        dropped.unknownConcept++;
        continue;
      }
      if (t.sens !== (conceptSensitive[ci] === 1)) {
        dropped.partition++;
        continue;
      }
      // S3: a sensitive holding without a valid consent reference is dropped (defensive filter).
      if (t.sens && !(typeof t.consentRef === 'string' && t.consentRef.length > 0)) {
        dropped.noConsent++;
        continue;
      }
      if (seen.has(ci)) continue;
      seen.add(ci);
      if (t.sens) {
        sensitiveCount++;
        heldSensitive.push(ci);
      }
      themeS.set(ci, Math.max(themeS.get(ci) ?? 0, themeStrength(t.starred)));
    }
    const eligibleS5 = s5Eligible(u, sensitiveCount, input);
    if (!eligibleS5) for (const ci of heldSensitive) themeS.delete(ci);

    const secondarySet = new Set<number>();
    for (const c of u.secondary) {
      const ci = resolve(c);
      if (ci === null) continue;
      // S2: secondary is typed as non-sensitive; a sensitive concept here is dropped, never scored.
      if (conceptSensitive[ci] === 1) {
        dropped.partition++;
        continue;
      }
      secondarySet.add(ci);
    }
    const secondary = Int32Array.from([...secondarySet].sort((a, b) => a - b));
    let pVec: Float32Array | null = null;
    if (secondary.length > 0) {
      pVec = new Float32Array(active[0]?.c128.length ?? 128);
      for (const ci of secondary) {
        const v = active[ci]!.c128;
        for (let k = 0; k < pVec.length; k++) pVec[k]! += v[k]!;
      }
      let norm = 0;
      for (let k = 0; k < pVec.length; k++) norm += pVec[k]! * pVec[k]!;
      norm = Math.sqrt(norm);
      if (norm > 0) for (let k = 0; k < pVec.length; k++) pVec[k]! /= norm;
      else pVec = null;
    }

    const weeksWaiting = Math.max(0, weeksBetween(u.waitingSinceWeek, input.weekId));
    let ineligible: DerivedUser['ineligible'] = null;
    if (u.status !== 'active' || u.weekClaim === input.weekId) ineligible = 'excluded';
    else if (u.activePods >= p.maxActivePods) ineligible = 'MAX_ACTIVE_PODS';
    else if (seen.size < p.minInterests) ineligible = 'TOO_FEW_INTERESTS';

    return {
      idx,
      uid: u.uid,
      uidH: u.uidH,
      cell: cellIndex.get(u.gh5)!,
      age: dropYear - u.birthYear,
      ageMin: u.ageMin,
      ageMax: u.ageMax,
      maxKm: u.maxKm,
      sameGenderOnly: u.sameGenderOnly,
      gender: u.gender,
      langMask: ((u.languages.includes('da') ? 1 : 0) | (u.languages.includes('en') ? 2 : 0)) as LanguageMask,
      avail: u.availability,
      themeS,
      themes: [...themeS.keys()].sort((a, b) => a - b),
      heldSensitive: heldSensitive.sort((a, b) => a - b),
      secondary,
      p: pVec,
      blocked: new Set(u.blockedH),
      recent: new Set(Object.entries(u.recentH).filter(([, until]) => input.weekId < until).map(([h]) => h)),
      tie: xxhash32(`${input.seed}:${u.uid}`),
      weeksWaiting,
      f: waitingPriority(weeksWaiting, u.priority),
      r: u.reliability,
      openToAnyone: u.openToAnyone,
      s5Eligible: eligibleS5,
      ineligible,
    };
  });

  const byTie = (a: number, b: number): number => users[a]!.tie - users[b]!.tie || a - b;
  const holders = new Map<number, Map<number, number[]>>();
  const holderCount = new Int32Array(active.length);
  const openHolders = new Map<number, number[]>();
  let eligibleCount = 0;
  for (const u of users) {
    if (u.ineligible !== null) continue;
    eligibleCount++;
    for (const t of u.themes) {
      let byCell = holders.get(t);
      if (!byCell) holders.set(t, (byCell = new Map()));
      let list = byCell.get(u.cell);
      if (!list) byCell.set(u.cell, (list = []));
      list.push(u.idx);
      holderCount[t]!++;
    }
    if (p.openToAnyone.enabled && u.openToAnyone && u.weeksWaiting >= p.openToAnyone.minWeeksWaiting) {
      let list = openHolders.get(u.cell);
      if (!list) openHolders.set(u.cell, (list = []));
      list.push(u.idx);
    }
  }
  for (const byCell of holders.values()) for (const list of byCell.values()) list.sort(byTie);
  for (const list of openHolders.values()) list.sort(byTie);

  const q = Float64Array.from(holderCount, (h) => specificity(h, eligibleCount));
  const within = new Map<number, number[][]>();
  const cellsWithin = (cell: number, km: number): readonly number[] => {
    let perCell = within.get(km);
    if (!perCell) {
      perCell = cells.map((_, c) =>
        cells
          .map((__, o) => o)
          .filter((o) => distKm(c, o) <= km)
          .sort((a, b) => distKm(c, a) - distKm(c, b) || a - b),
      );
      within.set(km, perCell);
    }
    return perCell[cell]!;
  };

  return {
    params: p,
    weekId: input.weekId,
    users,
    cells,
    conceptIds: active.map((c) => c.id),
    conceptSensitive,
    holders,
    holderCount,
    openHolders,
    cellsWithin,
    distKm,
    themeQ: (theme) => (theme === OPEN_THEME ? p.openToAnyone.q : q[theme]!),
    themeS: (user, theme) => (theme === OPEN_THEME ? 0.8 : (users[user]!.themeS.get(theme) ?? 0)),
    dropped,
  };
}
