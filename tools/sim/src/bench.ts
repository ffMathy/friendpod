/**
 * matchComponent benchmark at n = 20,000 (DESIGN.md §6.4): builds a synthetic drop input snapshot with
 * realistic profile sizes, writes it gzipped as dropOrchestrator would, then runs the matcher in a fresh
 * child process (benchRun.ts) so peak RSS reflects decode + match only.
 *   npm -w tools/sim run bench -- --n 20000 --concepts 30000 --history 30 [--heap 384]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import {
  addWeeks,
  type ConsentRef,
  dropSchedule,
  encodeMatchSnapshot,
  getMatchingProfile,
  type MatchingProfileId,
  type MatchUser,
  type NonSensitiveConceptId,
  type WeekId,
} from '@grouper/core';
import { generateCity } from './city';
import { Rng } from './rng';

const { values } = parseArgs({
  options: {
    n: { type: 'string', default: '20000' },
    concepts: { type: 'string', default: '30000' },
    history: { type: 'string', default: '30' },
    profile: { type: 'string', default: 'launch' },
    seed: { type: 'string', default: '1' },
    /** V8 old-space cap for the child, e.g. 384 to mimic a 1 GiB instance; empty = Node's default. */
    heap: { type: 'string', default: '' },
  },
});

const here = dirname(fileURLToPath(import.meta.url));
const weekId = '2027-W10' as WeekId;
const profile = getMatchingProfile(values.profile as MatchingProfileId);
const n = Number(values.n);
const t0 = performance.now();
const city = generateCity({ n, seed: Number(values.seed), profile, concepts: Number(values.concepts), startAt: dropSchedule(weekId).computeAt - 60 * 86_400_000 });
const rng = new Rng(Number(values.seed)).fork('bench');
const history = Number(values.history);

// Pair history as after ~26 weeks of drops: `history` recentH entries per user, a few still active.
const users: MatchUser[] = city.users.map((u) => ({
  uid: u.uid,
  uidH: u.uidH,
  status: 'active',
  gh5: u.gh5,
  birthYear: u.birthYear,
  ageMin: u.ageMin,
  ageMax: u.ageMax,
  maxKm: u.maxKm,
  sameGenderOnly: u.sameGenderOnly,
  gender: u.gender,
  languages: u.languages,
  availability: u.availability,
  themes: u.holdings.map((h) => (h.sens ? { c: h.c, starred: h.starred, sens: true, consentRef: `ce_${u.uid}_${h.c}`.slice(0, 64) as ConsentRef } : { c: h.c, starred: h.starred, sens: false })),
  secondary: u.holdings.filter((h) => !h.sens).map((h) => h.c as NonSensitiveConceptId),
  blockedH: u.blockedH,
  recentH: Object.fromEntries(
    Array.from({ length: history }, () => [city.users[rng.int(0, n - 1)]!.uidH, addWeeks(weekId, rng.int(-4, 22))]),
  ),
  reliability: 0.6 + 0.35 * rng.next(),
  waitingSinceWeek: addWeeks(weekId, -rng.int(0, 5)),
  priority: rng.chance(0.03),
  firstTimer: rng.chance(0.5),
  openToAnyone: u.openToAnyone,
  activePods: rng.weighted([[0, 0.7], [1, 0.25], [2, 0.05]] as const),
  activeSensitivePods: 0,
  sensitiveProposals: [],
  sensitiveHold: null,
  attendedVerified: rng.int(0, 3),
  founderInvited: false,
  openReportCount: 0,
  weekClaim: null,
  createdAt: u.createdAt,
}));
const snapshot = encodeMatchSnapshot({ weekId, componentId: 'u1zr2', profile: profile.id, dropAt: dropSchedule(weekId).computeAt }, users, city.concepts);
const json = JSON.stringify(snapshot);
const gz = gzipSync(json);
const outDir = resolve(here, '../out');
mkdirSync(outDir, { recursive: true });
const file = resolve(outDir, `bench-${n}.input.json.gz`);
writeFileSync(file, gz);
const generateMs = performance.now() - t0;

const heapFlag = values.heap ? [`--max-old-space-size=${values.heap}`] : [];
const child = execFileSync(process.execPath, [...heapFlag, '--import', 'tsx', resolve(here, 'benchRun.ts'), file], { encoding: 'utf8', maxBuffer: 1 << 24 });
console.log(
  JSON.stringify(
    {
      synthetic: true,
      n,
      concepts: city.concepts.length,
      profile: profile.id,
      historyEntriesPerUser: history,
      snapshotBytes: { json: json.length, gzip: gz.length },
      generateMs: Math.round(generateMs),
      node: process.version,
      maxOldSpaceMb: values.heap || 'default',
      ...JSON.parse(child),
    },
    null,
    2,
  ),
);
