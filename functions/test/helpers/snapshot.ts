/** A small, valid drop input snapshot (DESIGN.md §6.5) for task tests. */
import { gzipSync } from 'node:zlib';
import {
  dropSchedule,
  encodeGeohash,
  encodeMatchSnapshot,
  uidHash,
  utf8Encode,
  type ConceptProjection,
  type MatchUser,
  type NonSensitiveConceptId,
  type WeekId,
} from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import { testUidHmac } from './keys';

export const WEEK = '2026-W46' as WeekId;
export const DROP_AT = dropSchedule(WEEK).computeAt;
export const CELL = encodeGeohash(56.1535, 10.2034, 5);
export const COMPONENT_ID = CELL;
export const C_A = 'c_aaaaaaaaaaaaaaaaaaaa';
export const C_B = 'c_bbbbbbbbbbbbbbbbbbbb';
export const C_C = 'c_cccccccccccccccccccc';

function unit(seed: number): Float32Array {
  const v = Float32Array.from({ length: 128 }, (_, i) => 1 + 0.1 * Math.sin(seed * 31 + i));
  const norm = Math.hypot(...v);
  return v.map((x) => x / norm);
}

export const CONCEPTS: ConceptProjection[] = [
  { id: C_A, c128: unit(1), sensitive: false, status: 'active', mergedInto: null },
  { id: C_B, c128: unit(2), sensitive: false, status: 'active', mergedInto: null },
  { id: C_C, c128: unit(3), sensitive: false, status: 'active', mergedInto: null },
];

export async function users(n: number): Promise<MatchUser[]> {
  return Promise.all(
    Array.from({ length: n }, async (_, i) => {
      const uid = `SnapUser${String(i).padStart(4, '0')}`;
      return {
        uid,
        uidH: await uidHash(testUidHmac, uid),
        status: 'active',
        gh5: CELL,
        birthYear: 1990 + (i % 6),
        ageMin: 18,
        ageMax: 99,
        maxKm: 25,
        sameGenderOnly: false,
        gender: null,
        languages: ['da'],
        availability: 63,
        // Three interests: the matcher's minimum (§4.3).
        themes: [C_A, C_B, C_C].map((c) => ({ c, starred: false, sens: false as const })),
        secondary: [C_A, C_B, C_C] as NonSensitiveConceptId[],
        blockedH: [],
        recentH: {},
        reliability: 0.8,
        waitingSinceWeek: WEEK,
        priority: false,
        firstTimer: true,
        openToAnyone: false,
        activePods: 0,
        activeSensitivePods: 0,
        sensitiveProposals: [],
        sensitiveHold: null,
        attendedVerified: 0,
        founderInvited: false,
        openReportCount: 0,
        weekClaim: null,
        createdAt: DROP_AT - 100 * 86_400_000,
      } satisfies MatchUser;
    }),
  );
}

/** The snapshot as `dropOrchestrator` writes it: gzipped JSON, and its sha256 as `inputHash`. */
export async function snapshotFile(n: number, o: { gzip?: boolean } = {}): Promise<{ bytes: Uint8Array; inputHash: string; uids: string[] }> {
  const u = await users(n);
  const json = JSON.stringify(encodeMatchSnapshot({ weekId: WEEK, componentId: COMPONENT_ID, profile: 'launch', dropAt: DROP_AT }, u, CONCEPTS));
  const raw = utf8Encode(json);
  const bytes = o.gzip === false ? raw : new Uint8Array(gzipSync(raw));
  return { bytes, inputHash: sha256Hex(bytes), uids: u.map((x) => x.uid) };
}
