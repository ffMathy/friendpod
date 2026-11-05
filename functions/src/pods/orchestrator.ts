/**
 * dropOrchestrator (DESIGN.md §4.1, §6.4, §6.5, §10.3): Thursday 16:00. Reads the opted-in profiles of live and beta
 * areas once, projects the concepts they reference, splits each group into matching components (union-find over
 * cells ≤ 25 km apart), and freezes one gzipped input snapshot per component (create-if-absent: a retry reuses the
 * frozen file and its hash). Then one `matchComponent` task per component (beta components as dry runs) and the
 * `releaseDrop` task for 18:00. Every id is deterministic, so a retried run enqueues nothing twice.
 */
import { gzipSync } from 'node:zlib';
import {
  LAUNCH_AREAS,
  areaDocFromConfig,
  getLaunchArea,
  LONG_TASK_DISPATCH_DEADLINE_SECONDS,
  dropSchedule,
  encodeMatchSnapshot,
  matchingComponents,
  uidHash,
  utf8Encode,
  weekIdAt,
  type ConceptProjection,
  type Gh5,
  type LaunchAreaStatus,
  type MatchTheme,
  type MatchUser,
  type MatchingProfileId,
  type WeekId,
} from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import { FieldPath } from 'firebase-admin/firestore';
import { grpcCode } from '../lib/errors';
import { docs, matchProfiles, PATHS } from '../lib/firestore';
import { participatesIn } from '../lib/participation';
import type { AppDeps } from '../lib/runtime';
import type { DropObjectStore } from '../lib/storage';
import { taskId } from '../lib/tasks';
import type { ProfileDoc } from './context';

export interface OrchestratorDeps extends AppDeps {
  readonly drops: DropObjectStore;
}

const PAGE = 500;
const CONCEPT_CHUNK = 300;
const C128_DIM = 128;
const GRPC_ALREADY_EXISTS = 6;
/** `dispatchDeadlineSeconds` for the long tasks (§10.3). */
export const MATCH_DISPATCH_DEADLINE_S = LONG_TASK_DISPATCH_DEADLINE_SECONDS;

export function inputPath(weekId: WeekId, componentId: string): string {
  return `${weekId}/${componentId}.input.json.gz`;
}

/** Whether a profile takes part in this week's drop, from the participation mirrored on matchProfiles (§10.1). */
export function profileParticipates(p: ProfileDoc, weekId: WeekId, now: number): boolean {
  const pausedUntil = p.participation.pausedUntil?.toMillis() ?? null;
  return participatesIn(
    {
      status: p.status,
      mode: p.participation.mode,
      skipWeekId: p.participation.skipWeekId,
      optInWeekId: p.participation.optInWeekId,
      pausedUntil,
      // Only a user's own pause carries an end date; an automated pause has none and is not lifted here.
      pauseReason: p.status === 'paused' && pausedUntil !== null ? 'user' : null,
    },
    weekId,
    now,
  );
}

export async function matchUserOf(uid: string, p: ProfileDoc, uidH: string): Promise<MatchUser> {
  return {
    uid,
    uidH,
    status: 'active',
    gh5: p.gh5 as Gh5,
    birthYear: p.birthYear,
    ageMin: p.ageMin,
    ageMax: p.ageMax,
    maxKm: p.maxKm,
    sameGenderOnly: p.sameGenderOnly,
    gender: p.gender,
    languages: p.languages,
    availability: p.availability,
    themes: p.themes as unknown as MatchTheme[],
    secondary: p.secondary as unknown as MatchUser['secondary'],
    blockedH: p.blockedH,
    recentH: p.recentH,
    reliability: p.reliability,
    waitingSinceWeek: p.waitingSinceWeek,
    priority: p.priority,
    firstTimer: p.milestones.firstConfirmedAt === undefined,
    openToAnyone: p.openToAnyone,
    activePods: p.activePods,
    activeSensitivePods: p.activeSensitivePods,
    sensitiveProposals: p.sensitiveProposals,
    sensitiveHold: p.sensitiveHold ? { reason: p.sensitiveHold.reason, since: p.sensitiveHold.since.toMillis(), until: p.sensitiveHold.until.toMillis() } : null,
    attendedVerified: p.attendedVerified,
    founderInvited: p.founderInvited,
    openReportCount: p.openReportCount,
    weekClaim: p.weekClaim,
    createdAt: p.createdAt.toMillis(),
  } as MatchUser;
}

