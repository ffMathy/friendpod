/**
 * The pod state machine (DESIGN.md §4.6) as transitions on a PodTx. Callables and the sweeper share them, so a
 * deadline is handled the same way whoever gets there first; `advance()` processes every timer that is due, in order.
 */
import {
  NEVER_WEEK_ID,
  attendanceAtPlanLock,
  attendanceCheckPasses,
  backfillDeadline,
  canBackfill,
  feedbackClosesAt,
  feedbackTimers,
  latestReleasedDropWeek,
  markUnconfirmed,
  meetAgainOutcome,
  meetupTimers,
  membersToNudge,
  mergeRecentUntil,
  nextDropWeek,
  pairKey,
  planningDeadline,
  planningDeadlineOutcome,
  planningExtensionDeadline,
  proposalDecisionAt,
  recentUntilAfterMeetAgain,
  recentUntilWeek,
  reliability,
  resolveAttendance,
  appendNoShowEvent,
  noShowSanction,
  setRecentAfterMeetAgain,
  weekIdAt,
  winningOption,
  type AttendanceStatus,
  type FeedbackAttendance,
  type PlanningRound,
  type WeekId,
} from '@grouper/core';
import { DAY_MS, docs, ts } from '../lib/firestore';
import { applySanction } from '../lib/sanctions';
import { taskId } from '../lib/tasks';
import { ms, podAreaLabel, podDueAt, pruneRecent, recentMinUntil, type OptionDoc, type PodDoc, type PodTx, type ProfileDoc } from './context';

/** Ended pods are deleted by dailyMaintenance: 90 days after archive, 30 days after dissolving (§4.2). */
export const ARCHIVED_RETENTION_MS = 90 * DAY_MS;
export const DISSOLVED_RETENTION_MS = 30 * DAY_MS;
/** The backfill watchdog (podState.timers.backfillRetry): one re-enqueue if no invitation went out by then. */
export const BACKFILL_RETRY_AFTER_MS = 15 * 60_000;

/** Below this many members a pod that has met archives and one that has not dissolves (§3.8, §4.6). */
export const MIN_MEMBERS = 3;
/** Auto-pause after 3 declines or 2 ignored proposals in a row (§3.3, A10). */
export const AUTO_PAUSE_DECLINES = 3;
export const AUTO_PAUSE_IGNORED = 2;

export const isSensitiveTheme = (ctx: PodTx): boolean => ctx.ps.theme.kind === 'concept' && ctx.ps.theme.sensitive;

const minus = (n: number): number => Math.max(0, n - 1);

/** A transition that keeps or adds members first drops accounts that are deleting, suspended or paused (§4.6). */
export function accountActive(ctx: PodTx, uid: string): boolean {
  return ctx.user(uid)?.status === 'active' && ctx.matchProfile(uid) !== null;
}

/** Can `uid` take one more active pod (A11, S5: ≤ 2 active, ≤ 1 of them sensitive-themed)? */
export function hasRoom(ctx: PodTx, uid: string): boolean {
  const p = ctx.matchProfile(uid);
  if (!p) return false;
  return p.activePods < ctx.profile.params.maxActivePods && (!isSensitiveTheme(ctx) || p.activeSensitivePods === 0);
}

function changeActive(ctx: PodTx, uid: string, delta: 1 | -1): void {
  const sensitive = isSensitiveTheme(ctx);
  ctx.updateProfile(uid, (p) => ({
    ...p,
    activePods: delta > 0 ? p.activePods + 1 : minus(p.activePods),
    activeSensitivePods: sensitive ? (delta > 0 ? p.activeSensitivePods + 1 : minus(p.activeSensitivePods)) : p.activeSensitivePods,
  }));
}

/** Pauses an account after too many declines or ignored proposals; the app prompts to resume (§3.3). */
export function autoPause(ctx: PodTx, uid: string, reason: 'declines' | 'ignored'): void {
  const u = ctx.user(uid);
  if (!u || u.status !== 'active') return;
  const { pausedUntil: _drop, ...participation } = u.participation;
  ctx.updateUser(uid, (x) => ({ ...x, status: 'paused', participation: { ...participation, pauseReason: reason } }));
  ctx.updateProfile(uid, (p) => ({ ...p, status: 'paused', participation: { ...p.participation, pausedUntil: null } }));
}

async function setRecentWithEach(ctx: PodTx, uid: string, others: readonly string[], until: WeekId): Promise<void> {
  const hs = await Promise.all(others.filter((o) => o !== uid).map((o) => ctx.uidH(o)));
  const week = weekIdAt(ctx.now);
  ctx.updateProfile(uid, (p) => {
    const recentH = pruneRecent(p.recentH, week);
    for (const h of hs) recentH[h] = mergeRecentUntil(recentH[h], until);
    return { ...p, recentH, recentMinUntil: recentMinUntil(recentH) };
  });
}

