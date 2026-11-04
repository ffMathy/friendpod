import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeGeohash, geohashCentroid } from '../../src/geo/geohash';
import { cellDistanceKm, haversineKm } from '../../src/geo/haversine';
import { matchComponent } from '../../src/matching/matchComponent';
import { parseWeekId, weeksBetween } from '../../src/time/weekId';
import type { MatchInput, MatchResult, MatchUser } from '../../src/types/matching';
import { matchInputArb } from './fixtures';

const DAY = 86_400_000;

/**
 * An independent re-statement of DESIGN.md §6.1 over the raw input (it shares no code with the matcher's
 * constraint module), so a bug there cannot hide itself.
 */
function referenceCheck(input: MatchInput, result: MatchResult): void {
  const p = input.params;
  const byUid = new Map(input.users.map((u) => [u.uid, u]));
  const sensitiveConcepts = new Set(input.concepts.filter((c) => c.sensitive).map((c) => c.id));
  const year = parseWeekId(input.weekId).year;
  const age = (u: MatchUser): number => year - u.birthYear;
  const validThemes = (u: MatchUser) =>
    u.themes.filter((t) => t.sens === sensitiveConcepts.has(t.c) && (!t.sens || (typeof t.consentRef === 'string' && t.consentRef.length > 0)));
  const s5 = (u: MatchUser): boolean => {
    const sensCount = new Set(validThemes(u).filter((t) => t.sens).map((t) => t.c)).size;
    const proposals = u.sensitiveProposals.filter((w) => weeksBetween(w, input.weekId) >= 0 && weeksBetween(w, input.weekId) < 12).length;
    return (
      input.dropAt - u.createdAt >= p.sensitive.minAccountAgeDays * DAY &&
      (u.attendedVerified >= p.sensitive.minVerifiedAttended || (p.sensitive.waiveActivityForFounderInvited && u.founderInvited)) &&
      u.openReportCount === 0 &&
      (u.sensitiveHold === null || input.dropAt >= u.sensitiveHold.until) &&
      u.activeSensitivePods === 0 &&
      proposals < p.sensitive.maxProposalsPer12Weeks &&
      sensCount <= p.sensitive.maxHoldings
    );
  };
  const eligible = (u: MatchUser): boolean =>
    u.status === 'active' && u.weekClaim !== input.weekId && u.activePods < p.maxActivePods && new Set(validThemes(u).map((t) => t.c)).size >= p.minInterests;
  const compatible = (a: MatchUser, b: MatchUser): boolean => {
    const recent = (x: MatchUser, y: MatchUser) => (x.recentH[y.uidH] ?? '') > input.weekId;
    return (
      age(a) >= b.ageMin && age(a) <= b.ageMax && age(b) >= a.ageMin && age(b) <= a.ageMax &&
      cellDistanceKm(a.gh5, b.gh5) <= Math.min(a.maxKm, b.maxKm) &&
      (!(a.sameGenderOnly || b.sameGenderOnly) || (a.gender !== null && a.gender === b.gender)) &&
      !a.blockedH.includes(b.uidH) && !b.blockedH.includes(a.uidH) && !recent(a, b) && !recent(b, a) &&
      a.languages.some((l) => b.languages.includes(l))
    );
  };

  const seen = new Set<string>();
  for (const pod of result.pods) {
    const members = pod.members.map((uid) => byUid.get(uid)!);
    expect(members.length).toBeGreaterThanOrEqual(4);
    expect(members.length).toBeLessThanOrEqual(6);
    for (const m of members) {
      expect(seen.has(m.uid), 'at most one new pod per user').toBe(false);
      seen.add(m.uid);
      expect(eligible(m)).toBe(true);
    }
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) expect(compatible(members[i]!, members[j]!)).toBe(true);
    expect(members.reduce((a, m) => a & m.availability, 63)).not.toBe(0);

    if (pod.theme.kind === 'openToAnyone') {
      for (const m of members) {
        expect(m.openToAnyone).toBe(true);
        expect(weeksBetween(m.waitingSinceWeek, input.weekId)).toBeGreaterThanOrEqual(p.openToAnyone.minWeeksWaiting);
      }
    } else {
      const theme = pod.theme;
      expect(theme.sensitive).toBe(sensitiveConcepts.has(theme.conceptId));
      for (const m of members) {
        // Every member holds the theme; a sensitive theme only with a consent reference (S1, S3) and S5.
        const holding = validThemes(m).find((t) => t.c === theme.conceptId);
        expect(holding, `${m.uid} holds ${theme.conceptId}`).toBeDefined();
        if (theme.sensitive) {
          expect(holding!.sens && holding!.consentRef.length > 0).toBe(true);
          expect(s5(m)).toBe(true);
        }
      }
      if (theme.sensitive) {
        // S1: ≥ 12 eligible consenting holders within 25 km of the pod's centroid cell.
        const lat = members.reduce((s, m) => s + geohashCentroid(m.gh5).lat, 0) / members.length;
        const lon = members.reduce((s, m) => s + geohashCentroid(m.gh5).lon, 0) / members.length;
        const podCell = geohashCentroid(encodeGeohash(lat, lon, 5));
        const holders = input.users.filter(
          (u) => eligible(u) && s5(u) && validThemes(u).some((t) => t.c === theme.conceptId) && haversineKm(podCell, geohashCentroid(u.gh5)) <= p.sensitive.densityKm,
        );
        expect(holders.length).toBeGreaterThanOrEqual(p.sensitive.densityMin);
      }
    }

    for (const [uid, r] of Object.entries(pod.reasons)) {
      const m = byUid.get(uid)!;
      // S2: sensitive holdings never reach explanations; sensitive themes carry no age span or shared interests.
      for (const c of r.alsoShare) {
        expect(sensitiveConcepts.has(c)).toBe(false);
        expect(m.secondary).toContain(c);
      }
      if (pod.theme.kind === 'concept' && pod.theme.sensitive) {
        expect(r.alsoShare).toEqual([]);
        expect(r.ageSpan).toBeNull();
      }
    }
  }
  const unmatched = new Set(result.unmatched.map((u) => u.uid));
  const excluded = new Set(result.excluded);
  for (const u of input.users) {
    const placed = seen.has(u.uid);
    expect([placed, unmatched.has(u.uid), excluded.has(u.uid)].filter(Boolean)).toHaveLength(1);
  }
}

