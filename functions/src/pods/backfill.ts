/**
 * backfillPod (DESIGN.md §4.2, §10.3, D6): one round per pod, only before the plan first locks. The pool is the
 * latest drop's unmatched users who hold the theme (`themeIds` array-contains, `lastDrop`). Candidates are re-checked
 * with the matcher's own constraint code (H1–H6, S1, S3, S5, availability) against every member and invitee, then
 * claimed and invited in one podState transaction: `weekClaim != W`, `activePods < 2` and the sensitive cap are read
 * again there, and the podState `version` read with the pool must be unchanged (compare-and-set), else the round is
 * computed again.
 */
import {
  AVAILABILITY_ALL,
  canBackfill,
  compatFailure,
  deriveContext,
  holdsTheme,
  mergeRecentUntil,
  recentUntilWeek,
  sensitiveDensityOk,
  uidHash,
  weekIdAt,
  xxhash32,
  type ConceptProjection,
  type MatchUser,
  type WeekId,
} from '@friendpod/core';
import { docs, matchProfiles, ts } from '../lib/firestore';
import type { AppDeps } from '../lib/runtime';
import { ms, podProfile, pruneRecent, recentMinUntil, type PodStateDoc, type ProfileDoc, type UserDoc } from './context';
import { withPod } from './effects';
import { matchUserOf, profileParticipates } from './orchestrator';
import { cardFor, holdingsOf, type Holding } from './release';

const POOL_LIMIT = 200;

/** The podState changed between the pool computation and the claim: compute the round again. */
class VersionChanged extends Error {}
const MAX_ROUNDS = 3;

/**
 * S3 and the consent, read again inside the claim transaction (as release revalidation does): a blanket withdrawal
 * first strips the sensitive themes and `users.legal.art9` in one transaction, so a candidate whose withdrawal has
 * begun is never invited to a sensitive pod (PRIVACY.md §3.5).
 */
function consentHolds(u: UserDoc, p: ProfileDoc, theme: PodStateDoc['theme']): boolean {
  if (theme.kind !== 'concept') return false;
  const entry = p.themes.find((t) => t.c === theme.conceptId);
  return u.legal.art9 !== undefined && entry !== undefined && entry.sens && Boolean(entry.consentRef);
}

export type BackfillOutcome = 'notApplicable' | 'alreadyInvited' | 'noCandidates' | 'invited';

/** Members and open invitations: everyone a newcomer would meet. */
function participants(ps: PodStateDoc, memberUids: readonly string[] | null): string[] {
  const open = Object.entries(ps.members)
    .filter(([, m]) => m.status === 'invited' || m.status === 'accepted')
    .map(([u]) => u);
  return [...new Set([...(memberUids ?? []), ...open])].sort();
}

function applicable(ps: PodStateDoc, now: number): boolean {
  const until = ms(ps.backfill.until);
  return ps.backfill.used && until !== undefined && until > now && canBackfill(ps.state, false, ps.planLockedAt !== undefined);
}

interface Pick {
  readonly uid: string;
  readonly holding: Holding;
}

async function choose(deps: AppDeps, weekId: WeekId, podId: string, ps: PodStateDoc, memberUids: readonly string[] | null, now: number): Promise<Pick[]> {
  if (ps.theme.kind !== 'concept') return [];
  const theme = ps.theme;
  const profile = podProfile(ps.componentId);
  const present = participants(ps, memberUids);
  const seats = Math.min(profile.params.maxSize, profile.params.targetSize) - present.length;
  if (seats <= 0) return [];
  const pool = await matchProfiles(deps.db)
    .where('themeIds', 'array-contains', theme.conceptId)
    .where('lastDrop.weekId', '==', weekId)
    .where('lastDrop.outcome', '==', 'unmatched')
    .limit(POOL_LIMIT)
    .get();
  const everInvited = new Set(ps.memberList);
  const candidates = pool.docs.filter((d) => !everInvited.has(d.id) && profileParticipates(d.data(), weekId, now));
  if (candidates.length === 0) return [];

  const memberProfiles = await deps.db.getAll(...present.map((u) => docs(deps.db).matchProfile(u)));
  const hmac = deps.uidHmac();
  const users: MatchUser[] = [];
  for (let i = 0; i < present.length; i++) {
    const p = memberProfiles[i]!.data() as ProfileDoc | undefined;
    if (p) users.push(await matchUserOf(present[i]!, p, await uidHash(hmac, present[i]!)));
  }
  const memberUidSet = new Set(users.map((u) => u.uid));
  for (const d of candidates) users.push(await matchUserOf(d.id, d.data(), await uidHash(hmac, d.id)));
  // Only the constraint checks run, so concept vectors are not needed: each theme id resolves to itself with the
  // holder's own sensitivity (the partition check, S2/S3, still applies).
  const projections = new Map<string, ConceptProjection>();
  for (const u of users) for (const t of u.themes) if (!projections.has(t.c)) projections.set(t.c, { id: t.c, c128: new Float32Array(128), sensitive: t.sens, status: 'active', mergedInto: null });
  const ctx = deriveContext({ weekId, dropAt: now, users, concepts: [...projections.values()], params: profile.params, seed: weekId });
  const themeIdx = ctx.conceptIds.indexOf(theme.conceptId);
  if (themeIdx < 0) return [];
  const chosen = ctx.users.filter((u) => memberUidSet.has(u.uid)).map((u) => u.idx);
  let avail = chosen.reduce((a, i) => a & ctx.users[i]!.avail, AVAILABILITY_ALL);
  const order = ctx.users
    .filter((u) => !memberUidSet.has(u.uid))
    .sort((a, b) => xxhash32(`${weekId}:${podId}:${a.uid}`) - xxhash32(`${weekId}:${podId}:${b.uid}`) || (a.uid < b.uid ? -1 : 1));
  const picks: string[] = [];
  for (const c of order) {
    if (picks.length >= seats) break;
    if (c.ineligible !== null || !holdsTheme(ctx, c.idx, themeIdx)) continue;
    if ((avail & c.avail) === 0) continue;
    if (chosen.some((m) => compatFailure(ctx, c.idx, m) !== null)) continue;
    if (theme.sensitive && !sensitiveDensityOk(ctx, themeIdx, [...chosen, c.idx])) continue;
    chosen.push(c.idx);
    avail &= c.avail;
    picks.push(c.uid);
  }
  const out: Pick[] = [];
  for (const uid of picks) {
    const holding = (await holdingsOf(deps.db, uid, [theme.conceptId], theme.sensitive ? 'sensitiveInterests' : 'interests')).get(theme.conceptId);
    if (holding) out.push({ uid, holding });
  }
  return out;
}