/**
 * A member joins the confirmed pod (§3.4, §4.2): one more active pod, the co-member H5 window with every other member
 * (in both directions), the first-timer priority ends (§6.2, F35: `firstConfirmed`), and the waiting time resets.
 */
async function joinAccounting(ctx: PodTx, uid: string, members: readonly string[]): Promise<void> {
  changeActive(ctx, uid, 1);
  const until = recentUntilWeek(weekIdAt(ctx.now), 'coMember', ctx.profile);
  await setRecentWithEach(ctx, uid, members, until);
  ctx.updateProfile(uid, (p) => ({ ...p, priority: false, waitingSinceWeek: nextDropWeek(ctx.now) }));
  ctx.claimFunnel(uid, 'firstConfirmed');
}

function rosterEntry(ctx: PodTx, uid: string): PodDoc['roster'][string] {
  const u = ctx.user(uid)!;
  // S6: in a sensitive-themed pod a photo is shown only after its owner opts in for this pod.
  const photoV = isSensitiveTheme(ctx) ? null : (u.photo?.v ?? null);
  return { firstName: u.firstName, photoV, ...(u.aboutMe ? { aboutMe: u.aboutMe } : {}) };
}

/** Ordinary concepts held by ≥ 2 members, ≤ 5, unattributed, with their stored labels (§3.4, S2). */
async function podInterests(ctx: PodTx, members: readonly string[]): Promise<PodDoc['podInterests']> {
  const counts = new Map<string, number>();
  for (const uid of members) for (const c of new Set(ctx.matchProfile(uid)?.secondary ?? [])) counts.set(c, (counts.get(c) ?? 0) + 1);
  const shared = [...counts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([c]) => c)
    .slice(0, 5);
  if (shared.length === 0) return { da: [], en: [] };
  const refs = docs(ctx.deps.db);
  const snaps = await ctx.tx.getAll(...shared.map((c) => refs.concept(c)));
  const da: string[] = [];
  const en: string[] = [];
  for (const s of snaps) {
    const c = s.data();
    if (!c || c.sensitive) continue;
    if (c.labels.da) da.push(c.labels.da);
    if (c.labels.en) en.push(c.labels.en);
  }
  return { da, en };
}

/**
 * Confirmation (§3.4, §4.6 `planning` (a)) once `confirmationMin` invitees accepted: the shared pod doc with roster
 * and no theme label, photo grants (not in sensitive-themed pods, S6), and the 72 h planning window. Accepted
 * invitees whose account is no longer active, or who have no room for another active pod, are dropped first; if
 * that leaves too few, the pod stays proposed. Returns whether it confirmed.
 */
export async function confirm(ctx: PodTx): Promise<boolean> {
  const accepted = ctx.byStatus('accepted');
  await ctx.loadPeople(accepted);
  const keep: string[] = [];
  for (const uid of accepted) {
    if (accountActive(ctx, uid) && hasRoom(ctx, uid)) keep.push(uid);
    else ctx.setMember(uid, { status: 'removed' });
  }
  if (keep.length < ctx.profile.defaults.confirmationMin) return false;

  const now = ctx.now;
  const deadline = planningDeadline(now, 'confirmation');
  ctx.ps.state = 'planning';
  ctx.ps.planningExtended = false;
  ctx.ps.timers.planDeadline = ts(deadline);
  ctx.setPod({
    state: 'planning',
    weekId: ctx.ps.weekId,
    areaLabel: podAreaLabel(ctx.ps.componentId),
    theme: ctx.ps.theme,
    memberUids: keep,
    roster: Object.fromEntries(keep.map((uid) => [uid, rosterEntry(ctx, uid)])),
    podInterests: await podInterests(ctx, keep),
    planning: { deadline: ts(deadline) },
    confirmedAt: ts(now),
  });
  if (!isSensitiveTheme(ctx)) for (const a of keep) for (const b of keep) ctx.grant(a, b);
  for (const uid of keep) await joinAccounting(ctx, uid, keep);
  ctx.push('podConfirmed', keep);
  return true;
}

/**
 * A late accept after confirmation (§3.4): the invitee joins while the pod plans, or (an original invitee only)
 * after the plan locked, with attendance `pending`. False when the account cannot take the pod.
 */
