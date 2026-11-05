/**
 * Block, report and the automated sanctions (DESIGN.md §3.7, §4.4, A38; F17) against the Firestore emulator: two-way
 * blocks with removal from shared active pods and the re-plan round, unblock, every report target (the message copy
 * included), the automated pauses and the sensitive-theme hold with their statements of reasons, the no-show pause and
 * suspension, and the hourly lifting of what has expired. This file owns drop weeks 2027-W20 to 2027-W29.
 */
import { NOTICE_CODES, REPORT_PAUSE_MS, SENSITIVE_HOLD_MS, NO_SHOW_PAUSE_MS, NO_SHOW_SUSPENSION_MS, dropSchedule, uidHash, weekIdAt, type WeekId } from '@grouper/core';
import { expect, it } from 'vitest';
import { blockUser, report, unblockUser } from '../../src/callables/safety';
import { docs, PATHS, ts } from '../../src/lib/firestore';
import { liftExpired } from '../../src/lib/sanctions';
import { withPod } from '../../src/pods/effects';
import { checkNoShowSanction } from '../../src/pods/transitions';
import { describeEmulator, emulatorDeps, errorCode, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { forbidInLogs } from '../helpers/logCapture';
import { DAY, HOUR, podFlow } from '../helpers/podFlow';
import { makeUser, read } from '../helpers/pods';

const W = (n: number) => `2027-W${n}` as WeekId;

describeEmulator('block, report and sanctions (emulator)', () => {
  const deps = emulatorDeps(dropSchedule(W(20)).releaseAt);
  const flow = podFlow(deps);
  const block = (uid: string, data: Record<string, unknown>) => flow.call('blockUser', blockUser, uid, data);
  const unblock = (uid: string, other: string) => flow.call('unblockUser', unblockUser, uid, { uid: other });
  const reportAs = (uid: string, data: Record<string, unknown>) => flow.call('report', report, uid, data);
  const notices = async (uid: string) => (await deps.db.collection(`${PATHS.user(uid)}/notices`).get()).docs.map((d) => d.data());
  const h = (uid: string) => uidHash(testUidHmac, uid);

  it('blocks two-way: the blocked member leaves the active pod, grants go both ways, blockedH and the ledger are written', async () => {
    const { podId, members } = await flow.planningPod(5, W(20));
    const [a, b] = members as [string, string];
    forbidInLogs(...members);
    expect(await read.grant(deps, a, b)).toBeDefined();
    await block(a, { podId, uid: b });

    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).not.toContain(b);
    expect(pod.roster[b]).toBeUndefined();
    expect(await read.grant(deps, a, b)).toBeUndefined();
    expect(await read.grant(deps, b, a)).toBeUndefined();
    expect((await read.profile(deps, a)).blockedH).toContain(await h(b));
    expect((await read.profile(deps, b)).blockedH).toContain(await h(a));
    expect((await docs(deps.db).userBlock(a, b).get()).data()).toMatchObject({ firstName: 'Bo', podId });
    expect((await docs(deps.db).block(a, b).get()).data()).toMatchObject({ blocker: a, blocked: b, podId });
    const ledger = (await deps.db.collection('erasureLedger').where('uidH', '==', await h(a)).get()).docs.map((d) => d.data());
    expect(ledger).toEqual([expect.objectContaining({ kind: 'block', ref: `${await h(b)}:${podId}` })]);
    // The others, the blocked person included, see only the generic notice.
    expect((await notices(members[2]!)).map((n) => n.code)).toContain(NOTICE_CODES.POD_MEMBER_LEFT);
    expect((await flow.state(podId)).members[b]!.status).toBe('removed');

    await unblock(a, b);
    expect((await docs(deps.db).block(a, b).get()).exists).toBe(false);
    expect((await read.profile(deps, a)).blockedH).not.toContain(await h(b));
    expect((await read.profile(deps, b)).blockedH).not.toContain(await h(a));
    const kinds = (await deps.db.collection('erasureLedger').where('uidH', '==', await h(a)).get()).docs.map((d) => d.get('kind')).sort();
    expect(kinds).toEqual(['block', 'unblock']);
  });

  it('refuses a uid that never shared the pod, and lets the blocker leave instead', async () => {
    const { podId, members } = await flow.planningPod(5, W(21));
    const stranger = await makeUser(deps);
    expect(await errorCode(block(members[0]!, { podId, uid: stranger }))).toBe('NOT_CO_MEMBER');
    expect(await errorCode(block(members[0]!, { podId, uid: members[0] }))).toBe('VALIDATION');
    await block(members[0]!, { podId, uid: members[1]!, leave: true });
    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).not.toContain(members[0]);
    expect(pod.memberUids).toContain(members[1]);
  });

  it('a block in a scheduled pod with "Re-plan the meetup" reopens planning for 48 h and deletes the old options', async () => {
    const { podId, members } = await flow.scheduledPod(5, W(22));
    const at = dropSchedule(W(22)).releaseAt + 3 * HOUR;
    deps.clock.now = at;
    await block(members[0]!, { podId, uid: members[1]!, replan: true });
    const ps = await flow.state(podId);
    expect(ps.state).toBe('planning');
    expect(ps.timers.planDeadline!.toMillis()).toBe(at + 48 * HOUR);
    expect(await read.options(deps, podId)).toEqual([]);
    expect((await read.pod(deps, podId))!.memberUids).not.toContain(members[1]);
  });

  it('reports: the reported message is copied, the pair keeps apart, two independent reports pause for 28 days', async () => {
    const { podId, members } = await flow.planningPod(5, W(23));
    const [a, b, c] = members as [string, string, string];
    const text = 'call me on my private number tonight';
    forbidInLogs(text, 'he was rude');
    await deps.db.doc(PATHS.podMessage(podId, 'msg1')).set({ authorUid: b, text, createdAt: ts(deps.clock.now), expiresAt: ts(deps.clock.now + DAY) });
    const now = dropSchedule(W(23)).releaseAt + 2 * HOUR;
    deps.clock.now = now;

    const r1 = await reportAs(a, { target: { type: 'message', podId, messageId: 'msg1' }, category: 'harassment', text: 'he was rude' });
    const stored = (await docs(deps.db).report(r1.reportId).get()).data()!;
    expect(stored).toMatchObject({ reporterUid: a, targetUid: b, message: { text }, status: 'open', decision: 'RECORDED', target: { type: 'message', messageId: 'msg1' } });
    expect(stored.expiresAt.toMillis()).toBe(now + 365 * DAY);
    expect((await read.profile(deps, a)).blockedH).toContain(await h(b));
    expect((await read.profile(deps, b))).toMatchObject({ openReportCount: 1, blockedH: [await h(a)] });
    expect((await read.user(deps, b))!.status).toBe('active');
    expect((await notices(a)).map((n) => n.code)).toEqual([NOTICE_CODES.REPORT_RECEIVED]);
    // The same reporter again does not count twice.
    await reportAs(a, { target: { type: 'user', podId, uid: b }, category: 'content' });
    expect((await read.user(deps, b))!.status).toBe('active');

    await reportAs(c, { target: { type: 'user', podId, uid: b }, category: 'harassment' });
    const user = (await read.user(deps, b))!;
    expect(user).toMatchObject({ status: 'paused', participation: { pauseReason: 'reports' } });
    expect(user.participation.pausedUntil!.toMillis()).toBe(now + REPORT_PAUSE_MS);
    const sanction = (await docs(deps.db).sanction(b).get()).data()!;
    expect(sanction).toMatchObject({ type: 'pause', reasonCode: 'reports' });
    const sor = (await notices(b)).filter((n) => n.type === 'statementOfReasons');
    expect(sor.map((n) => n.code)).toEqual([NOTICE_CODES.PAUSE_REPORTS]);
    // The statement of reasons names neither the reporters nor what they wrote.
    expect(JSON.stringify(sor)).not.toMatch(new RegExp(`${a}|${c}|rude`));
    expect((await read.profile(deps, b)).status).toBe('paused');

    // It expires on its own: the hourly sweep lifts it once `until` has passed.
    expect((await liftExpired(deps, now + REPORT_PAUSE_MS - 1)).sanctions).toBe(0);
    await liftExpired(deps, now + REPORT_PAUSE_MS + 1);
    expect((await read.user(deps, b))).toMatchObject({ status: 'active' });
    expect((await read.user(deps, b))!.participation.pauseReason).toBeUndefined();
    expect((await docs(deps.db).sanction(b).get()).exists).toBe(false);
    expect((await read.profile(deps, b)).status).toBe('active');
  });

  it('option reports name the author on the server; safety and under-18 reports pause at once; a hold for "not a genuine member"', async () => {
    const { podId, members } = await flow.planningPod(5, W(24));
    const [a, b, c, d] = members as [string, string, string, string];
    const at = dropSchedule(W(24)).releaseAt + 2 * HOUR;
    const optionId = await flow.option(podId, d, dropSchedule(W(24)).releaseAt + 5 * DAY, at);
    const r = await reportAs(a, { target: { type: 'option', podId, optionId }, category: 'safety' });
    expect((await docs(deps.db).report(r.reportId).get()).data()).toMatchObject({ targetUid: d, target: { type: 'option', optionId }, decision: 'PAUSED' });
    expect((await read.user(deps, d))).toMatchObject({ status: 'paused', participation: { pauseReason: 'reports' } });

    await reportAs(a, { target: { type: 'user', podId, uid: b }, category: 'underage' });
    const first = (await docs(deps.db).sanction(b).get()).data()!;
    expect(first.reasonCode).toBe('underageReport');
    // Another under-18 report from the same pod does not restart the pause.
    deps.clock.now = at + DAY;
    await reportAs(c, { target: { type: 'user', podId, uid: b }, category: 'underage' });
    expect((await docs(deps.db).sanction(b).get()).data()!.until.toMillis()).toBe(first.until.toMillis());

    expect(await errorCode(reportAs(a, { target: { type: 'user', podId, uid: c }, category: 'notGenuine' }))).toBe('VALIDATION');
    expect(await errorCode(reportAs(a, { target: { type: 'user', podId, uid: await makeUser(deps) }, category: 'content' }))).toBe('NOT_CO_MEMBER');
  });

  it('"not a genuine member" in a sensitive-themed pod sets the 28-day sensitive hold, lifted when it expires', async () => {
    const { podId, members } = await flow.planningPod(4, W(25), { sensitive: true });
    const [a, b] = members as [string, string];
    const now = dropSchedule(W(25)).releaseAt + 2 * HOUR;
    deps.clock.now = now;
    await reportAs(a, { target: { type: 'user', podId, uid: b }, category: 'notGenuine' });
    const p = await read.profile(deps, b);
    expect(p.sensitiveHold).toMatchObject({ reason: 'notGenuine' });
    expect(p.sensitiveHold!.until.toMillis()).toBe(now + SENSITIVE_HOLD_MS);
    expect((await read.user(deps, b))!.status).toBe('active');
    expect((await notices(b)).map((n) => n.code)).toContain(NOTICE_CODES.SENSITIVE_HOLD_NOT_GENUINE);
    await liftExpired(deps, now + SENSITIVE_HOLD_MS + 1);
    expect((await read.profile(deps, b)).sensitiveHold).toBeNull();
  });

  it('no-show weight 2 in 8 weeks pauses for 2 weeks, 3 suspends for 8 weeks; both expire on their own', async () => {
    const { podId, members } = await flow.planningPod(4, W(26));
    const [a, b] = members as [string, string];
    const now = dropSchedule(W(26)).releaseAt + 3 * HOUR;
    const week = weekIdAt(now);
    await docs(deps.db).matchProfile(a).update({ noShowEvents: [{ weekId: week, w: 1 }, { weekId: week, w: 1 }] });
    await docs(deps.db).matchProfile(b).update({ noShowEvents: [{ weekId: week, w: 1 }, { weekId: week, w: 1 }, { weekId: week, w: 1 }] });
    await withPod(deps, podId, now, async (ctx) => {
      await ctx.loadPeople([a, b]);
      await checkNoShowSanction(ctx, a);
      await checkNoShowSanction(ctx, b);
    });
    const ua = (await read.user(deps, a))!;
    expect(ua).toMatchObject({ status: 'paused', participation: { pauseReason: 'noShow' } });
    expect(ua.participation.pausedUntil!.toMillis()).toBe(now + NO_SHOW_PAUSE_MS);
    expect((await read.user(deps, b))!.status).toBe('suspended');
    expect((await docs(deps.db).sanction(b).get()).data()).toMatchObject({ type: 'suspension', reasonCode: 'noShow' });
    expect((await docs(deps.db).sanction(b).get()).data()!.until.toMillis()).toBe(now + NO_SHOW_SUSPENSION_MS);
    expect((await notices(b)).map((n) => n.code)).toContain(NOTICE_CODES.SUSPENSION_NO_SHOW);
    await liftExpired(deps, now + NO_SHOW_PAUSE_MS + 1);
    expect((await read.user(deps, a))!.status).toBe('active');
    expect((await read.user(deps, b))!.status).toBe('suspended');
    await liftExpired(deps, now + NO_SHOW_SUSPENSION_MS + 1);
    expect((await read.user(deps, b))!.status).toBe('active');
  });

  it('a late cancel that brings the weight to 2 pauses through confirmAttendance', async () => {
    const { podId, members, meetupAt } = await flow.scheduledPod(5, W(27));
    const [a] = members as [string];
    await docs(deps.db).matchProfile(a).update({ noShowEvents: [{ weekId: weekIdAt(meetupAt), w: 1 }, { weekId: weekIdAt(meetupAt), w: 0.5 }] });
    const pods = await import('../../src/callables/pods');
    await flow.call('confirmAttendance', pods.confirmAttendance, a, { podId, coming: false }, meetupAt - 2 * HOUR);
    expect((await read.user(deps, a))).toMatchObject({ status: 'paused', participation: { pauseReason: 'noShow' } });
    expect((await read.user(deps, a))!.stats.lateCancels).toBe(1);
  });

  it('keeps the uid and its uidH out of the logs', async () => {
    const uid = newUid();
    forbidInLogs(uid, await h(uid));
    expect(await errorCode(block(uid, { podId: 'a'.repeat(20), uid: newUid() }))).toBe('NOT_CO_MEMBER');
  });
});
