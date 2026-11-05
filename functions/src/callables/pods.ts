/**
 * The pod lifecycle callables (DESIGN.md §3.3–§3.8, §4.6, §10.1): respondToPod, setPhotoSharing, leavePod,
 * proposeOption, voteOption, confirmAttendance and submitFeedback. Each one is a single podState transaction
 * (version + 1) that first processes any timer already due, so a sweeper that runs late never changes an outcome.
 */
import {
  OPTIONS_PER_MEMBER,
  OPTIONS_PER_POD,
  PLANNING_EXTENSION_MS,
  appendNoShowEvent,
  attendanceFromNotThere,
  isLateCancel,
  meetAgainOutcome,
  optionTimeOk,
  pairKey,
  recentUntilAfterMeetAgain,
  recentUntilWeek,
  reliability,
  unanimousYes,
  weekIdAt,
  yesVotes,
  type CallableInput,
  type CallableOutput,
} from '@grouper/core';
import { AppError } from '../lib/errors';
import { DAY_MS, docs, podOptions, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import type { AppDeps } from '../lib/runtime';
import { ms, type PodTx } from '../pods/context';
import { withPod } from '../pods/effects';
import {
  AUTO_PAUSE_DECLINES,
  advance,
  afterMemberLoss,
  applyRecent,
  attendanceFailure,
  autoPause,
  checkNoShowSanction,
  confirm,
  isSensitiveTheme,
  lateJoin,
  lockPlan,
  MIN_MEMBERS,
  possibleAttendees,
  removeFromPod,
  setAttendance,
} from '../pods/transitions';

type Name = 'respondToPod' | 'setPhotoSharing' | 'leavePod' | 'proposeOption' | 'voteOption' | 'confirmAttendance' | 'submitFeedback';
type In<N extends Name> = CallableInput<N>;
type Out<N extends Name> = CallableOutput<N>;

/** Pair signals are kept until applied, at most 30 days after feedback closes (PRIVACY.md §5) [A]. */
export const PAIR_SIGNAL_TTL_MS = 30 * DAY_MS;

const RESPONDABLE = new Set(['proposed', 'planning', 'scheduled']);

function acceptedCount(ctx: PodTx): number {
  return Math.min(6, ctx.pod ? ctx.pod.memberUids.length : ctx.byStatus('accepted').length);
}

/** The caller must be a current confirmed member (`pods.memberUids`). */
function requireMember(ctx: PodTx, uid: string): void {
  if (!ctx.pod?.memberUids.includes(uid)) throw new AppError('NOT_MEMBER');
}

/** Accept or decline an invitation (§3.3, §4.6): confirmation at the area profile's `confirmationMin`. */
export async function respondToPod(deps: AppDeps, call: CallContext, input: In<'respondToPod'>): Promise<Out<'respondToPod'>> {
  const { uid, now } = call;
  return withPod(deps, input.podId, now, async (ctx) => {
    const m = ctx.ps.members[uid];
    if (!m) throw new AppError('NOT_INVITED');
    await ctx.loadPeople([uid]);
    const user = ctx.user(uid);
    if (!user || user.status === 'deleting' || user.status === 'suspended') throw new AppError('STATE');
    if (m.status === 'accepted' && input.accept) return { state: ctx.state, acceptedCount: acceptedCount(ctx) };
    if (m.status !== 'invited') throw new AppError('NOT_INVITED');
    const deadline = m.viaBackfill ? ms(ctx.ps.timers.backfillUntil) : ctx.ps.timers.acceptBy.toMillis();
    const lockedForBackfill = m.viaBackfill && ctx.ps.planLockedAt !== undefined;
    if (deadline === undefined || now >= deadline || !RESPONDABLE.has(ctx.state) || lockedForBackfill) throw new AppError('DEADLINE');
    // Any other timer that is already due runs first (e.g. a planning deadline the sweeper has not reached yet).
    await advance(ctx);
    if (ctx.ps.members[uid]!.status !== 'invited' || !RESPONDABLE.has(ctx.state)) throw new AppError('DEADLINE');

    ctx.setMember(uid, { status: input.accept ? 'accepted' : 'declined', respondedAt: ts(now) });
    if (input.accept) {
      ctx.updateProfile(uid, (p) => ({ ...p, declinesInRow: 0, ignoredInRow: 0 }));
      if (ctx.state === 'proposed') {
        if (ctx.byStatus('accepted').length >= ctx.profile.defaults.confirmationMin) await confirm(ctx);
      } else if (!(await lateJoin(ctx, uid))) {
        throw new AppError('STATE');
      }
    } else {
      // The reason chip feeds aggregate metrics only (§3.3): a fixed code, never stored on the user.
      deps.log.info('pod.declined', { reason: input.reason ?? 'none' });
      ctx.updateProfile(uid, (p) => ({ ...p, declinesInRow: p.declinesInRow + 1, ignoredInRow: 0 }));
      if ((ctx.matchProfile(uid)?.declinesInRow ?? 0) >= AUTO_PAUSE_DECLINES) autoPause(ctx, uid, 'declines');
      // Only before confirmation can a decline leave the pod short; later, invitees are not members yet.
      if (ctx.state === 'proposed') await afterMemberLoss(ctx);
    }
    await advance(ctx);
    return { state: ctx.state, acceptedCount: acceptedCount(ctx) };
  });
}

/** "Show my photo to this pod" (S6), sensitive-themed pods only: the caller's outgoing grants and roster photoV. */
export async function setPhotoSharing(deps: AppDeps, call: CallContext, input: In<'setPhotoSharing'>): Promise<Out<'setPhotoSharing'>> {
  const { uid, now } = call;
  return withPod(deps, input.podId, now, async (ctx) => {
    requireMember(ctx, uid);
    await advance(ctx);
    if (!isSensitiveTheme(ctx) || !['planning', 'scheduled', 'happened'].includes(ctx.state) || !ctx.pod!.memberUids.includes(uid)) throw new AppError('STATE');
    await ctx.loadPeople([uid]);
    const photoV = input.share ? (ctx.user(uid)?.photo?.v ?? null) : null;
    for (const other of ctx.pod!.memberUids) {
      if (input.share) ctx.grant(uid, other);
      else ctx.revoke(uid, other);
    }
    ctx.updatePod((p) => ({ ...p, roster: { ...p.roster, [uid]: { ...p.roster[uid]!, photoV } } }));
    ctx.patchCard(uid, { photoShared: input.share });
    return { ok: true as const };
  }, 'NOT_MEMBER');
}

/** Leave a pod (§3.8): "A member left" for the others; below 3 the pod dissolves or archives. */
export async function leavePod(deps: AppDeps, call: CallContext, input: In<'leavePod'>): Promise<Out<'leavePod'>> {
  const { uid, now } = call;
  return withPod(deps, input.podId, now, async (ctx) => {
    if (!ctx.ps.members[uid]) throw new AppError('NOT_FOUND');
    await advance(ctx);
    const m = ctx.ps.members[uid]!;
    if (ctx.state === 'archived' || ctx.state === 'dissolved' || !['invited', 'accepted'].includes(m.status)) return { ok: true as const };
    deps.log.info('pod.left', { reason: input.reason ?? 'none', state: ctx.state });
    const wasCurrent = ctx.pod?.memberUids.includes(uid) ?? false;
    await removeFromPod(ctx, uid, 'left');
    if (wasCurrent) {
      const rest = ctx.currentMembers();
      for (const other of rest) ctx.notice(other, 'POD_MEMBER_LEFT');
      ctx.push('podChanged', rest);
    }
    if (wasCurrent || ctx.state === 'proposed') await afterMemberLoss(ctx);
    await advance(ctx);
    return { ok: true as const };
  });
}

/** Propose a time and a Google Places pick (§3.5, D8); the schema has already checked the place. */
export async function proposeOption(deps: AppDeps, call: CallContext, input: In<'proposeOption'>): Promise<Out<'proposeOption'>> {
  const { uid, now } = call;
  const optionId = podOptions(deps.db, input.podId).doc().id;
  return withPod(deps, input.podId, now, async (ctx) => {
    requireMember(ctx, uid);
    await advance(ctx);
    if (ctx.state !== 'planning' || !ctx.pod!.memberUids.includes(uid)) throw new AppError('STATE');
    if (!optionTimeOk(input.startsAt, now)) throw new AppError('WINDOW');
    await ctx.loadOptions();
    // The limits apply per round: the extension round (D7) may add options up to the same limits.
    const roundStart = ctx.ps.planningExtended ? ctx.ps.timers.planDeadline!.toMillis() - PLANNING_EXTENSION_MS : 0;
    const inRound = [...ctx.currentOptions().values()].filter((o) => o.createdAt.toMillis() >= roundStart);
    if (inRound.length >= OPTIONS_PER_POD || inRound.filter((o) => o.authorUid === uid).length >= OPTIONS_PER_MEMBER) throw new AppError('LIMIT');
    ctx.setOption(optionId, { authorUid: uid, startsAt: ts(input.startsAt), place: input.place, votes: {}, createdAt: ts(now) });
    return { optionId };
  }, 'NOT_MEMBER');
}

/** Vote yes / no / clear (§3.5); a unanimous yes from every current member locks the plan at once. */
export async function voteOption(deps: AppDeps, call: CallContext, input: In<'voteOption'>): Promise<Out<'voteOption'>> {
  const { uid, now } = call;
  return withPod(deps, input.podId, now, async (ctx) => {
    requireMember(ctx, uid);
    await advance(ctx);
    if (ctx.state !== 'planning' || !ctx.pod!.memberUids.includes(uid)) throw new AppError('STATE');
    await ctx.loadOptions();
    const option = ctx.currentOptions().get(input.optionId);
    if (!option) throw new AppError('NOT_FOUND');
    const { [uid]: _old, ...others } = option.votes;
    const updated = { ...option, votes: input.vote === null ? others : { ...others, [uid]: input.vote } };
    ctx.setOption(input.optionId, updated);
    const members = ctx.pod!.memberUids;
    const yes = yesVotes({ id: input.optionId, startsAt: updated.startsAt.toMillis(), votes: updated.votes }, members);
    const no = members.filter((m) => updated.votes[m] === 'no').length;
    if (updated.startsAt.toMillis() > now && unanimousYes({ id: input.optionId, startsAt: updated.startsAt.toMillis(), votes: updated.votes }, members)) {
      lockPlan(ctx, input.optionId, updated);
    }
    await advance(ctx);
    return { tally: { yes, no } };
  }, 'NOT_MEMBER');
}

/** "I'm coming" / "Can't make it" (§3.6, D5, D14); a late cancel counts 0.5 (§4.4). */
export async function confirmAttendance(deps: AppDeps, call: CallContext, input: In<'confirmAttendance'>): Promise<Out<'confirmAttendance'>> {
  const { uid, now } = call;
  return withPod(deps, input.podId, now, async (ctx) => {
    requireMember(ctx, uid);
    await advance(ctx);
    if (ctx.state !== 'scheduled' || !ctx.pod!.memberUids.includes(uid)) throw new AppError('STATE');
    const next = input.coming ? 'coming' : 'notComing';
    const member = ctx.ps.members[uid]!;
    if (member.attendance !== next) setAttendance(ctx, uid, next);
    if (!input.coming) {
      const meetupAt = ctx.ps.timers.meetupAt!.toMillis();
      if (!member.lateCancelled && isLateCancel(meetupAt, now)) {
        await ctx.loadPeople([uid]);
        const u = ctx.user(uid);
        if (u) {
          const stats = { ...u.stats, lateCancels: u.stats.lateCancels + 1 };
          ctx.updateUser(uid, (x) => ({ ...x, stats }));
          ctx.updateProfile(uid, (p) => ({
            ...p,
            reliability: reliability(stats),
            noShowEvents: appendNoShowEvent(p.noShowEvents, { weekId: weekIdAt(meetupAt), w: 0.5 }, weekIdAt(now)),
          }));
        }
        ctx.setMember(uid, { lateCancelled: true });
        await checkNoShowSanction(ctx, uid);
      }
      if (possibleAttendees(ctx) < MIN_MEMBERS) await attendanceFailure(ctx);
    }
    await advance(ctx);
    return { ok: true as const };
  }, 'NOT_MEMBER');
}

/**
 * Feedback (§3.6, D9, D15): "Who was there?" as `notThere` (resolved at feedback close by the majority rule), the
 * private meet-again answers as HMAC-keyed pair signals, a rating and Keep pod. A "no" makes the pair never match
 * again at once; a mutual "yes" shortens their H5 window to 4 weeks after the meetup week.
 */
export async function submitFeedback(deps: AppDeps, call: CallContext, input: In<'submitFeedback'>): Promise<Out<'submitFeedback'>> {
  const { uid, now } = call;
  const refs = docs(deps.db);
  return withPod(deps, input.podId, now, async (ctx) => {
    requireMember(ctx, uid);
    await advance(ctx);
    const closes = ms(ctx.ps.timers.feedbackCloses);
    if (ctx.state !== 'happened' || closes === undefined || now >= closes || !ctx.pod!.memberUids.includes(uid)) throw new AppError('WINDOW');
    const others = ctx.pod!.memberUids.filter((m) => m !== uid);
    if (!input.notThere.every((m) => others.includes(m)) || !Object.keys(input.meetAgain).every((m) => others.includes(m))) throw new AppError('VALIDATION');
    // With `met: false` the app sends an empty `notThere`, which must not count everyone as there (D15).
    const attendance = input.met ? attendanceFromNotThere(others, input.notThere) : {};
    ctx.write((tx) =>
      tx.set(refs.podFeedback(ctx.podId, uid), {
        met: input.met,
        attendance,
        meetAgain: input.meetAgain,
        keep: input.keep,
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
      }),
    );

    const meetupAt = ms(ctx.ps.timers.meetupAt) ?? now;
    const meetWeek = weekIdAt(meetupAt);
    const answered = Object.keys(input.meetAgain).sort();
    if (answered.length > 0) {
      const hmac = deps.uidHmac();
      const keys = await Promise.all(answered.map((v) => pairKey(hmac, uid, v)));
      const snaps = await ctx.tx.getAll(...keys.map((k) => refs.pairSignal(k)));
      await ctx.loadProfiles([uid, ...answered]);
      const me = await ctx.uidH(uid);
      for (let i = 0; i < answered.length; i++) {
        const v = answered[i]!;
        const them = await ctx.uidH(v);
        const existing = snaps[i]!.data();
        const answers = { ...(existing?.answers ?? {}), [me]: input.meetAgain[v]! };
        const uidHs = (me < them ? [me, them] : [them, me]) as [string, string];
        const signal = { uidHs, answers, meetWeek, updatedAt: ts(now), expiresAt: ts(closes + PAIR_SIGNAL_TTL_MS) };
        ctx.write((tx) => tx.set(refs.pairSignal(keys[i]!), signal));
        const outcome = meetAgainOutcome(answers[me] ?? null, answers[them] ?? null, false);
        const until = recentUntilAfterMeetAgain(meetWeek, outcome, ctx.profile);
        if (until === null) continue;
        const coMemberUntil = recentUntilWeek(meetWeek, 'coMember', ctx.profile);
        applyRecent(ctx, uid, them, until, coMemberUntil);
        applyRecent(ctx, v, me, until, coMemberUntil);
      }
    }
    return { ok: true as const };
  }, 'NOT_MEMBER');
}