export async function lateJoin(ctx: PodTx, uid: string): Promise<boolean> {
  const pod = ctx.pod!;
  const members = pod.memberUids;
  await ctx.loadPeople([uid, ...members]);
  if (!accountActive(ctx, uid) || !hasRoom(ctx, uid)) return false;
  if (members.length >= ctx.profile.params.maxSize) return false;
  const sensitive = isSensitiveTheme(ctx);
  await ctx.loadCards(members);
  ctx.updatePod((p) => ({
    ...p,
    memberUids: [...p.memberUids, uid].sort(),
    roster: { ...p.roster, [uid]: rosterEntry(ctx, uid) },
    ...(p.attendance ? { attendance: { ...p.attendance, [uid]: 'pending' as const } } : {}),
  }));
  if (ctx.state === 'scheduled') ctx.setMember(uid, { attendance: 'pending', attendanceAt: ts(ctx.now) });
  for (const m of members) {
    // S6: a member's photo reaches the newcomer only if that member shows it to this pod.
    if (!sensitive || ctx.card(m)?.photoShared === true) ctx.grant(m, uid);
    if (!sensitive) ctx.grant(uid, m);
  }
  await joinAccounting(ctx, uid, [...members, uid]);
  for (const m of members) await setRecentWithEach(ctx, m, [uid], recentUntilWeek(weekIdAt(ctx.now), 'coMember', ctx.profile));
  return true;
}

/**
 * Removes a member (leave, Keep-loop exclusion, or an account that can no longer stay): roster, memberUids and
 * attendance first, grants in both directions, and in `planning` their options and votes (§3.8, §10.1 leavePod).
 */
export async function removeFromPod(ctx: PodTx, uid: string, status: 'left' | 'removed'): Promise<void> {
  const m = ctx.ps.members[uid];
  if (!m) return;
  const wasCurrent = ctx.pod?.memberUids.includes(uid) ?? false;
  ctx.setMember(uid, { status });
  if (!ctx.pod || !wasCurrent) return;
  await ctx.loadProfiles([uid]);
  ctx.updatePod((p) => {
    const { [uid]: _gone, ...roster } = p.roster;
    const attendance = p.attendance ? Object.fromEntries(Object.entries(p.attendance).filter(([k]) => k !== uid)) : undefined;
    return { ...p, memberUids: p.memberUids.filter((x) => x !== uid), roster, ...(attendance ? { attendance } : {}) };
  });
  if (ctx.isActive) changeActive(ctx, uid, -1);
  for (const other of ctx.ps.memberList) {
    ctx.revoke(uid, other);
    ctx.revoke(other, uid);
  }
  if (ctx.state === 'planning') {
    await ctx.loadOptions();
    for (const [id, o] of ctx.currentOptions()) {
      if (o.authorUid === uid) ctx.deleteOption(id);
      else if (o.votes[uid] !== undefined) {
        const { [uid]: _v, ...votes } = o.votes;
        ctx.setOption(id, { ...o, votes });
      }
    }
  }
}

/**
 * The automated no-show rule after a new no-show or late cancel (§4.4): 2 weight within 8 weeks → a 2-week pause and
 * the re-commit pledge, 3 → an 8-week suspension; each with a statement of reasons, each expiring on its own (A38).
 * Runs inside the pod transaction, so the sanction commits with the event that caused it.
 */
export async function checkNoShowSanction(ctx: PodTx, uid: string): Promise<void> {
  const user = ctx.user(uid);
  const profile = ctx.matchProfile(uid);
  if (!user || !profile) return;
  const decision = noShowSanction(profile.noShowEvents, weekIdAt(ctx.now), ctx.now);
  if (!decision) return;
  const existing = (await ctx.tx.get(docs(ctx.deps.db).sanction(uid))).data() ?? null;
  const applied = applySanction(ctx.deps.db, uid, { user, profile, existing }, decision, ctx.now);
  if (!applied) return;
  ctx.updateUser(uid, () => applied.user);
  ctx.updateProfile(uid, () => applied.profile);
  ctx.write(applied.write);
}

/** Starts the one backfill round (§4.2, D6) and enqueues `backfillPod`; the caller has checked canBackfill. */
export function startBackfill(ctx: PodTx): void {
  const now = ctx.now;
  const until =
    ctx.state === 'proposed'
      ? backfillDeadline(now, { state: 'proposed', weekId: ctx.ps.weekId })
      : backfillDeadline(now, { state: 'planning', planDeadline: ms(ctx.ps.timers.planDeadline) ?? now });
  if (until <= now) return;
  ctx.ps.backfill = { used: true, until: ts(until) };
  ctx.ps.timers.backfillUntil = ts(until);
  ctx.ps.timers.backfillRetry = ts(Math.min(until, now + BACKFILL_RETRY_AFTER_MS));
  ctx.task('backfillPod', { weekId: latestReleasedDropWeek(now), podId: ctx.podId }, { id: taskId('backfill', ctx.podId) });
}

