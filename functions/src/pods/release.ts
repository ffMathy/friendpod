/**
 * releaseDrop (DESIGN.md §3.2, §6.5, §10.3): Thursday 18:00. Reads only each component's referenced result object,
 * revalidates every member against current state, and proposes each pod in one batch: `create()` podState and the
 * cards, and update each member's `matchProfiles` with a `lastUpdateTime` precondition from the revalidation read, so
 * a concurrent change (deletion, pause, block, consent withdrawal: each also writes matchProfiles) fails the batch
 * and the pod is revalidated again. Pod ids come from the result's member sets, so a retry finds the same ids and
 * skips pods that exist. Pushes are generic and staggered; the snapshot objects are deleted at the end.
 */
import {
  ALSO_SHARE_MAX,
  dropSchedule,
  matchResultFileSchema,
  mergeRecentUntil,
  podId as computePodId,
  recentUntilWeek,
  uidHash,
  weeksBetween,
  type HmacSha256,
  type MatchResultFile,
  type MatchingProfile,
  type UnmatchedReason,
  type WeekId,
} from '@grouper/core';
import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import { grpcCode } from '../lib/errors';
import { errorFields } from '../lib/log';
import { docs, dropComponents, PATHS, ts, type DocOf } from '../lib/firestore';
import { claimMilestones, FunnelIncrements } from '../lib/funnel';
import { participatesIn } from '../lib/participation';
import type { AppDeps } from '../lib/runtime';
import type { DropObjectStore } from '../lib/storage';
import { podDueAt, podProfile, pruneRecent, recentMinUntil, type PodStateDoc, type ProfileDoc, type UserDoc } from './context';
import { pushTo } from './effects';

export interface ReleaseDeps extends AppDeps {
  readonly drops: DropObjectStore;
  /** HMAC keyed with POD_ID_KEY (§6.5). */
  podIdHmac(): HmacSha256;
  /** Pause between push batches (the 15-minute stagger); injectable for tests. */
  wait(ms: number): Promise<void>;
}

/** Pushes go out in batches of 500 recipients spread over 15 minutes (§3.2). */
export const PUSH_STAGGER_MS = 15 * 60_000;
export const PUSH_BATCH_UIDS = 500;
const MAX_ATTEMPTS = 4;
const GRPC_ALREADY_EXISTS = 6;
const GRPC_NOT_FOUND = 5;
const GRPC_FAILED_PRECONDITION = 9;

type ResultPod = MatchResultFile['pods'][number];
type PodReason = DocOf<'podCard'>['reasons'][number];
type Outcome = { readonly outcome: 'unmatched'; readonly reason: UnmatchedReason } | { readonly outcome: 'excluded' };

export interface Holding {
  readonly id: string;
  readonly display: string;
}

/** The user's own holdings of these concepts (their wording and interest id), ordinary or sensitive partition. */
export async function holdingsOf(db: Firestore, uid: string, conceptIds: readonly string[], partition: 'interests' | 'sensitiveInterests'): Promise<Map<string, Holding>> {
  const out = new Map<string, Holding>();
  if (conceptIds.length === 0) return out;
  const snap = await db.collection(`${PATHS.user(uid)}/${partition}`).where('conceptId', 'in', [...new Set(conceptIds)].slice(0, 30)).get();
  for (const d of snap.docs.sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const c = d.get('conceptId') as string;
    if (!out.has(c)) out.set(c, { id: d.id, display: d.get('display') as string });
  }
  return out;
}

export interface MemberView {
  readonly user: UserDoc;
  readonly profile: ProfileDoc;
  readonly theme: Holding | null;
  readonly alsoShare: readonly string[];
}

/** "Why this pod" for one viewer (§6.7): their own wording only; sensitive themes carry no age span or shared interests. */
export function cardReasons(
  pod: { readonly theme: ResultPod['theme'] },
  view: MemberView,
  seed: { readonly nearKm: number; readonly ageSpan: { min: number; max: number } | null; readonly priorityWeeks: number | null },
): PodReason[] {
  const sensitive = pod.theme.kind === 'concept' && pod.theme.sensitive;
  const reasons: PodReason[] = [];
  if (pod.theme.kind === 'openToAnyone') reasons.push({ code: 'OPEN_TO_ANYONE' });
  else if (view.theme) reasons.push({ code: 'THEME', yourWording: view.theme.display });
  if (!sensitive && view.alsoShare.length > 0) reasons.push({ code: 'ALSO_SHARE', yourWordings: view.alsoShare.slice(0, ALSO_SHARE_MAX) });
  if (view.user.area.label) reasons.push({ code: 'AREA', label: view.user.area.label });
  reasons.push({ code: 'NEAR_YOU', km: Math.min(50, Math.max(0, seed.nearKm)) });
  if (!sensitive && seed.ageSpan) reasons.push({ code: 'AGE_SPAN', min: seed.ageSpan.min, max: seed.ageSpan.max });
  if (seed.priorityWeeks !== null && seed.priorityWeeks >= 1) reasons.push({ code: 'PRIORITY', weeks: seed.priorityWeeks });
  return reasons;
}