function c128Of(value: unknown): Float32Array | null {
  const bytes = value instanceof Uint8Array ? value : (value as { toUint8Array?: () => Uint8Array } | null)?.toUint8Array?.();
  if (!bytes || bytes.length !== C128_DIM * 4) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Float32Array.from({ length: C128_DIM }, (_, i) => view.getFloat32(i * 4, true));
}

/** The concepts the profiles reference, projected with `select(c128, sensitive, status, mergedInto)` (§6.4). */
async function projectConcepts(deps: AppDeps, ids: ReadonlySet<string>): Promise<Map<string, ConceptProjection>> {
  const out = new Map<string, ConceptProjection>();
  let wanted = [...ids].sort();
  for (let round = 0; round < 4 && wanted.length > 0; round++) {
    const next = new Set<string>();
    for (let i = 0; i < wanted.length; i += CONCEPT_CHUNK) {
      const refs = wanted.slice(i, i + CONCEPT_CHUNK).map((id) => deps.db.doc(PATHS.concept(id)));
      const snaps = await deps.db.getAll(...refs, { fieldMask: ['c128', 'sensitive', 'status', 'mergedInto'] });
      for (const s of snaps) {
        if (!s.exists) continue;
        const c128 = c128Of(s.get('c128'));
        if (!c128) continue;
        const mergedInto = (s.get('mergedInto') as string | undefined) ?? null;
        out.set(s.id, { id: s.id as ConceptProjection['id'], c128, sensitive: s.get('sensitive') === true, status: s.get('status') === 'merged' ? 'merged' : 'active', mergedInto: mergedInto as ConceptProjection['mergedInto'] });
        if (mergedInto && !out.has(mergedInto) && !ids.has(mergedInto)) next.add(mergedInto);
      }
    }
    wanted = [...next].sort();
  }
  return out;
}

export interface OrchestrateResult {
  readonly outcome: 'skipped' | 'noAreas' | 'orchestrated';
  readonly components: number;
  readonly users: number;
  [key: string]: string | number;
}