export const mayBackfill = (ctx: PodTx): boolean => canBackfill(ctx.state, ctx.ps.backfill.used, ctx.ps.planLockedAt !== undefined);

/**
 * Ends the pod: `archived` once it has met, otherwise `dissolved` (§4.6). Options and every photo grant entry for the
 * pod go; members leave their active count; members of a dissolved pod who accepted get priority next week.
 */
export async function endPod(ctx: PodTx, kind: 'archived' | 'dissolved' = ctx.ps.hasMet ? 'archived' : 'dissolved'): Promise<void> {
  const members = ctx.currentMembers();
  await ctx.loadPeople([...members, ...ctx.byStatus('invited')]);
  if (ctx.isActive) for (const uid of members) changeActive(ctx, uid, -1);
  if (kind === 'dissolved') for (const uid of members) ctx.updateProfile(uid, (p) => ({ ...p, priority: true }));
  for (const uid of ctx.byStatus('invited')) ctx.setMember(uid, { status: 'expired' });
  await ctx.loadOptions();
  for (const id of ctx.currentOptions().keys()) ctx.deleteOption(id);
  ctx.revokeAll();
  ctx.ps.state = kind;
  ctx.ps.timers = { acceptBy: ctx.ps.timers.acceptBy };
  ctx.ps.deleteAt = ts(ctx.now + (kind === 'archived' ? ARCHIVED_RETENTION_MS : DISSOLVED_RETENTION_MS));
  if (ctx.pod) ctx.updatePod((p) => ({ ...p, state: kind, ...(kind === 'archived' ? { archivedAt: ts(ctx.now) } : {}) }));
  ctx.push('podChanged', members);
}

const MEETUP_TIMERS = ['meetupAt', 'stillComing3d', 'stillComing24h', 'nudge6h', 'attendanceCheck', 'reminder', 'happened', 'feedbackPush', 'feedbackReminder', 'feedbackCloses'] as const;

/**
 * A new planning round (§4.6 `planning` (b) Keep loop, (c) reschedule): old options deleted, `meetupAt` cleared (the
 * meetup chat closes at once), a fresh deadline (72 h, 48 h for a reschedule) and a fresh extension.
 */
export async function enterPlanning(ctx: PodTx, round: Exclude<PlanningRound, 'confirmation'>): Promise<void> {
  const wasActive = ctx.isActive;
  const members = ctx.currentMembers();
  await ctx.loadPeople(members);
  for (const uid of members) {
    const stays = accountActive(ctx, uid) && (wasActive || hasRoom(ctx, uid));
    if (!stays) await removeFromPod(ctx, uid, 'removed');
  }
  if (ctx.currentMembers().length < MIN_MEMBERS) return endPod(ctx);

  await ctx.loadOptions();
  for (const id of ctx.currentOptions().keys()) ctx.deleteOption(id);
  const deadline = planningDeadline(ctx.now, round);
  ctx.ps.state = 'planning';
  ctx.ps.planningExtended = false;
  if (round === 'reschedule') ctx.ps.rescheduled = true;
  if (round === 'keep') ctx.ps.rescheduled = false;
  const timers = { ...ctx.ps.timers };
  for (const k of MEETUP_TIMERS) delete timers[k];
  ctx.ps.timers = { ...timers, planDeadline: ts(deadline) };
  for (const uid of ctx.currentMembers()) {
    const { attendance: _a, attendanceAt: _b, lateCancelled: _c, ...m } = ctx.ps.members[uid]!;
    ctx.ps.members[uid] = m;
  }
  ctx.updatePod((p) => {
    const { attendance: _a, ...rest } = p;
    return { ...rest, state: 'planning', planning: { deadline: ts(deadline) } };
  });
  if (!wasActive) for (const uid of ctx.currentMembers()) changeActive(ctx, uid, 1);
  ctx.push('podChanged', ctx.currentMembers());
}

/**
 * Plan lock (§3.6, §4.6 `scheduled`): the winning option's time and place on the pod, `planLockedAt`, attendance from
 * the votes (a yes vote counts as coming, D5) and the timers of meetupTimers(). Backfill invitations still open lapse:
 * nobody new joins once the plan is fixed (D6).
 */