function shuffle<T>(items: readonly T[], keys: readonly number[]): T[] {
  return items
    .map((item, i) => ({ item, k: keys[i % Math.max(1, keys.length)]! + i / 1e6 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}

describe('matchComponent properties (§6.9 Tests)', () => {
  it('never violates a hard or pod-level constraint (H1–H6, sizes, ≤ 1 pod per user, S1/S3/S5, S2 in reasons)', () => {
    fc.assert(
      fc.property(matchInputArb, (input) => {
        referenceCheck(input, matchComponent(input));
      }),
      { numRuns: 300 },
    );
  });

  it('is deterministic: same input and seed give identical output', () => {
    fc.assert(
      fc.property(matchInputArb, (input) => {
        expect(matchComponent(input)).toEqual(matchComponent(input));
      }),
      { numRuns: 100 },
    );
  });

  it('is independent of input order', () => {
    fc.assert(
      fc.property(matchInputArb, fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 1, maxLength: 50 }), (input, keys) => {
        const permuted = { ...input, users: shuffle(input.users, keys), concepts: shuffle(input.concepts, [...keys].reverse()) };
        expect(matchComponent(permuted)).toEqual(matchComponent(input));
      }),
      { numRuns: 100 },
    );
  });

  it('ignores sensitive concepts smuggled into secondary (S2): the result is as if they were absent', () => {
    fc.assert(
      fc.property(matchInputArb, (input) => {
        const sensitive = new Set(input.concepts.filter((c) => c.sensitive).map((c) => c.id));
        const clean = { ...input, users: input.users.map((u) => ({ ...u, secondary: u.secondary.filter((c) => !sensitive.has(c)) })) };
        const a = matchComponent(input);
        const b = matchComponent(clean);
        expect(a.pods).toEqual(b.pods);
        expect(a.unmatched).toEqual(b.unmatched);
      }),
      { numRuns: 100 },
    );
  });
});

describe('property-test coverage', () => {
  it('the arbitrary exercises sensitive, open-to-anyone and every pod size (guards against vacuous properties)', () => {
    const totals = { sensitive: 0, open: 0, s4: 0, s5: 0, s6: 0, noConsent: 0 };
    for (const input of fc.sample(matchInputArb, { numRuns: 300, seed: 42 })) {
      const r = matchComponent(input);
      totals.sensitive += r.stats.sensitivePods;
      totals.open += r.stats.openToAnyonePods;
      totals.s4 += r.stats.podsBySize[4] ?? 0;
      totals.s5 += r.stats.podsBySize[5] ?? 0;
      totals.s6 += r.stats.podsBySize[6] ?? 0;
      totals.noConsent += r.stats.droppedThemes.noConsent;
    }
    for (const [k, v] of Object.entries(totals)) expect(v, k).toBeGreaterThan(0);
  });
});