export async function orchestrateDrop(deps: OrchestratorDeps, now: number): Promise<OrchestrateResult> {
  const weekId = weekIdAt(now);
  const schedule = dropSchedule(weekId);
  const refs = docs(deps.db);
  const config = (await deps.db.doc(PATHS.configApp()).get()).data() as { skipWeeks?: unknown } | undefined;
  if (Array.isArray(config?.skipWeeks) && config.skipWeeks.includes(weekId)) return { outcome: 'skipped', components: 0, users: 0 };

  // Area status from the area docs (go-live is an admin change), else areas.json.
  const areaSnaps = await deps.db.getAll(...LAUNCH_AREAS.map((a) => deps.db.doc(PATHS.area(a.id))));
  const areas = LAUNCH_AREAS.map((a, i) => {
    const d = areaSnaps[i]!.data() as { status?: LaunchAreaStatus; profile?: MatchingProfileId } | undefined;
    return { id: a.id, status: d?.status ?? a.status, profile: d?.profile ?? a.profile };
  });
  const matched = areas.filter((a) => a.status === 'live' || a.status === 'beta');
  if (matched.length === 0) return { outcome: 'noAreas', components: 0, users: 0 };
  const areaById = new Map(matched.map((a) => [a.id, a]));

  const hmac = deps.uidHmac();
  const users: { user: MatchUser; areaId: string }[] = [];
  // Ordinary holders per concept per area, for the area chips (every onboarded profile, not only this week's).
  const holders = new Map<string, Map<string, number>>();
  for (let i = 0; i < matched.length; i += 30) {
    const ids = matched.slice(i, i + 30).map((a) => a.id);
    let after: string | null = null;
    for (;;) {
      let q = matchProfiles(deps.db).where('areaId', 'in', ids).orderBy(FieldPath.documentId()).limit(PAGE);
      if (after) q = q.startAfter(after);
      const page = await q.get();
      for (const d of page.docs) {
        const p = d.data();
        if (p.areaId !== null && p.status !== 'deleting') {
          let m = holders.get(p.areaId);
          if (!m) holders.set(p.areaId, (m = new Map()));
          for (const c of new Set(p.secondary)) m.set(c, (m.get(c) ?? 0) + 1);
        }
        if (p.areaId === null || !profileParticipates(p, weekId, now)) continue;
        users.push({ user: await matchUserOf(d.id, p, await uidHash(hmac, d.id)), areaId: p.areaId });
      }
      if (page.size < PAGE) break;
      after = page.docs[page.docs.length - 1]!.id;
    }
  }
  const conceptIds = new Set(users.flatMap(({ user }) => [...user.themes.map((t) => t.c as string), ...(user.secondary as readonly string[])]));
  const concepts = await projectConcepts(deps, conceptIds);

  let componentCount = 0;
  for (const dryRun of [false, true]) {
    const group = users.filter(({ areaId }) => (areaById.get(areaId)!.status === 'beta') === dryRun);
    for (const comp of matchingComponents(group.map(({ user }) => user.gh5))) {
      const cells = new Set<string>(comp.cells);
      const members = group.filter(({ user }) => cells.has(user.gh5)).sort((a, b) => (a.user.uid < b.user.uid ? -1 : 1));
      // The profile of the component's areas; with several, the one most of its users live in (ties by area id).
      const votes = new Map<string, number>();
      for (const { areaId } of members) votes.set(areaId, (votes.get(areaId) ?? 0) + 1);
      const [topArea] = [...votes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]!;
      const used = new Set(members.flatMap(({ user }) => [...user.themes.map((t) => t.c as string), ...(user.secondary as readonly string[])]));
      // Follow merge chains so the matcher can resolve merged concepts (§5.2 (8)).
      for (const id of [...used]) for (let c = concepts.get(id); c?.mergedInto; c = concepts.get(c.mergedInto)) used.add(c.mergedInto);
      const snapshot = encodeMatchSnapshot(
        { weekId, componentId: comp.componentId, profile: areaById.get(topArea)!.profile, dropAt: schedule.computeAt },
        members.map(({ user }) => user),
        [...used].sort().flatMap((id) => (concepts.has(id) ? [concepts.get(id)!] : [])),
      );
      const path = inputPath(weekId, comp.componentId);
      const ref = refs.dropComponent(weekId, comp.componentId);
      if (!(await ref.get()).exists) {
        const bytes = new Uint8Array(gzipSync(utf8Encode(JSON.stringify(snapshot))));
        const created = await deps.drops.createIfAbsent(path, bytes, 'application/gzip');
        const frozen = created ? bytes : await deps.drops.read(path);
        try {
          await ref.create({ status: 'snapshotted', dryRun, inputHash: sha256Hex(frozen), inputPath: path });
        } catch (err) {
          if (grpcCode(err) !== GRPC_ALREADY_EXISTS) throw err;
        }
      }
      await deps.tasks.enqueue('matchComponent', { weekId, componentId: comp.componentId }, { id: taskId(weekId, comp.componentId), dispatchDeadlineSeconds: MATCH_DISPATCH_DEADLINE_S });
      componentCount++;
    }
  }
  for (const a of matched) await writeAreaChips(deps, a.id, holders.get(a.id) ?? new Map());
  await deps.tasks.enqueue('releaseDrop', { weekId }, { id: taskId('release', weekId), scheduleTime: schedule.releaseAt, dispatchDeadlineSeconds: MATCH_DISPATCH_DEADLINE_S });
  return { outcome: 'orchestrated', components: componentCount, users: users.length };
}

/** Chips per area (§8.1 `areas.chips`): ≤ 30 non-sensitive active concepts with ≥ 10 ordinary holders there and a label. */
export const CHIPS_MAX = 30;
export const CHIP_MIN_HOLDERS = 10;

export async function writeAreaChips(deps: AppDeps, areaId: string, counts: ReadonlyMap<string, number>): Promise<number> {
  const candidates = [...counts].filter(([, n]) => n >= CHIP_MIN_HOLDERS).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, CHIPS_MAX * 2);
  const chips: { conceptId: string; da: string; en: string }[] = [];
  if (candidates.length > 0) {
    const snaps = await deps.db.getAll(...candidates.map(([id]) => deps.db.doc(PATHS.concept(id))), { fieldMask: ['labels', 'sensitive', 'status'] });
    for (const s of snaps) {
      if (chips.length >= CHIPS_MAX) break;
      if (!s.exists || s.get('sensitive') !== false || s.get('status') !== 'active') continue;
      const da = s.get('labels.da') as string | undefined;
      const en = s.get('labels.en') as string | undefined;
      if (!da && !en) continue;
      chips.push({ conceptId: s.id, da: da ?? en!, en: en ?? da! });
    }
  }
  const ref = docs(deps.db).area(areaId);
  await deps.db.runTransaction(async (tx) => {
    const area = (await tx.get(ref)).data();
    const config = getLaunchArea(areaId);
    if (area) tx.update(ref, { chips });
    else if (config) tx.set(ref, { ...areaDocFromConfig(config, 0, config.status), chips });
  });
  return chips.length;
}