export function lockPlan(ctx: PodTx, optionId: string, option: OptionDoc): void {
  const now = ctx.now;
  const meetupAt = option.startsAt.toMillis();
  const t = meetupTimers(meetupAt, now);
  const members = ctx.currentMembers();
  const statuses = attendanceAtPlanLock(members, option.votes);
  ctx.ps.state = 'scheduled';
  ctx.ps.planLockedAt = ts(now);
  ctx.ps.timers = {
    ...ctx.ps.timers,
    meetupAt: ts(meetupAt),
    ...(t.stillComing3d !== null ? { stillComing3d: ts(t.stillComing3d) } : {}),
    stillComing24h: ts(t.stillComing24h),
    ...(t.nudge6h !== null ? { nudge6h: ts(t.nudge6h) } : {}),
    attendanceCheck: ts(t.attendanceCheck),
    reminder: ts(t.reminder),
    happened: ts(t.happened),
  };
  for (const uid of members) ctx.setMember(uid, { attendance: statuses[uid]!, attendanceAt: ts(now) });
  for (const uid of ctx.byStatus('invited')) if (ctx.ps.members[uid]!.viaBackfill) ctx.setMember(uid, { status: 'expired' });
  ctx.updatePod((p) => ({
    ...p,
    state: 'scheduled',
    planning: { ...p.planning, winningOptionId: optionId, meetupAt: ts(meetupAt), place: option.place, planLockedAt: ts(now) },
    attendance: statuses,
  }));
  ctx.push('podChanged', members);
}

export function attendanceStatuses(ctx: PodTx): Record<string, AttendanceStatus> {
  return Object.fromEntries(ctx.currentMembers().map((uid) => [uid, ctx.ps.members[uid]?.attendance ?? 'pending']));
}

export function setAttendance(ctx: PodTx, uid: string, status: AttendanceStatus): void {
  ctx.setMember(uid, { attendance: status, attendanceAt: ts(ctx.now) });
  ctx.updatePod((p) => ({ ...p, attendance: { ...(p.attendance ?? {}), [uid]: status } }));
}

/** Fewer than 3 coming: the one reschedule round, then the meetup is cancelled (§3.6, §4.6). */
export async function attendanceFailure(ctx: PodTx): Promise<void> {
  if (!ctx.ps.rescheduled) await enterPlanning(ctx, 'reschedule');
  else await endPod(ctx);
}

/**
 * Who can still come: `coming`, plus `pending` while the T−3 h check has not run (they may still answer).
 * DESIGN-DEVIATION: §3.6 runs the check at once when a cancellation "leaves fewer than 3 coming"; counting members
 * who have not answered yet keeps one early "Can't make it" from rescheduling a meetup that others may still confirm.
 */
export function possibleAttendees(ctx: PodTx): number {
  const checkDone = ctx.ps.timers.attendanceCheck === undefined;
  return Object.values(attendanceStatuses(ctx)).filter((s) => s === 'coming' || (!checkDone && s === 'pending')).length;
}

/** After someone leaves or is removed (§3.8, §4.2, §4.6): backfill, dissolve or archive, or the attendance check. */
export async function afterMemberLoss(ctx: PodTx): Promise<void> {
  if (ctx.state === 'proposed') {
    const open = ctx.byStatus('accepted', 'invited').length;
    if (open < ctx.profile.defaults.confirmationMin && mayBackfill(ctx)) startBackfill(ctx);
    return;
  }
  if (ctx.state === 'archived' || ctx.state === 'dissolved') return;
  const n = ctx.currentMembers().length;
  if (n < MIN_MEMBERS) return endPod(ctx);
  if (ctx.state === 'planning' && n === MIN_MEMBERS && mayBackfill(ctx)) startBackfill(ctx);
  else if (ctx.state === 'scheduled' && possibleAttendees(ctx) < MIN_MEMBERS) await attendanceFailure(ctx);
}

/** Lets unanswered invitations lapse at their deadline (§4.6); each counts as one ignored proposal. */
async function expireInvites(ctx: PodTx): Promise<boolean> {
  const now = ctx.now;
  const t = ctx.ps.timers;
  const due = ctx
    .byStatus('invited')
    .filter((uid) => {
      const m = ctx.ps.members[uid]!;
      const deadline = m.viaBackfill ? ms(t.backfillUntil) : t.acceptBy.toMillis();
      return deadline !== undefined && deadline <= now;
    });
  if (due.length === 0) return false;
  await ctx.loadPeople(due);
  for (const uid of due) {
    ctx.setMember(uid, { status: 'expired' });
    ctx.updateProfile(uid, (p) => ({ ...p, ignoredInRow: p.ignoredInRow + 1 }));
    if ((ctx.matchProfile(uid)?.ignoredInRow ?? 0) >= AUTO_PAUSE_IGNORED) autoPause(ctx, uid, 'ignored');
  }
  return true;
}