export async function backfillPod(deps: AppDeps, task: { readonly weekId: WeekId; readonly podId: string }): Promise<{ outcome: BackfillOutcome; invited: number }> {
  const refs = docs(deps.db);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const now = deps.now();
    const [psSnap, podSnap] = await Promise.all([refs.podState(task.podId).get(), refs.pod(task.podId).get()]);
    const ps = psSnap.data();
    if (!ps || !applicable(ps, now)) return { outcome: 'notApplicable', invited: 0 };
    if (Object.values(ps.members).some((m) => m.viaBackfill)) return { outcome: 'alreadyInvited', invited: 0 };
    const picks = await choose(deps, task.weekId, task.podId, ps, podSnap.data()?.memberUids ?? null, now);
    if (picks.length === 0) return { outcome: 'noCandidates', invited: 0 };

    const attempt = withPod(deps, task.podId, now, async (ctx): Promise<{ outcome: BackfillOutcome; invited: number }> => {
      if (ctx.version !== ps.version) throw new VersionChanged();
      const profile = ctx.profile;
      const present = participants(ctx.ps, ctx.pod?.memberUids ?? null);
      const uids = picks.map((p) => p.uid);
      await ctx.loadPeople([...uids, ...present]);
      const sensitive = ctx.ps.theme.kind === 'concept' && ctx.ps.theme.sensitive;
      const invited: Pick[] = [];
      for (const pick of picks) {
        const p = ctx.matchProfile(pick.uid);
        const u = ctx.user(pick.uid);
        const fresh =
          p &&
          u?.status === 'active' &&
          p.weekClaim !== task.weekId &&
          p.lastDrop?.weekId === task.weekId &&
          p.lastDrop.outcome === 'unmatched' &&
          p.activePods < profile.params.maxActivePods &&
          (!sensitive || (p.activeSensitivePods === 0 && consentHolds(u, p, ctx.ps.theme)));
        if (fresh) invited.push(pick);
      }
      if (invited.length === 0) return { outcome: 'noCandidates', invited: 0 };

      const until = ctx.ps.backfill.until!.toMillis();
      const coProposedUntil = recentUntilWeek(weekIdAt(now), 'coProposed', profile);
      const everyone = [...present, ...invited.map((p) => p.uid)];
      const hs = new Map(await Promise.all(everyone.map(async (u) => [u, await ctx.uidH(u)] as const)));
      for (const { uid, holding } of invited) {
        const u = ctx.user(uid)!;
        const p = ctx.matchProfile(uid)!;
        // The newcomer's own wording and area only: other reason codes would describe a group they have not met.
        const reasons = [
          { code: 'THEME' as const, yourWording: holding.display },
          ...(u.area.label ? [{ code: 'AREA' as const, label: u.area.label }] : []),
        ];
        ctx.ps.members[uid] = { status: 'invited', invitedAt: ts(now), viaBackfill: true, themeInterestId: holding.id, reasons };
        ctx.ps.memberList = [...ctx.ps.memberList, uid];
        ctx.createCard(uid, cardFor(ctx.ps.theme, { user: u, profile: p, theme: holding, alsoShare: [] }, reasons, { sizeTarget: everyone.length, acceptBy: until, ageSpan: null }));
        ctx.updateProfile(uid, (q: ProfileDoc) => ({ ...q, weekClaim: task.weekId, lastDrop: { weekId: task.weekId, outcome: 'proposed', podId: ctx.podId } }));
        ctx.claimFunnel(uid, 'firstProposal');
        ctx.updateUser(uid, (x) => ({ ...x, lastDrop: { weekId: task.weekId, outcome: 'proposed' } }));
      }
      // Co-proposed H5 window between each newcomer and everyone already there (both directions).
      const week = weekIdAt(now);
      for (const a of everyone) {
        const others = everyone.filter((b) => b !== a && (invited.some((p) => p.uid === a) || invited.some((p) => p.uid === b)));
        if (others.length === 0) continue;
        ctx.updateProfile(a, (q) => {
          const recentH = pruneRecent(q.recentH, week);
          for (const b of others) recentH[hs.get(b)!] = mergeRecentUntil(recentH[hs.get(b)!], coProposedUntil);
          return { ...q, recentH, recentMinUntil: recentMinUntil(recentH) };
        });
      }
      ctx.push('dropReady', invited.map((p) => p.uid));
      return { outcome: 'invited', invited: invited.length };
    });
    try {
      return await attempt;
    } catch (err) {
      if (!(err instanceof VersionChanged)) throw err;
    }
  }
  return { outcome: 'notApplicable', invited: 0 };
}