export function cardFor(
  podTheme: ResultPod['theme'],
  view: MemberView,
  reasons: PodReason[],
  o: { readonly sizeTarget: number; readonly acceptBy: number; readonly ageSpan: { min: number; max: number } | null },
): DocOf<'podCard'> {
  const sensitive = podTheme.kind === 'concept' && podTheme.sensitive;
  return {
    state: 'proposed',
    myStatus: 'invited',
    themeLabel: view.theme?.display ?? null,
    themeSensitive: sensitive,
    sizeTarget: Math.min(6, Math.max(4, o.sizeTarget)),
    acceptedCount: 0,
    acceptBy: ts(o.acceptBy),
    reasons,
    areaLabel: view.user.area.label,
    ...(!sensitive && o.ageSpan ? { ageSpan: o.ageSpan } : {}),
  };
}

/** Release revalidation of one member (§10.3); null when they may stay. */
export function revalidate(
  weekId: WeekId,
  now: number,
  profile: MatchingProfile,
  theme: ResultPod['theme'],
  view: { readonly user: UserDoc | null; readonly profile: ProfileDoc | null; readonly theme: Holding | null },
): Outcome | null {
  const { user: u, profile: p } = view;
  if (!u || !p || u.status !== 'active' || p.status !== 'active') return { outcome: 'excluded' };
  const participation = {
    status: u.status,
    mode: u.participation.mode,
    skipWeekId: u.participation.skipWeekId ?? null,
    optInWeekId: u.participation.optInWeekId ?? null,
    pausedUntil: u.participation.pausedUntil?.toMillis() ?? null,
    pauseReason: u.participation.pauseReason ?? null,
  };
  if (!participatesIn(participation, weekId, now)) return { outcome: 'excluded' };
  if (p.weekClaim === weekId) return { outcome: 'excluded' };
  const noFit = { outcome: 'unmatched', reason: 'NO_FIT_THIS_WEEK' } as const;
  if (p.activePods >= profile.params.maxActivePods) return { outcome: 'unmatched', reason: 'MAX_ACTIVE_PODS' };
  if (theme.kind === 'openToAnyone') return p.openToAnyone ? null : noFit;
  const entry = p.themes.find((t) => t.c === theme.conceptId);
  if (!entry || !view.theme || entry.sens !== theme.sensitive) return noFit;
  if (theme.sensitive) {
    // S3 and the consent itself; S5 eligibility as far as it can change after 16:00 (reports, holds, other pods).
    if (!entry.sens || !entry.consentRef || u.legal.art9 === undefined) return noFit;
    const held = p.sensitiveHold !== null && p.sensitiveHold.until.toMillis() > now;
    if (p.openReportCount > 0 || held || p.activeSensitivePods > 0) return { outcome: 'unmatched', reason: 'SENSITIVE_ELIGIBILITY' };
  }
  return null;
}

interface PodRelease {
  readonly podId: string;
  readonly invited: readonly string[];
  readonly outcomes: ReadonlyMap<string, Outcome>;
}