async function proposedDeadline(ctx: PodTx): Promise<void> {
  const min = ctx.profile.defaults.confirmationMin;
  const accepted = ctx.byStatus('accepted').length;
  if (accepted >= min && (await confirm(ctx))) return;
  const acceptedNow = ctx.byStatus('accepted').length;
  if (acceptedNow === min - 1 && mayBackfill(ctx)) {
    startBackfill(ctx);
    if (ctx.ps.backfill.used) return;
  }
  const decision = proposalDecisionAt(ctx.ps.timers.acceptBy.toMillis(), ms(ctx.ps.timers.backfillUntil) ?? null);
  if (ctx.now >= decision) await endPod(ctx, 'dissolved');
}

/** Planning deadline (§3.5, D7): schedule the winner, extend once, or dissolve / archive. */
async function planDeadlineStep(ctx: PodTx): Promise<void> {
  await ctx.loadOptions();
  const options = [...ctx.currentOptions()].map(([id, o]) => ({ id, startsAt: o.startsAt.toMillis(), votes: o.votes, doc: o }));
  const winner = winningOption(options, ctx.currentMembers(), ctx.now);
  const outcome = planningDeadlineOutcome({ hasWinner: winner !== null, extensionUsed: ctx.ps.planningExtended, hasMet: ctx.ps.hasMet });
  if (outcome === 'schedule') return lockPlan(ctx, winner!.id, options.find((o) => o.id === winner!.id)!.doc);
  if (outcome === 'extend') {
    const next = planningExtensionDeadline(ctx.ps.timers.planDeadline!.toMillis());
    ctx.ps.planningExtended = true;
    ctx.ps.timers.planDeadline = ts(next);
    ctx.updatePod((p) => ({ ...p, planning: { ...p.planning, deadline: ts(next), extended: true } }));
    ctx.push('podChanged', ctx.currentMembers());
    return;
  }
  await endPod(ctx, outcome === 'archive' ? 'archived' : 'dissolved');
}

/** T+2 h (§4.6 `happened`): the feedback timers, and the first or second meetup in the funnel for those coming. */
async function toHappened(ctx: PodTx): Promise<void> {
  const members = ctx.currentMembers();
  await ctx.loadPeople(members);
  const meetupAt = ctx.ps.timers.meetupAt!.toMillis();
  const f = feedbackTimers(meetupAt);
  const { stillComing3d: _a, stillComing24h: _b, nudge6h: _c, attendanceCheck: _d, reminder: _e, happened: _f, ...rest } = ctx.ps.timers;
  // Feedback stays open 7 days from `happened` (T+2 h), not from when the sweeper got there.
  ctx.ps.timers = { ...rest, feedbackPush: ts(f.push), feedbackReminder: ts(f.reminder), feedbackCloses: ts(feedbackClosesAt(meetupTimers(meetupAt, meetupAt).happened)) };
  ctx.ps.state = 'happened';
  ctx.ps.hasMet = true;
  ctx.updatePod((p) => ({ ...p, state: 'happened' }));
  for (const uid of members) {
    changeActive(ctx, uid, -1);
    if (ctx.ps.members[uid]?.attendance === 'coming') ctx.claimFunnel(uid, 'meetupHappened');
  }
}

async function feedbackDocs(ctx: PodTx, members: readonly string[]): Promise<Map<string, FeedbackAttendance & { keep: boolean }>> {
  const refs = docs(ctx.deps.db);
  const snaps = members.length > 0 ? await ctx.tx.getAll(...members.map((m) => refs.podFeedback(ctx.podId, m))) : [];
  const out = new Map<string, FeedbackAttendance & { keep: boolean }>();
  snaps.forEach((s, i) => {
    const d = s.data();
    if (d) out.set(members[i]!, d);
  });
  return out;
}

/**
 * Feedback closes (§3.6, §4.4, D9): the majority rule turns "Who was there?" into attended / no-show counters and
 * reliability; mutual meet-again answers shorten the pair's H5 window, a "no" stays never; then the Keep loop (≥ 3
 * Keep → a new planning round with those members only) or archive.
 */
