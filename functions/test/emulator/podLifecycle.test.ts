/**
 * The pod lifecycle after release (DESIGN.md §3.3–§3.8, §4.6) against the Firestore emulator: confirmation, races on
 * podState, planning with its extension round, attendance, feedback with the no-show majority and meet-again pair
 * signals, the Keep loop, leaving, photo sharing and the funnel. Deadlines run on an injected clock. This file owns
 * drop weeks 2027-W10, 2026-W43 and 2027-W12; the global sweep runs only at 2026 instants, before any other test's
 * pod is due.
 */
import {
  NEVER_WEEK_ID,
  addWeeks,
  dropSchedule,
  feedbackTimers,
  fromLocal,
  meetupTimers,
  pairKey,
  uidHash,
  weekIdAt,
  type CallableInput,
  type CallableName,
  type CallableOutput,
  type WeekId,
} from '@grouper/core';
import { expect, it } from 'vitest';
import * as pods from '../../src/callables/pods';
import { docs, ts } from '../../src/lib/firestore';
import type { CallContext } from '../../src/lib/handler';
import type { AppDeps } from '../../src/lib/runtime';
import { withPod } from '../../src/pods/effects';
import { sweepPods } from '../../src/pods/sweeper';
import { advance } from '../../src/pods/transitions';
import { describeEmulator, emulatorDeps, errorCode, invoke } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { forbidInLogs } from '../helpers/logCapture';
import { AARHUS_CELL, makeUser, makeUsers, newConcept, place, pushedUids, read, releasedPod } from '../helpers/pods';

const W10 = '2027-W10' as WeekId;
const R = dropSchedule(W10).releaseAt;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const local = (year: number, month: number, day: number, hour: number, minute = 0) => fromLocal({ year, month, day, hour, minute });