async function releasePod(deps: ReleaseDeps, weekId: WeekId, componentId: string, pod: ResultPod, now: number): Promise<PodRelease> {
  const db = deps.db;
  const refs = docs(db);
  const profile = podProfile(componentId);
  const podId = await computePodId(deps.podIdHmac(), weekId, pod.members);
  const hmac = deps.uidHmac();
  const uidHs = new Map(await Promise.all(pod.members.map(async (u) => [u, await uidHash(hmac, u)] as const)));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if ((await refs.podState(podId).get()).exists) return { podId, invited: [], outcomes: new Map() };
    const members = [...pod.members].sort();
    const [userSnaps, profileSnaps] = await Promise.all([db.getAll(...members.map((u) => refs.user(u))), db.getAll(...members.map((u) => refs.matchProfile(u)))]);
    const views = new Map<string, MemberView & { profileSnap: DocumentSnapshot }>();
    const outcomes = new Map<string, Outcome>();
    await Promise.all(
      members.map(async (uid, i) => {
        const user = (userSnaps[i]!.data() as UserDoc | undefined) ?? null;
        const p = (profileSnaps[i]!.data() as ProfileDoc | undefined) ?? null;
        const sensitive = pod.theme.kind === 'concept' && pod.theme.sensitive;
        let theme: Holding | null = null;
        let alsoShare: string[] = [];
        if (user && p && pod.theme.kind === 'concept') {
          theme = (await holdingsOf(db, uid, [pod.theme.conceptId], sensitive ? 'sensitiveInterests' : 'interests')).get(pod.theme.conceptId) ?? null;
          const seed = pod.reasons[uid];
          if (!sensitive && seed && seed.alsoShare.length > 0) {
            const held = await holdingsOf(db, uid, seed.alsoShare, 'interests');
            alsoShare = seed.alsoShare.map((c) => held.get(c)?.display).filter((d): d is string => d !== undefined);
          }
        }
        const failed = revalidate(weekId, now, profile, pod.theme, { user, profile: p, theme });
        if (failed) outcomes.set(uid, failed);
        else views.set(uid, { user: user!, profile: p!, theme, alsoShare, profileSnap: profileSnaps[i]! });
      }),
    );
    // H4: a block or an open report between two members since 16:00 removes both from this pod.
    const kept = [...views.keys()];
    for (const a of kept) {
      for (const b of kept) {
        if (a !== b && views.get(a)!.profile.blockedH.includes(uidHs.get(b)!)) {
          outcomes.set(a, { outcome: 'unmatched', reason: 'NO_FIT_THIS_WEEK' });
          outcomes.set(b, { outcome: 'unmatched', reason: 'NO_FIT_THIS_WEEK' });
        }
      }
    }
    const keep = kept.filter((u) => !outcomes.has(u));
    if (keep.length < profile.params.minSize) {
      // Not proposed: everyone left joins the backfill pool (§10.3).
      for (const u of keep) outcomes.set(u, { outcome: 'unmatched', reason: 'NO_FIT_THIS_WEEK' });
      return { podId, invited: [], outcomes };
    }

    const acceptBy = dropSchedule(weekId).acceptBy;
    const sensitive = pod.theme.kind === 'concept' && pod.theme.sensitive;
    const coProposedUntil = recentUntilWeek(weekId, 'coProposed', profile);
    const batch = db.batch();
    const funnel = new FunnelIncrements();
    const stateMembers: PodStateDoc['members'] = {};
    for (const uid of keep) {
      const v = views.get(uid)!;
      const seed = pod.reasons[uid] ?? { alsoShare: [], nearKm: 0, ageSpan: null, priorityWeeks: null };
      const reasons = cardReasons(pod, v, seed);
      stateMembers[uid] = { status: 'invited', invitedAt: ts(now), viaBackfill: false, themeInterestId: v.theme?.id ?? null, reasons };
      batch.create(refs.podCard(uid, podId), cardFor(pod.theme, v, reasons, { sizeTarget: keep.length, acceptBy, ageSpan: seed.ageSpan }));

      const recentH = pruneRecent(v.profile.recentH, weekId);
      for (const other of keep) if (other !== uid) recentH[uidHs.get(other)!] = mergeRecentUntil(recentH[uidHs.get(other)!], coProposedUntil);
      const { milestones, fresh } = claimMilestones(v.profile.milestones, ['firstProposal'], now);
      for (const s of fresh) funnel.stage(v.profile.areaId, now, s);
      batch.update(
        db.doc(PATHS.matchProfile(uid)),
        {
          weekClaim: weekId,
          lastDrop: { weekId, outcome: 'proposed', podId },
          recentH,
          recentMinUntil: recentMinUntil(recentH),
          ...(sensitive ? { sensitiveProposals: [...v.profile.sensitiveProposals.filter((w) => weeksBetween(w, weekId) < 12), weekId] } : {}),
          milestones,
          updatedAt: ts(now),
        },
        { lastUpdateTime: v.profileSnap.updateTime! },
      );
      // update(), never set(): a deleted user's subtree is never recreated (§10.3).
      batch.update(db.doc(PATHS.user(uid)), { lastDrop: { weekId, outcome: 'proposed' } });
    }
    const ps: PodStateDoc = {
      weekId,
      componentId,
      state: 'proposed',
      theme: pod.theme,
      sizeTarget: keep.length,
      timers: { acceptBy: ts(acceptBy) },
      memberList: keep,
      members: stateMembers,
      hasMet: false,
      rescheduled: false,
      planningExtended: false,
      score: pod.value,
      backfill: { used: false },
      version: 0,
    };
    const due = podDueAt(ps);
    batch.create(refs.podState(podId), due === null ? ps : { ...ps, dueAt: ts(due) });
    funnel.write(db, batch);
    try {
      await batch.commit();
      return { podId, invited: keep, outcomes };
    } catch (err) {
      const code = grpcCode(err);
      if (code === GRPC_ALREADY_EXISTS) return { podId, invited: [], outcomes: new Map() };
      if (code !== GRPC_FAILED_PRECONDITION && code !== GRPC_NOT_FOUND) throw err;
      deps.log.info('releaseDrop.revalidateAgain', { attempt });
    }
  }
  throw new Error('releaseDrop: pod kept changing during revalidation');
}