async function closeFeedback(ctx: PodTx): Promise<void> {
  const members = ctx.currentMembers();
  await ctx.loadPeople(members);
  const feedback = await feedbackDocs(ctx, members);
  const cancelled = new Set(members.filter((uid) => ctx.ps.members[uid]?.attendance === 'notComing'));
  const resolved = resolveAttendance(members, Object.fromEntries(feedback), cancelled);
  const meetupAt = ms(ctx.ps.timers.meetupAt) ?? ctx.now;
  const meetWeek = weekIdAt(meetupAt);
  for (const uid of members) {
    const r = resolved[uid]!;
    if (r.outcome !== 'attended' && r.outcome !== 'noShow') continue;
    const u = ctx.user(uid);
    if (!u) continue;
    const stats = { ...u.stats, ...(r.outcome === 'attended' ? { attended: u.stats.attended + 1 } : { noShows: u.stats.noShows + 1 }) };
    ctx.updateUser(uid, (x) => ({ ...x, stats }));
    ctx.updateProfile(uid, (p) => ({
      ...p,
      reliability: reliability(stats),
      ...(r.outcome === 'noShow' ? { noShowEvents: appendNoShowEvent(p.noShowEvents, { weekId: meetWeek, w: 1 }, weekIdAt(ctx.now)) } : {}),
      ...(r.outcome === 'attended' && r.cameVotes >= 2 ? { attendedVerified: p.attendedVerified + 1 } : {}),
    }));
    if (r.outcome === 'noShow') await checkNoShowSanction(ctx, uid);
  }
  await applyMeetAgain(ctx, members, true);

  const keepers = members.filter((uid) => feedback.get(uid)?.keep === true);
  if (keepers.length >= MIN_MEMBERS) {
    for (const uid of members) if (!keepers.includes(uid)) await removeFromPod(ctx, uid, 'left');
    await enterPlanning(ctx, 'keep');
  } else {
    await endPod(ctx, 'archived');
  }
}

/**
 * Applies the pair signals of these members (D9, §6.1 H5): either "no" → NEVER_WEEK_ID on both profiles; both "yes" →
 * the meet-again window. `closing` also deletes the signals, which are then fully applied (PRIVACY.md §5).
 */
export async function applyMeetAgain(ctx: PodTx, members: readonly string[], closing: boolean): Promise<void> {
  const hmac = ctx.deps.uidHmac();
  const pairs: [string, string][] = [];
  for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) pairs.push([members[i]!, members[j]!]);
  if (pairs.length === 0) return;
  const refs = docs(ctx.deps.db);
  const keys = await Promise.all(pairs.map(([a, b]) => pairKey(hmac, a, b)));
  const snaps = await ctx.tx.getAll(...keys.map((k) => refs.pairSignal(k)));
  await ctx.loadProfiles(members);
  for (let i = 0; i < pairs.length; i++) {
    const signal = snaps[i]!.data();
    if (!signal) continue;
    const [a, b] = pairs[i]!;
    const [ha, hb] = await Promise.all([ctx.uidH(a), ctx.uidH(b)]);
    const outcome = meetAgainOutcome(signal.answers[ha] ?? null, signal.answers[hb] ?? null, closing);
    const next = recentUntilAfterMeetAgain(signal.meetWeek, outcome, ctx.profile);
    if (next !== null) {
      const coMemberUntil = recentUntilWeek(signal.meetWeek, 'coMember', ctx.profile);
      applyRecent(ctx, a, hb, next, coMemberUntil);
      applyRecent(ctx, b, ha, next, coMemberUntil);
    }
    if (closing) ctx.write((tx) => tx.delete(refs.pairSignal(keys[i]!)));
  }
}

export function applyRecent(ctx: PodTx, uid: string, otherH: string, next: WeekId, coMemberUntil: WeekId): void {
  ctx.updateProfile(uid, (p: ProfileDoc) => {
    const recentH = { ...p.recentH, [otherH]: next === NEVER_WEEK_ID ? NEVER_WEEK_ID : setRecentAfterMeetAgain(p.recentH[otherH], next, coMemberUntil) };
    return { ...p, recentH, recentMinUntil: recentMinUntil(recentH) };
  });
}

/** Pushes for the scheduled timers make no sense once the meetup has started (a sweeper that ran very late). */
const beforeMeetup = (ctx: PodTx): boolean => ctx.now < (ms(ctx.ps.timers.meetupAt) ?? 0);