type Impl<N extends CallableName> = (deps: AppDeps, call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

describeEmulator('pod lifecycle (emulator)', () => {
  const deps = emulatorDeps(R);

  function call<N extends CallableName>(name: N, impl: Impl<N>, uid: string, data: unknown, at?: number): Promise<CallableOutput<N>> {
    if (at !== undefined) deps.clock.now = at;
    return invoke(name, impl, deps, data, { uid });
  }
  const accept = (podId: string, uid: string, at?: number) => call('respondToPod', pods.respondToPod, uid, { podId, accept: true }, at);
  /** The sweeper's work for one pod at `t` (the global sweep would also touch other test files' pods). */
  const sweepPod = (podId: string, t: number) => {
    deps.clock.now = t;
    return withPod(deps, podId, t, (ctx) => advance(ctx));
  };
  const state = async (podId: string) => (await read.podState(deps, podId))!;

  async function proposedPod(n: number, o: { weekId?: WeekId; cell?: string; sensitive?: boolean; theme?: string } = {}) {
    const theme = o.theme ?? newConcept();
    const members = await makeUsers(deps, n, { themes: [{ c: theme, sens: o.sensitive ?? false }], ...(o.cell ? { gh5: o.cell, areaId: 'aarhus' } : {}) });
    const podId = await releasedPod(deps, members, { weekId: o.weekId ?? W10, theme, sensitive: o.sensitive ?? false, ...(o.cell ? { componentId: o.cell } : {}) });
    return { podId, members, theme };
  }

  async function planningPod(n: number, o: { weekId?: WeekId; sensitive?: boolean } = {}) {
    const p = await proposedPod(n, o);
    const t = dropSchedule(o.weekId ?? W10).releaseAt + HOUR;
    for (const uid of p.members) await accept(p.podId, uid, t);
    expect((await state(p.podId)).state).toBe('planning');
    return p;
  }

  async function option(podId: string, uid: string, startsAt: number, at?: number) {
    return (await call('proposeOption', pods.proposeOption, uid, { podId, startsAt, place: place() }, at)).optionId;
  }
  const vote = (podId: string, uid: string, optionId: string, v: 'yes' | 'no' | null, at?: number) => call('voteOption', pods.voteOption, uid, { podId, optionId, vote: v }, at);

  /** A pod locked on one option by a unanimous yes at `lockAt`. */
  async function scheduledPod(n: number, meetupAt: number, lockAt: number, o: { weekId?: WeekId } = {}) {
    const p = await planningPod(n, o);
    const optionId = await option(p.podId, p.members[0]!, meetupAt, lockAt);
    for (const uid of p.members) await vote(p.podId, uid, optionId, 'yes', lockAt);
    expect((await state(p.podId)).state).toBe('scheduled');
    return { ...p, optionId };
  }

  const funnelCount = async (weekId: WeekId, stage: string) => (await read.funnel(deps, null, weekId))?.counts?.[stage] ?? 0;

  it('confirms at the launch profile\'s 4th accept: pod doc without a label, roster, grants, cards, funnel; a 5th joins late', async () => {
    const { podId, members, theme } = await proposedPod(5);
    const [a, b, c, d, e] = members as [string, string, string, string, string];
    forbidInLogs(...members);
    await docs(deps.db).user(a).update({ photo: { v: 3 }, aboutMe: 'New in town' });
    const confirmedBefore = await funnelCount(weekIdAt(R + HOUR), 'firstConfirmed');
    for (const uid of [a, b, c]) expect(await accept(podId, uid, R + HOUR)).toEqual({ state: 'proposed', acceptedCount: expect.any(Number) });
    expect((await read.card(deps, e, podId))!.acceptedCount).toBe(3);
    const pushes = deps.pushes.length;
    expect(await accept(podId, d, R + HOUR)).toEqual({ state: 'planning', acceptedCount: 4 });

    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).toEqual([a, b, c, d].sort());
    expect(pod.theme).toEqual({ kind: 'concept', conceptId: theme, sensitive: false });
    expect(pod.roster[a]).toEqual({ firstName: 'Ada', photoV: 3, aboutMe: 'New in town' });
    expect(pod.planning.deadline.toMillis()).toBe(R + HOUR + 72 * HOUR);
    expect(JSON.stringify(pod)).not.toContain('my ');
    for (const x of [a, b, c, d]) {
      for (const y of [a, b, c, d]) if (x !== y) expect((await read.grant(deps, x, y))?.pods, `${x}->${y}`).toContain(podId);
      const p = await read.profile(deps, x);
      expect(p).toMatchObject({ activePods: 1, priority: false });
      expect(p.milestones.firstConfirmedAt).toBeDefined();
      expect((await read.card(deps, x, podId))).toMatchObject({ state: 'planning', myStatus: 'accepted', acceptedCount: 4 });
    }
    expect(await read.grant(deps, a, e)).toBeUndefined();
    expect(pushedUids(deps, 'podConfirmed', pushes)).toEqual([a, b, c, d].sort());
    expect((await funnelCount(weekIdAt(R + HOUR), 'firstConfirmed')) - confirmedBefore).toBe(4);
    expect((await read.card(deps, e, podId))).toMatchObject({ state: 'planning', myStatus: 'invited', acceptedCount: 4 });

    // A late accept before the deadline joins the planning pod (§3.4).
    expect(await accept(podId, e, R + 2 * HOUR)).toEqual({ state: 'planning', acceptedCount: 5 });
    expect((await read.pod(deps, podId))!.memberUids).toContain(e);
    expect((await read.grant(deps, e, a))?.pods).toContain(podId);
    expect((await read.grant(deps, a, e))?.pods).toContain(podId);
    // Accepting again is a no-op; a stranger is not invited.
    expect(await accept(podId, e, R + 2 * HOUR)).toEqual({ state: 'planning', acceptedCount: 5 });
    const stranger = await makeUser(deps);
    expect(await errorCode(accept(podId, stranger))).toBe('NOT_INVITED');
  });

  it('races: six concurrent accepts confirm exactly once and count each member once in the funnel', async () => {
    const { podId, members } = await proposedPod(6);
    const week = weekIdAt(R + HOUR);
    const before = await funnelCount(week, 'firstConfirmed');
    const pushes = deps.pushes.length;
    deps.clock.now = R + HOUR;
    const results = await Promise.all(members.map((uid) => invoke('respondToPod', pods.respondToPod, deps, { podId, accept: true }, { uid })));
    expect(results.filter((r) => r.state === 'planning').length).toBeGreaterThanOrEqual(3);
    const ps = await state(podId);
    expect(ps.state).toBe('planning');
    // Each call is one compare-and-set on podState: version 0 at release, +1 per accept.
    expect(ps.version).toBe(6);
    expect((await read.pod(deps, podId))!.memberUids).toEqual([...members].sort());
    expect(deps.pushes.slice(pushes).filter((p) => p.kind === 'podConfirmed')).toHaveLength(1);
    expect((await funnelCount(week, 'firstConfirmed')) - before).toBe(6);
    for (const uid of members) expect((await read.profile(deps, uid)).activePods).toBe(1);
  });

  it('confirms an alpha-profile pod at 3 accepts (Q19 d)', async () => {
    const { podId, members } = await proposedPod(4, { cell: AARHUS_CELL });
    for (const uid of members.slice(0, 2)) await accept(podId, uid, R + HOUR);
    expect(await accept(podId, members[2]!, R + HOUR)).toEqual({ state: 'planning', acceptedCount: 3 });
  });

  it('declines: auto-pause after the third in a row, backfill when too few remain, DEADLINE after acceptBy, dissolve at decision time', async () => {
    const { podId, members } = await proposedPod(5);
    const [a, b, c, d, e] = members as [string, string, string, string, string];
    await docs(deps.db).matchProfile(a).update({ declinesInRow: 2 });
    await call('respondToPod', pods.respondToPod, a, { podId, accept: false, reason: 'notThisWeek' }, R + HOUR);
    expect((await read.user(deps, a))!.status).toBe('paused');
    expect((await read.profile(deps, a))).toMatchObject({ status: 'paused', declinesInRow: 3 });
    expect((await read.card(deps, a, podId))!.myStatus).toBe('declined');
    expect((await read.card(deps, a, podId))!.expiresAt!.toMillis()).toBe(R + HOUR + 14 * DAY);
    expect((await state(podId)).backfill.used).toBe(false);
    await call('respondToPod', pods.respondToPod, b, { podId, accept: false }, R + HOUR);
    // 3 left of 5 can no longer reach 4: the one backfill round starts.
    const ps = await state(podId);
    expect(ps.backfill.used).toBe(true);
    expect(deps.enqueued.some((t) => t.queue === 'backfillPod' && t.data.podId === podId)).toBe(true);
    await accept(podId, c, R + HOUR);
    expect(await errorCode(accept(podId, d, dropSchedule(W10).acceptBy))).toBe('DEADLINE');
    // The backfill found nobody: at the later of acceptBy and the backfill deadline (here acceptBy) it dissolves.
    expect(ps.timers.backfillUntil!.toMillis()).toBe(R + HOUR + DAY);
    await sweepPod(podId, dropSchedule(W10).acceptBy - 1);
    expect((await state(podId)).state).toBe('proposed');
    await sweepPod(podId, dropSchedule(W10).acceptBy);
    expect((await state(podId)).members[d]!.status).toBe('expired');
    expect((await read.profile(deps, e)).ignoredInRow).toBe(1);
    expect((await state(podId)).state).toBe('dissolved');
    expect((await read.card(deps, c, podId))).toMatchObject({ state: 'dissolved', myStatus: 'accepted' });
    expect((await read.profile(deps, c)).priority).toBe(true);
  });

  it('starts the backfill at acceptBy with exactly one accept short (§4.2)', async () => {
    const { podId, members } = await proposedPod(5);
    for (const uid of members.slice(0, 3)) await accept(podId, uid, R + HOUR);
    await sweepPod(podId, dropSchedule(W10).acceptBy + 5 * 60_000);
    const ps = await state(podId);
    expect(ps.state).toBe('proposed');
    expect(ps.backfill.used).toBe(true);
    expect(ps.timers.backfillUntil!.toMillis()).toBe(dropSchedule(W10).backfillLatest);
  });

  it('sensitive themes: no photo grant at confirmation; "Show my photo to this pod" grants and sets photoV (S6)', async () => {
    const { podId, members } = await planningPod(4, { sensitive: true });
    const [a, b] = members as [string, string];
    const card = (await read.card(deps, a, podId))!;
    expect(card.themeSensitive).toBe(true);
    expect(card.ageSpan).toBeUndefined();
    expect(card.reasons.map((r) => r.code)).not.toContain('AGE_SPAN');
    await docs(deps.db).user(a).update({ photo: { v: 7 } });
    for (const x of members) for (const y of members) if (x !== y) expect(await read.grant(deps, x, y)).toBeUndefined();
    expect((await read.pod(deps, podId))!.roster[a]!.photoV).toBeNull();
    await call('setPhotoSharing', pods.setPhotoSharing, a, { podId, share: true });
    expect((await read.grant(deps, a, b))?.pods).toEqual([podId]);
    expect(await read.grant(deps, b, a)).toBeUndefined();
    expect((await read.pod(deps, podId))!.roster[a]!.photoV).toBe(7);
    expect((await read.card(deps, a, podId))!.photoShared).toBe(true);
    await call('setPhotoSharing', pods.setPhotoSharing, a, { podId, share: false });
    expect(await read.grant(deps, a, b)).toBeUndefined();
    expect((await read.pod(deps, podId))!.roster[a]!.photoV).toBeNull();

    const ordinary = await planningPod(4);
    expect(await errorCode(call('setPhotoSharing', pods.setPhotoSharing, ordinary.members[0]!, { podId: ordinary.podId, share: true }))).toBe('STATE');
  });

  it('proposeOption: members only, while planning, 08–22 within 14 days, 3 per pod and 2 per member', async () => {
    const { podId, members } = await planningPod(4);
    const [a, b, c] = members as [string, string, string];
    const t = R + 2 * HOUR;
    const ok = local(2027, 3, 14, 12);
    expect(await errorCode(option(podId, a, local(2027, 3, 14, 23), t))).toBe('WINDOW');
    expect(await errorCode(option(podId, a, local(2027, 3, 14, 7, 59), t))).toBe('WINDOW');
    expect(await errorCode(option(podId, a, t + 15 * DAY, t))).toBe('WINDOW');
    expect(await errorCode(option(podId, a, t - HOUR, t))).toBe('WINDOW');
    await option(podId, a, local(2027, 3, 14, 22), t);
    await option(podId, a, ok, t);
    expect(await errorCode(option(podId, a, ok + HOUR, t))).toBe('LIMIT');
    await option(podId, b, ok + HOUR, t);
    expect(await errorCode(option(podId, c, ok + 2 * HOUR, t))).toBe('LIMIT');
    const stranger = await makeUser(deps);
    expect(await errorCode(option(podId, stranger, ok, t))).toBe('NOT_MEMBER');
    const proposed = await proposedPod(4);
    expect(await errorCode(option(proposed.podId, proposed.members[0]!, ok, t))).toBe('NOT_MEMBER');
  });

  it('voteOption: a unanimous yes locks the plan at once; yes voters are coming; meetupTimers()', async () => {
    const { podId, members } = await planningPod(4);
    const lockAt = R + 3 * HOUR;
    const meetupAt = local(2027, 3, 18, 19);
    const optionId = await option(podId, members[0]!, meetupAt, lockAt);
    expect(await vote(podId, members[0]!, optionId, 'yes', lockAt)).toEqual({ tally: { yes: 1, no: 0 } });
    expect(await vote(podId, members[1]!, optionId, 'no', lockAt)).toEqual({ tally: { yes: 1, no: 1 } });
    expect(await vote(podId, members[1]!, optionId, null, lockAt)).toEqual({ tally: { yes: 1, no: 0 } });
    for (const uid of members.slice(1)) await vote(podId, uid, optionId, 'yes', lockAt);
    const ps = await state(podId);
    const t = meetupTimers(meetupAt, lockAt);
    expect(ps.state).toBe('scheduled');
    expect(ps.planLockedAt!.toMillis()).toBe(lockAt);
    expect(ps.timers.stillComing3d!.toMillis()).toBe(t.stillComing3d);
    expect(ps.timers.stillComing24h!.toMillis()).toBe(t.stillComing24h);
    expect(ps.timers.nudge6h!.toMillis()).toBe(t.nudge6h);
    expect(ps.timers.attendanceCheck!.toMillis()).toBe(t.attendanceCheck);
    expect(ps.timers.happened!.toMillis()).toBe(t.happened);
    expect(ps.dueAt!.toMillis()).toBe(t.stillComing3d);
    const pod = (await read.pod(deps, podId))!;
    expect(pod.planning).toMatchObject({ winningOptionId: optionId });
    expect(pod.planning.meetupAt!.toMillis()).toBe(meetupAt);
    expect(pod.planning.planLockedAt!.toMillis()).toBe(lockAt);
    expect(Object.values(pod.attendance!)).toEqual(['coming', 'coming', 'coming', 'coming']);
    expect(await errorCode(vote(podId, members[0]!, optionId, 'no', lockAt))).toBe('STATE');
  });

  it('planning deadline: the most yes votes (≥ 3) win, ties to the earlier time; others are pending', async () => {
    const { podId, members } = await planningPod(4);
    const [a, b, c, d] = members as [string, string, string, string];
    const t = R + 2 * HOUR;
    const early = await option(podId, a, local(2027, 3, 17, 18), t);
    const late = await option(podId, b, local(2027, 3, 17, 19), t);
    for (const uid of [a, b, c]) await vote(podId, uid, early, 'yes', t);
    for (const uid of [a, b, d]) await vote(podId, uid, late, 'yes', t);
    const deadline = (await state(podId)).timers.planDeadline!.toMillis();
    await sweepPod(podId, deadline - 1);
    expect((await state(podId)).state).toBe('planning');
    await sweepPod(podId, deadline + 5 * 60_000);
    const pod = (await read.pod(deps, podId))!;
    expect(pod.state).toBe('scheduled');
    expect(pod.planning.winningOptionId).toBe(early);
    expect(pod.attendance).toEqual({ [a]: 'coming', [b]: 'coming', [c]: 'coming', [d]: 'pending' });
  });

  it('races: the sweeper and the last unanimous vote at the planning deadline lock the plan exactly once', async () => {
    const { podId, members } = await planningPod(4);
    const t = R + 2 * HOUR;
    const o = await option(podId, members[0]!, local(2027, 3, 17, 18), t);
    for (const uid of members.slice(0, 3)) await vote(podId, uid, o, 'yes', t);
    const deadline = (await state(podId)).timers.planDeadline!.toMillis();
    const version = (await state(podId)).version;
    const pushes = deps.pushes.length;
    deps.clock.now = deadline - 1000;
    await Promise.all([withPod(deps, podId, deadline + 60_000, (ctx) => advance(ctx)), invoke('voteOption', pods.voteOption, deps, { podId, optionId: o, vote: 'yes' }, { uid: members[3]! }).catch((e: unknown) => e)]);
    const ps = await state(podId);
    expect(ps.state).toBe('scheduled');
    // Whichever commits second sees the lock: it either fails (the vote, STATE) or changes nothing (the sweep).
    expect([version + 1, version + 2]).toContain(ps.version);
    expect(deps.pushes.slice(pushes).filter((p) => p.kind === 'podChanged')).toHaveLength(1);
    expect((await read.pod(deps, podId))!.planning.winningOptionId).toBe(o);
  });

  it('one 24 h extension round when nothing wins, with fresh option limits; then a never-met pod dissolves (D7)', async () => {
    const { podId, members } = await planningPod(4);
    const [a, b] = members as [string, string];
    const t = R + 2 * HOUR;
    const o1 = await option(podId, a, local(2027, 3, 17, 18), t);
    await option(podId, a, local(2027, 3, 17, 19), t);
    await option(podId, b, local(2027, 3, 17, 20), t);
    await vote(podId, a, o1, 'yes', t);
    const deadline = (await state(podId)).timers.planDeadline!.toMillis();
    const pushes = deps.pushes.length;
    await sweepPod(podId, deadline + 5 * 60_000);
    let ps = await state(podId);
    expect(ps.state).toBe('planning');
    expect(ps.planningExtended).toBe(true);
    expect(ps.timers.planDeadline!.toMillis()).toBe(deadline + DAY);
    const pod = (await read.pod(deps, podId))!;
    expect(pod.planning.extended).toBe(true);
    expect(pod.planning.deadline.toMillis()).toBe(deadline + DAY);
    expect(pushedUids(deps, 'podChanged', pushes)).toEqual([...members].sort());
    // The extension round accepts new options although three exist.
    await option(podId, b, local(2027, 3, 18, 18), deadline + HOUR);
    // Only once per round: the extended deadline without a winner dissolves the pod.
    await sweepPod(podId, deadline + DAY + 5 * 60_000);
    ps = await state(podId);
    expect(ps.state).toBe('dissolved');
    expect(ps.dueAt).toBeUndefined();
    expect(await read.options(deps, podId)).toEqual([]);
    expect(await read.grant(deps, a, b)).toBeUndefined();
    for (const uid of members) {
      expect((await read.profile(deps, uid))).toMatchObject({ activePods: 0, priority: true });
      expect((await read.card(deps, uid, podId))).toMatchObject({ state: 'dissolved' });
    }
  });

  it('attendance: asks at T−3 d and T−24 h (chat open), nudge at T−6 h, unconfirmed at T−3 h, one reschedule round, then cancelled', async () => {
    const lockAt = R + 3 * HOUR;
    const meetupAt = local(2027, 3, 18, 19);
    const { podId, members } = await planningPod(4);
    const [a, b, c, d] = members as [string, string, string, string];
    const o = await option(podId, a, meetupAt, lockAt);
    for (const uid of [a, b, c]) await vote(podId, uid, o, 'yes', lockAt);
    await sweepPod(podId, (await state(podId)).timers.planDeadline!.toMillis());
    expect((await read.pod(deps, podId))!.attendance![d]).toBe('pending');
    const timers = meetupTimers(meetupAt, (await state(podId)).planLockedAt!.toMillis());

    let p = deps.pushes.length;
    await sweepPod(podId, timers.stillComing3d! + 5 * 60_000);
    expect(pushedUids(deps, 'stillComing', p)).toEqual([...members].sort());
    // b cancels more than 24 h ahead: no late cancel; 2 coming + 1 pending can still make 3.
    await call('confirmAttendance', pods.confirmAttendance, b, { podId, coming: false }, timers.stillComing3d! + HOUR);
    expect((await read.profile(deps, b)).noShowEvents).toEqual([]);
    expect((await state(podId)).state).toBe('scheduled');
    p = deps.pushes.length;
    await sweepPod(podId, timers.stillComing24h + 5 * 60_000);
    expect(pushedUids(deps, 'stillComing', p)).toEqual([...members].sort());
    expect(pushedUids(deps, 'chatOpen', p)).toEqual([...members].sort());
    p = deps.pushes.length;
    await sweepPod(podId, timers.nudge6h! + 5 * 60_000);
    expect(pushedUids(deps, 'stillComing', p)).toEqual([d]);
    // Nothing is processed twice.
    p = deps.pushes.length;
    await sweepPod(podId, timers.nudge6h! + 10 * 60_000);
    expect(deps.pushes.length).toBe(p);

    await sweepPod(podId, timers.attendanceCheck + 5 * 60_000);
    // d never answered → unconfirmed; 2 coming < 3 → the reschedule round (48 h).
    const ps = await state(podId);
    expect(ps.state).toBe('planning');
    expect(ps.rescheduled).toBe(true);
    expect(ps.timers.planDeadline!.toMillis()).toBe(timers.attendanceCheck + 5 * 60_000 + 48 * HOUR);
    expect(ps.timers.meetupAt).toBeUndefined();
    const pod = (await read.pod(deps, podId))!;
    expect(pod.attendance).toBeUndefined();
    expect(pod.planning.meetupAt).toBeUndefined();
    expect(await read.options(deps, podId)).toEqual([]);
    // No backfill once the plan has locked (D6), even with 3 members left.
    await call('leavePod', pods.leavePod, d, { podId }, timers.attendanceCheck + HOUR);
    expect((await state(podId)).backfill.used).toBe(false);
    expect((await state(podId)).state).toBe('planning');

    // The reschedule round locks again; falling below 3 coming a second time cancels: never met → dissolved.
    const lock2 = timers.attendanceCheck + 2 * HOUR;
    const second = local(2027, 3, 20, 12);
    const o2 = await option(podId, a, second, lock2);
    for (const uid of [a, b, c]) await vote(podId, uid, o2, 'yes', lock2);
    expect((await state(podId)).state).toBe('scheduled');
    await call('confirmAttendance', pods.confirmAttendance, c, { podId, coming: false }, second - 2 * DAY);
    expect((await state(podId)).state).toBe('dissolved');
  });

  it('confirmAttendance: a late cancel counts once as 0.5; a cancellation leaving < 3 possible attendees reschedules at once', async () => {
    const lockAt = R + 3 * HOUR;
    const meetupAt = local(2027, 3, 16, 19);
    const { podId, members } = await scheduledPod(4, meetupAt, lockAt);
    const [a, b, c] = members as [string, string, string];
    await call('confirmAttendance', pods.confirmAttendance, a, { podId, coming: false }, meetupAt - 10 * HOUR);
    await call('confirmAttendance', pods.confirmAttendance, a, { podId, coming: true }, meetupAt - 9 * HOUR);
    await call('confirmAttendance', pods.confirmAttendance, a, { podId, coming: false }, meetupAt - 8 * HOUR);
    const pa = await read.profile(deps, a);
    expect(pa.noShowEvents).toEqual([{ weekId: weekIdAt(meetupAt), w: 0.5 }]);
    expect((await read.user(deps, a))!.stats.lateCancels).toBe(1);
    expect(pa.reliability).toBeCloseTo(4 / 5.5);
    expect((await read.pod(deps, podId))!.attendance![a]).toBe('notComing');
    await call('confirmAttendance', pods.confirmAttendance, b, { podId, coming: false }, meetupAt - 8 * HOUR);
    expect((await state(podId)).state).toBe('planning');
    expect(await errorCode(call('confirmAttendance', pods.confirmAttendance, c, { podId, coming: true }))).toBe('STATE');
  });

  it('leavePod: options and votes go, grants both ways, notices; 3 left in planning starts the backfill; below 3 dissolves', async () => {
    const { podId, members } = await planningPod(4);
    const [a, b, c, d] = members as [string, string, string, string];
    const t = R + 2 * HOUR;
    const mine = await option(podId, d, local(2027, 3, 17, 18), t);
    const theirs = await option(podId, a, local(2027, 3, 17, 19), t);
    await vote(podId, d, theirs, 'yes', t);
    await call('leavePod', pods.leavePod, d, { podId, reason: 'schedule' }, t);
    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).toEqual([a, b, c].sort());
    expect(pod.roster[d]).toBeUndefined();
    expect(await read.options(deps, podId)).toEqual([theirs]);
    expect((await docs(deps.db).option(podId, theirs).get()).data()!.votes).toEqual({});
    expect(mine).toBeDefined();
    expect(await read.grant(deps, a, d)).toBeUndefined();
    expect(await read.grant(deps, d, a)).toBeUndefined();
    expect((await read.card(deps, d, podId))!.myStatus).toBe('left');
    expect((await read.profile(deps, d)).activePods).toBe(0);
    expect((await deps.db.collection(`users/${a}/notices`).where('code', '==', 'POD_MEMBER_LEFT').get()).size).toBe(1);
    expect((await state(podId)).backfill.used).toBe(true);
    // Leaving again is a no-op.
    await call('leavePod', pods.leavePod, d, { podId }, t);
    await call('leavePod', pods.leavePod, c, { podId }, t);
    expect((await state(podId)).state).toBe('dissolved');
    const stranger = await makeUser(deps);
    expect(await errorCode(call('leavePod', pods.leavePod, stranger, { podId }, t))).toBe('NOT_FOUND');
  });

  it('feedback: majority no-shows, meet-again pair signals (no → never, mutual yes → 4 weeks), the Keep loop and the second meetup', async () => {
    const lockAt = R + 3 * HOUR;
    const meetupAt = local(2027, 3, 16, 19);
    const { podId, members } = await scheduledPod(4, meetupAt, lockAt);
    const [a, b, c, d] = members as [string, string, string, string];
    const happenedAt = meetupAt + 2 * HOUR;
    const week = weekIdAt(meetupAt);
    const firstBefore = await funnelCount(weekIdAt(happenedAt + 5 * 60_000), 'firstMeetupHappened');
    await sweepPod(podId, happenedAt + 5 * 60_000);
    let ps = await state(podId);
    expect(ps.state).toBe('happened');
    expect(ps.hasMet).toBe(true);
    expect(ps.timers.feedbackCloses!.toMillis()).toBe(happenedAt + 7 * DAY);
    expect((await funnelCount(weekIdAt(happenedAt + 5 * 60_000), 'firstMeetupHappened')) - firstBefore).toBe(4);
    for (const uid of members) expect((await read.profile(deps, uid)).activePods).toBe(0);

    const t = happenedAt + DAY;
    const [ha, hb, hc] = await Promise.all([a, b, c].map((u) => uidHash(testUidHmac, u)));
    await call('submitFeedback', pods.submitFeedback, a, { podId, met: true, notThere: [d], meetAgain: { [b]: true, [c]: false }, rating: 5, keep: true }, t);
    // A "no" is applied at once and invisibly, on both sides.
    expect((await read.profile(deps, a)).recentH[hc!]).toBe(NEVER_WEEK_ID);
    expect((await read.profile(deps, c)).recentH[ha!]).toBe(NEVER_WEEK_ID);
    const acKey = await pairKey(testUidHmac, a, c);
    const signal = (await docs(deps.db).pairSignal(acKey).get()).data()!;
    expect(signal.uidHs).toEqual([ha!, hc!].sort());
    expect(JSON.stringify(signal)).not.toContain(a);
    // One "yes" waits for the other side.
    const coMember = (await read.profile(deps, a)).recentH[hb!];
    expect(coMember).toBe(addWeeks(weekIdAt(R + HOUR), 26));
    await call('submitFeedback', pods.submitFeedback, b, { podId, met: true, notThere: [d], meetAgain: { [a]: true }, keep: true }, t);
    expect((await read.profile(deps, a)).recentH[hb!]).toBe(addWeeks(week, 4));
    expect((await read.profile(deps, b)).recentH[ha!]).toBe(addWeeks(week, 4));
    await call('submitFeedback', pods.submitFeedback, c, { podId, met: true, notThere: [], meetAgain: {}, keep: true }, t);
    expect(await errorCode(call('submitFeedback', pods.submitFeedback, c, { podId, met: true, notThere: ['notAMember'], meetAgain: {}, keep: true }, t))).toBe('VALIDATION');

    // The reminder goes only to members without feedback.
    const timers = feedbackTimers(meetupAt);
    await sweepPod(podId, timers.push + 60_000);
    const p = deps.pushes.length;
    await sweepPod(podId, timers.reminder + 60_000);
    expect(pushedUids(deps, 'feedback', p)).toEqual([d]);

    await sweepPod(podId, happenedAt + 7 * DAY + 5 * 60_000);
    // d: 2 of 3 responders unticked them → a no-show; a, b and c attended, verified by ≥ 2 co-members.
    expect((await read.user(deps, d))!.stats).toEqual({ attended: 0, noShows: 1, lateCancels: 0 });
    expect((await read.profile(deps, d)).noShowEvents).toEqual([{ weekId: week, w: 1 }]);
    expect((await read.profile(deps, d)).reliability).toBeCloseTo(4 / 6);
    expect((await read.user(deps, a))!.stats.attended).toBe(1);
    expect((await read.profile(deps, a)).attendedVerified).toBe(2);
    expect((await docs(deps.db).pairSignal(acKey).get()).exists).toBe(false);
    // Keep loop: the three keepers plan again; d leaves the pod.
    ps = await state(podId);
    expect(ps.state).toBe('planning');
    expect(ps.planningExtended).toBe(false);
    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).toEqual([a, b, c].sort());
    expect(await read.grant(deps, a, d)).toBeUndefined();
    expect((await read.card(deps, d, podId))!.myStatus).toBe('left');
    expect((await read.profile(deps, a)).activePods).toBe(1);
    expect(await errorCode(call('submitFeedback', pods.submitFeedback, d, { podId, met: true, notThere: [], meetAgain: {}, keep: true }))).toBe('NOT_MEMBER');

    // The second meetup counts as continuation in the funnel.
    const lock2 = happenedAt + 7 * DAY + HOUR;
    const second = local(2027, 3, 26, 18);
    const o2 = await option(podId, a, second, lock2);
    for (const uid of [a, b, c]) await vote(podId, uid, o2, 'yes', lock2);
    await sweepPod(podId, second + 2 * HOUR + 60_000);
    expect((await state(podId)).state).toBe('happened');
    expect((await read.profile(deps, a)).milestones.secondMeetupAt).toBeDefined();
    expect((await read.profile(deps, d)).milestones.secondMeetupAt).toBeUndefined();
  });

  it('closes feedback into an archive below 3 keepers, and refuses feedback after the window', async () => {
    const lockAt = R + 3 * HOUR;
    const meetupAt = local(2027, 3, 16, 12);
    const { podId, members } = await scheduledPod(4, meetupAt, lockAt);
    await sweepPod(podId, meetupAt + 2 * HOUR);
    await call('submitFeedback', pods.submitFeedback, members[0]!, { podId, met: true, notThere: [], meetAgain: {}, keep: true }, meetupAt + DAY);
    await sweepPod(podId, meetupAt + 2 * HOUR + 7 * DAY);
    const ps = await state(podId);
    expect(ps.state).toBe('archived');
    expect((await read.pod(deps, podId))!.archivedAt).toBeDefined();
    expect(await read.grant(deps, members[0]!, members[1]!)).toBeUndefined();
    expect(await errorCode(call('submitFeedback', pods.submitFeedback, members[0]!, { podId, met: true, notThere: [], meetAgain: {}, keep: true }))).toBe('WINDOW');
  });

  it('counts firstConfirmed once per user across pods', async () => {
    const { podId, members } = await proposedPod(4);
    await docs(deps.db).matchProfile(members[0]!).update({ 'milestones.firstConfirmedAt': ts(R - 30 * DAY) });
    const week = weekIdAt(R + HOUR);
    const before = await funnelCount(week, 'firstConfirmed');
    for (const uid of members) await accept(podId, uid, R + HOUR);
    expect((await funnelCount(week, 'firstConfirmed')) - before).toBe(3);
    expect((await read.profile(deps, members[0]!)).milestones.firstConfirmedAt!.toMillis()).toBe(R - 30 * DAY);
  });

  describe_dst();

  function describe_dst() {
    for (const [label, weekId, meetup, push, reminder] of [
      // DST ends Sun 25 Oct 2026 03:00: a Saturday 18:00 CEST meetup, feedback at 10:00 CET (09:00Z) the next day.
      ['autumn', '2026-W43', Date.UTC(2026, 9, 24, 16), Date.UTC(2026, 9, 25, 9), Date.UTC(2026, 9, 28, 9)],
      // DST starts Sun 28 Mar 2027 02:00: a Saturday 20:00 CET meetup, feedback at 10:00 CEST (08:00Z).
      ['spring', '2027-W12', Date.UTC(2027, 2, 27, 19), Date.UTC(2027, 2, 28, 8), Date.UTC(2027, 2, 31, 8)],
    ] as const) {
      it(`sends the feedback push at 10:00 Europe/Copenhagen the next morning and the reminder 3 days later (${label} DST week), through the global sweep`, async () => {
        const lockAt = dropSchedule(weekId).releaseAt + 3 * HOUR;
        const { podId, members } = await scheduledPod(4, meetup, lockAt, { weekId });
        const sweep = (t: number) => {
          deps.clock.now = t;
          return sweepPods(deps, t);
        };
        await sweep(meetup + 2 * HOUR + 5 * 60_000);
        const ps = await state(podId);
        expect(ps.state).toBe('happened');
        expect(ps.timers.feedbackPush!.toMillis()).toBe(push);
        expect(ps.timers.feedbackReminder!.toMillis()).toBe(reminder);
        let p = deps.pushes.length;
        await sweep(push - 60_000);
        expect(pushedUids(deps, 'feedback', p)).toEqual([]);
        p = deps.pushes.length;
        expect((await sweep(push + 5 * 60_000)).processed).toBeGreaterThanOrEqual(1);
        expect(pushedUids(deps, 'feedback', p)).toEqual([...members].sort());
        p = deps.pushes.length;
        await sweep(push + 65 * 60_000);
        expect(pushedUids(deps, 'feedback', p)).toEqual([]);
        await sweep(reminder + 5 * 60_000);
        expect(pushedUids(deps, 'feedback', p)).toEqual([...members].sort());
      });
    }
  }
});