/** `lastDrop` for users not proposed (§6.2): the outcome, and the same write prunes expired `recentH` entries. */
async function writeOutcome(deps: ReleaseDeps, weekId: WeekId, uid: string, o: Outcome, now: number): Promise<void> {
  const db = deps.db;
  const p = (await docs(db).matchProfile(uid).get()).data();
  if (!p) return;
  // A retried release must not undo a backfill invitation made meanwhile.
  if (p.lastDrop?.weekId === weekId && p.lastDrop.outcome === 'proposed') return;
  const recentH = pruneRecent(p.recentH, weekId);
  try {
    await db.doc(PATHS.matchProfile(uid)).update({ lastDrop: { weekId, outcome: o.outcome }, recentH, recentMinUntil: recentMinUntil(recentH), updatedAt: ts(now) });
    await db.doc(PATHS.user(uid)).update({ lastDrop: { weekId, outcome: o.outcome, ...(o.outcome === 'unmatched' ? { reason: o.reason } : {}) } });
  } catch (err) {
    if (grpcCode(err) !== GRPC_NOT_FOUND) throw err;
  }
}

export interface ReleaseResult {
  readonly outcome: 'released' | 'noComponents';
  readonly components: number;
  readonly pods: number;
  readonly invited: number;
  readonly pending: number;
  [key: string]: string | number;
}

/** One computed component; a beta area's component is a dry run (§6.4): computed for its stats, never proposed. */
async function releaseComponent(deps: ReleaseDeps, weekId: WeekId, componentId: string, c: DocOf<'dropComponent'>, now: number): Promise<{ pods: number; invited: string[] }> {
  if (c.dryRun || !c.computed) return { pods: 0, invited: [] };
  const file = matchResultFileSchema.parse(JSON.parse(new TextDecoder().decode(await deps.drops.read(c.computed.path))));
  const outcomes = new Map<string, Outcome>();
  const invited: string[] = [];
  let pods = 0;
  for (const pod of file.pods) {
    const r = await releasePod(deps, weekId, componentId, pod, now);
    if (r.invited.length > 0) pods++;
    invited.push(...r.invited);
    for (const [u, o] of r.outcomes) outcomes.set(u, o);
  }
  for (const u of file.unmatched) if (!outcomes.has(u.uid)) outcomes.set(u.uid, { outcome: 'unmatched', reason: u.reason });
  for (const [uid, o] of [...outcomes].sort(([a], [b]) => (a < b ? -1 : 1))) await writeOutcome(deps, weekId, uid, o, now);
  return { pods, invited };
}

export async function releaseDrop(deps: ReleaseDeps, weekId: WeekId): Promise<ReleaseResult> {
  const now = deps.now();
  const comps = await dropComponents(deps.db, weekId).get();
  if (comps.empty) return { outcome: 'noComponents', components: 0, pods: 0, invited: 0, pending: 0 };
  const invited: string[] = [];
  let pods = 0;
  let pending = 0;
  let released = 0;
  let failed = 0;
  for (const snap of [...comps.docs].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const c = snap.data();
    if (c.status === 'released') continue;
    if (!c.computed) {
      pending++;
      continue;
    }
    try {
      const r = await releaseComponent(deps, weekId, snap.id, c, now);
      await snap.ref.update({ status: 'released' });
      await Promise.all([deps.drops.delete(c.inputPath), deps.drops.delete(c.computed.path)]);
      pods += r.pods;
      invited.push(...r.invited);
      released++;
    } catch (err) {
      // One component's failure must not hold back the others; the task is retried at the end.
      failed++;
      deps.log.error('releaseDrop.componentFailed', errorFields(err));
    }
  }

  const sorted = [...new Set(invited)].sort();
  const batches = Math.ceil(sorted.length / PUSH_BATCH_UIDS);
  for (let i = 0; i < batches; i++) {
    if (i > 0) await deps.wait(PUSH_STAGGER_MS / Math.max(1, batches - 1));
    await pushTo(deps, 'dropReady', sorted.slice(i * PUSH_BATCH_UIDS, (i + 1) * PUSH_BATCH_UIDS));
  }
  // Components still computing: retry the task (Cloud Tasks backoff); released ones are skipped next time.
  if (failed > 0) throw new Error('releaseDrop: a component failed');
  if (pending > 0) throw new Error('releaseDrop: components not computed yet');
  return { outcome: 'released', components: released, pods, invited: sorted.length, pending };
}