async function scheduledStep(ctx: PodTx): Promise<void> {
  const t = ctx.ps.timers;
  const candidates = (['stillComing3d', 'stillComing24h', 'nudge6h', 'attendanceCheck', 'reminder', 'happened'] as const)
    .map((k) => [k, ms(t[k])] as const)
    .filter((x): x is readonly [(typeof x)[0], number] => x[1] !== undefined)
    .sort((a, b) => a[1] - b[1]);
  const next = candidates[0];
  if (!next || next[1] > ctx.now) return;
  const [key] = next;
  delete ctx.ps.timers[key];
  const members = ctx.currentMembers();
  switch (key) {
    case 'stillComing3d':
      if (beforeMeetup(ctx)) ctx.push('stillComing', members);
      return;
    case 'stillComing24h':
      // "Still coming?" to every member, and the one "Your pod chat is open" (the chat opens by time, §4.6).
      if (beforeMeetup(ctx)) {
        ctx.push('stillComing', members);
        ctx.push('chatOpen', members);
      }
      return;
    case 'nudge6h':
      if (beforeMeetup(ctx)) ctx.push('stillComing', membersToNudge(attendanceStatuses(ctx)));
      return;
    case 'attendanceCheck': {
      const timers = meetupTimers(ms(t.meetupAt)!, ms(ctx.ps.planLockedAt)!);
      if (timers.markUnconfirmed) {
        const marked = markUnconfirmed(attendanceStatuses(ctx));
        for (const [uid, s] of Object.entries(marked)) if (s !== ctx.ps.members[uid]?.attendance) setAttendance(ctx, uid, s);
      }
      if (!attendanceCheckPasses(attendanceStatuses(ctx))) await attendanceFailure(ctx);
      return;
    }
    case 'reminder':
      if (beforeMeetup(ctx)) ctx.push('meetupReminder', members.filter((uid) => ctx.ps.members[uid]?.attendance !== 'notComing'));
      return;
    case 'happened':
      await toHappened(ctx);
      return;
  }
}

async function happenedStep(ctx: PodTx): Promise<void> {
  const t = ctx.ps.timers;
  const candidates = (['feedbackPush', 'feedbackReminder', 'feedbackCloses'] as const)
    .map((k) => [k, ms(t[k])] as const)
    .filter((x): x is readonly [(typeof x)[0], number] => x[1] !== undefined)
    .sort((a, b) => a[1] - b[1]);
  const next = candidates[0];
  if (!next || next[1] > ctx.now) return;
  const [key] = next;
  const members = ctx.currentMembers();
  if (key === 'feedbackCloses') return closeFeedback(ctx);
  delete ctx.ps.timers[key];
  const open = ctx.now < (ms(t.feedbackCloses) ?? 0);
  if (key === 'feedbackPush' && open) ctx.push('feedback', members);
  if (key === 'feedbackReminder' && open) {
    const given = await feedbackDocs(ctx, members);
    ctx.push('feedback', members.filter((uid) => !given.has(uid)));
  }
}

/**
 * The backfill watchdog: the `backfillPod` task is enqueued after the commit that started the round, and an enqueue
 * that failed then would leave the round without invitations. Once, 15 minutes later, the task is enqueued again under
 * a new id if nobody was invited yet (the task itself is idempotent). Returns whether the timer was due.
 */
function backfillRetryStep(ctx: PodTx): boolean {
  const due = ms(ctx.ps.timers.backfillRetry);
  if (due === undefined || due > ctx.now) return false;
  delete ctx.ps.timers.backfillRetry;
  const until = ms(ctx.ps.backfill.until);
  const invited = Object.values(ctx.ps.members).some((m) => m.viaBackfill);
  if (!invited && until !== undefined && until > ctx.now && canBackfill(ctx.state, false, ctx.ps.planLockedAt !== undefined)) {
    ctx.task('backfillPod', { weekId: latestReleasedDropWeek(ctx.now), podId: ctx.podId }, { id: taskId('backfill', ctx.podId, 'retry') });
  }
  return true;
}

const signature = (ctx: PodTx): string => JSON.stringify([ctx.ps.state, podDueAt(ctx.ps), Object.values(ctx.ps.members).map((m) => m.status)]);

/** Processes every timer of the pod that is due at `ctx.now`, earliest first (§4.1); idempotent. */
export async function advance(ctx: PodTx): Promise<void> {
  for (let i = 0; i < 24; i++) {
    const due = podDueAt(ctx.ps);
    if (due === null || due > ctx.now) return;
    const before = signature(ctx);
    if (backfillRetryStep(ctx)) continue;
    if (!(await expireInvites(ctx))) {
      if (ctx.state === 'proposed') await proposedDeadline(ctx);
      else if (ctx.state === 'planning') await planDeadlineStep(ctx);
      else if (ctx.state === 'scheduled') await scheduledStep(ctx);
      else if (ctx.state === 'happened') await happenedStep(ctx);
    }
    if (signature(ctx) === before) {
      ctx.deps.log.warn('pod.stuckTimer', { state: ctx.state });
      return;
    }
  }
}

