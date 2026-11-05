/**
 * dailyMaintenance, the hourly extras and the leftovers (DESIGN.md §4.1, §5.2 (8), §10.3) against the emulators:
 * deletion of ended pods, pendingConsent holdings, recentH pruning, report expiry, inactivity, the Auth reconciliation
 * (scoped to this file's users, other files' fixtures have no Auth users), the Monday nudge, Wednesday's interest
 * maintenance, area chips, the backfill watchdog, and the erasure-ledger replay entry points. Owns weeks 2027-W45–W52.
 */
import { NOTICE_CODES, REPORT_RETENTION_MS, dropSchedule, fromLocal, uidHash, weekIdAt, type WeekId } from '@grouper/core';
import { FieldValue } from 'firebase-admin/firestore';
import { expect, it } from 'vitest';
import { blockUser, report, unblockUser } from '../../src/callables/safety';
import { updateProfile } from '../../src/callables/updateProfile';
import { DAY_MS, PATHS, docs, ts } from '../../src/lib/firestore';
import { withPod } from '../../src/pods/effects';
import { writeAreaChips } from '../../src/pods/orchestrator';
import { advance, endPod, startBackfill } from '../../src/pods/transitions';
import { replayHandlers } from '../../src/replay';
import {
  deleteEndedPods,
  deletePendingConsent,
  expireReports,
  inactivity,
  mondayNudge,
  pruneRecentH,
  reconcileAuth,
  wednesdayInterests,
} from '../../src/scheduled/maintenance';
import { interestsMaintenance } from '../../src/tasks/interestsBatch';
import { purgeUser } from '../../src/tasks/purge';
import { describeEmulator, emulatorDeps, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { DAY, HOUR, podFlow } from '../helpers/podFlow';
import { base32Id, makeUser, makeUsers, newConcept, pushedUids, read } from '../helpers/pods';

const W = (n: number) => `2027-W${n}` as WeekId;
const local = (year: number, month: number, day: number, hour: number) => fromLocal({ year, month, day, hour, minute: 5 });

describeEmulator('maintenance and replay (emulator)', () => {
  const deps = emulatorDeps(dropSchedule(W(45)).releaseAt);
  const flow = podFlow(deps);

  it('deletes ended pods once their retention has passed: pod tree, cards, feedback, grants, podState', async () => {
    const { podId, members } = await flow.planningPod(4, W(45));
    const at = dropSchedule(W(45)).releaseAt + 2 * HOUR;
    await deps.db.doc(PATHS.podMessage(podId, 'm1')).set({ authorUid: members[0], text: 'x', createdAt: ts(at), expiresAt: ts(at + DAY) });
    await withPod(deps, podId, at, async (ctx) => {
      await advance(ctx);
      ctx.ps.hasMet = true;
      await endPod(ctx, 'archived');
    });
    const ps = await flow.state(podId);
    expect(ps.deleteAt!.toMillis()).toBe(at + 90 * DAY_MS);
    await docs(deps.db).photoGrant(members[0]!, members[1]!).set({ pods: [podId, 'otherpodaaaaaaaaaaaa'], createdAt: ts(at) });
    // Other files' ended pods may go too: only this pod is asserted on.
    await deleteEndedPods(deps, at + 89 * DAY_MS);
    expect(await read.podState(deps, podId)).toBeDefined();
    await deleteEndedPods(deps, at + 91 * DAY_MS);
    expect(await read.podState(deps, podId)).toBeUndefined();
    expect(await read.pod(deps, podId)).toBeUndefined();
    expect(await deps.db.doc(PATHS.podMessage(podId, 'm1')).get().then((s) => s.exists)).toBe(false);
    for (const m of members) expect(await read.card(deps, m, podId)).toBeUndefined();
    expect((await read.grant(deps, members[0]!, members[1]!))!.pods).toEqual(['otherpodaaaaaaaaaaaa']);
  });

  it('deletes pendingConsent holdings after 14 days and prunes expired recentH entries', async () => {
    const uid = await makeUser(deps, { themes: [{ c: newConcept() }] });
    const now = deps.clock.now;
    const id = base32Id(16);
    await docs(deps.db).interest(uid, id).set({ display: 'x y', norm: 'x y', conceptId: null, starred: false, state: 'pendingConsent', pendingUntil: ts(now + 14 * DAY_MS), createdAt: ts(now) });
    await docs(deps.db).user(uid).update({ interestCount: 2 });
    await deletePendingConsent(deps, now + 13 * DAY_MS);
    expect((await docs(deps.db).interest(uid, id).get()).exists).toBe(true);
    await deletePendingConsent(deps, now + 15 * DAY_MS);
    expect((await docs(deps.db).interest(uid, id).get()).exists).toBe(false);
    expect((await read.user(deps, uid))!.interestCount).toBe(1);

    const week = weekIdAt(now);
    await docs(deps.db).matchProfile(uid).update({ recentH: { aaaaaaaaaaaaaaaaaaaa: week, bbbbbbbbbbbbbbbbbbbb: '9999-W52' }, recentMinUntil: week });
    await pruneRecentH(deps, now);
    expect((await read.profile(deps, uid))).toMatchObject({ recentH: { bbbbbbbbbbbbbbbbbbbb: '9999-W52' }, recentMinUntil: '9999-W52' });
  });

  it('expires an open report after 12 months: the pair leaves blockedH unless blocked, openReportCount goes down', async () => {
    const { podId, members } = await flow.planningPod(4, W(46));
    const [a, b, c] = members as [string, string, string];
    await flow.call('report', report, a, { target: { type: 'user', podId, uid: b }, category: 'content' });
    await flow.call('report', report, c, { target: { type: 'user', podId, uid: b }, category: 'content' }).catch(() => undefined);
    await flow.call('blockUser', blockUser, c, { podId, uid: b });
    const created = deps.clock.now;
    await expireReports(deps, created + REPORT_RETENTION_MS - 3 * DAY_MS);
    expect((await read.profile(deps, b)).openReportCount).toBe(2);
    await expireReports(deps, created + REPORT_RETENTION_MS - DAY_MS);
    const pb = await read.profile(deps, b);
    expect(pb.openReportCount).toBe(0);
    expect(pb.blockedH).not.toContain(await uidHash(testUidHmac, a));
    expect(pb.blockedH).toContain(await uidHash(testUidHmac, c));
    const statuses = (await deps.db.collection('reports').where('podId', '==', podId).get()).docs.map((d) => [d.get('status'), d.get('decision')]);
    expect(statuses).toEqual([['resolved', 'EXPIRED'], ['resolved', 'EXPIRED']]);
  });

  it('warns after 12 months without activity and deletes 30 days later; a returning user is not deleted', async () => {
    const [idle, back] = await makeUsers(deps, 2);
    const mine = new Set([idle!, back!]);
    const t0 = deps.clock.now + 400 * DAY_MS;
    await inactivity(deps, t0, { only: (u) => mine.has(u) });
    expect((await read.user(deps, idle!))!.inactivityWarnedAt!.toMillis()).toBe(t0);
    expect((await deps.db.collection(`users/${idle}/notices`).where('code', '==', NOTICE_CODES.INACTIVITY_WARNING).get()).size).toBe(1);
    expect(pushedUids(deps, 'notice')).toEqual(expect.arrayContaining([idle!, back!]));
    await docs(deps.db).user(back!).update({ lastActiveAt: ts(t0 + DAY_MS) });
    await inactivity(deps, t0 + 31 * DAY_MS, { only: (u) => mine.has(u) });
    expect((await read.user(deps, idle!))!.status).toBe('deleting');
    expect(deps.enqueued.some((t) => t.queue === 'purgeUser' && t.data.uid === idle)).toBe(true);
    expect((await read.user(deps, back!))).toMatchObject({ status: 'active' });
    expect((await read.user(deps, back!))!.inactivityWarnedAt).toBeUndefined();
  });

  it('Auth reconciliation: abandoned sign-ups go after 7 days (counted as signups), profiles without Auth are purged', async () => {
    const abandoned = newUid();
    const fresh = newUid();
    await deps.auth.createUser({ uid: abandoned });
    await deps.auth.createUser({ uid: fresh });
    const orphan = await makeUser(deps);
    const mine = new Set([abandoned, fresh, orphan]);
    const created = Date.parse((await deps.auth.getUser(abandoned)).metadata.creationTime);
    // Auth runs on the wall clock: the orphan's profile predates the listing.
    await docs(deps.db).user(orphan).update({ createdAt: ts(created - DAY_MS) });
    const funnelId = `funnel/none_${weekIdAt(created)}`;
    const before = Number((await deps.db.doc(funnelId).get()).get('counts.signup') ?? 0);
    const r = await reconcileAuth(deps, created + 8 * DAY_MS, { only: (u) => mine.has(u) && u !== fresh });
    expect(r).toEqual({ abandoned: 1, purged: 1 });
    expect(await deps.auth.getUser(abandoned).catch(() => null)).toBeNull();
    expect(await deps.auth.getUser(fresh).catch(() => null)).not.toBeNull();
    expect(Number((await deps.db.doc(funnelId).get()).get('counts.signup'))).toBe(before + 1);
    expect((await read.user(deps, orphan))!.status).toBe('deleting');
    expect(deps.enqueued.some((t) => t.queue === 'purgeUser' && t.data.uid === orphan)).toBe(true);
  });

  it('Monday 10:00: one "In this week?" per week to manual users not yet in this week\'s drop; Wednesday maintenance', async () => {
    const [manual, optedIn, auto] = await makeUsers(deps, 3);
    const monday = local(2027, 11, 22, 10);
    const dropWeek = weekIdAt(monday);
    for (const [uid, opt] of [[manual!, null], [optedIn!, dropWeek]] as const) {
      await docs(deps.db).matchProfile(uid).update({ 'participation.mode': 'manual', 'participation.optInWeekId': opt });
    }
    const from = deps.pushes.length;
    expect((await mondayNudge(deps, monday - HOUR)).skipped).toBe('notMonday');
    await mondayNudge(deps, monday);
    const nudged = pushedUids(deps, 'weeklyNudge', from);
    expect(nudged).toContain(manual);
    expect(nudged).not.toContain(optedIn);
    expect(nudged).not.toContain(auto);
    expect((await mondayNudge(deps, monday + HOUR)).skipped).toBe('alreadySent');

    expect(await wednesdayInterests(deps, monday)).toBe(false);
    expect(await wednesdayInterests(deps, monday + 2 * DAY)).toBe(true);
    expect(deps.enqueued.at(-1)).toMatchObject({ queue: 'interestsBatch', data: { op: 'maintenance' } });
  });

  it('interest maintenance recomputes holder counts and labels, and deletes empty non-seed concepts', async () => {
    const c = `c_${'e'.repeat(20)}`;
    const empty = `c_${'f'.repeat(20)}`;
    const vec = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
    const at = ts(deps.clock.now);
    const conceptDoc = { centroid: FieldValue.vector(vec), medoid: FieldValue.vector(vec), sum: Buffer.alloc(768 * 4), c128: Buffer.alloc(512), n: 3, sensitive: false, labels: {}, holderCount: 0, status: 'active', gen: 0, createdAt: at, updatedAt: at };
    await deps.db.doc(`concepts/${c}`).set(conceptDoc);
    await deps.db.doc(`concepts/${empty}`).set(conceptDoc);
    await deps.db.doc(`tags/maint_${base32Id(8)}`).set({ norm: 'strikning', vec: FieldValue.vector(vec), sens: { sensitive: false }, conceptId: c, refCount: 2, langHints: { da: 2, en: 0 } });
    await deps.db.doc(`tags/maint_${base32Id(8)}`).set({ norm: 'knitting', vec: FieldValue.vector(vec), sens: { sensitive: false }, conceptId: c, refCount: 1, langHints: { da: 0, en: 1 } });
    for (let i = 0; i < 3; i++) {
      const uid = await makeUser(deps, { themes: [{ c }] });
      expect(uid).toBeTruthy();
    }
    await interestsMaintenance(deps, undefined);
    const after = (await deps.db.doc(`concepts/${c}`).get()).data()!;
    expect(after).toMatchObject({ holderCount: 3, labels: { da: 'strikning', en: 'knitting' }, n: 2 });
    expect((await deps.db.doc(`concepts/${empty}`).get()).exists).toBe(false);
  });

  it('writes area chips: non-sensitive concepts with ≥ 10 holders and a label, at most 30', async () => {
    const at = ts(deps.clock.now);
    const mk = async (id: string, sensitive: boolean, labels: Record<string, string>) =>
      deps.db.doc(`concepts/${id}`).set({ sensitive, labels, status: 'active', holderCount: 0, n: 1, gen: 0, createdAt: at, updatedAt: at });
    const ok = newConcept();
    const sens = newConcept();
    const few = newConcept();
    await mk(ok, false, { da: 'løb', en: 'running' });
    await mk(sens, true, {});
    await mk(few, false, { en: 'chess' });
    const n = await writeAreaChips(deps, 'vejle', new Map([[ok, 12], [sens, 40], [few, 9]]));
    expect(n).toBe(1);
    expect((await docs(deps.db).area('vejle').get()).data()!.chips).toEqual([{ conceptId: ok, da: 'løb', en: 'running' }]);
  });

  it('the backfill watchdog enqueues backfillPod once more when no invitation went out', async () => {
    const { podId, members } = await flow.proposedPod(4, W(47));
    const at = dropSchedule(W(47)).releaseAt + HOUR;
    for (const uid of members.slice(0, 3)) await flow.accept(podId, uid, at);
    await withPod(deps, podId, at, async (ctx) => startBackfill(ctx));
    const ps = await flow.state(podId);
    expect(ps.timers.backfillRetry!.toMillis()).toBe(at + 15 * 60_000);
    await flow.sweepPod(podId, at + 16 * 60_000);
    expect(deps.enqueued.filter((t) => t.queue === 'backfillPod' && t.data.podId === podId).map((t) => t.options.id)).toEqual(expect.arrayContaining([`backfill-${podId}-retry`]));
    expect((await flow.state(podId)).timers.backfillRetry).toBeUndefined();
  });

  it('replays each erasure-ledger kind into a "restored" database by the original server code', async () => {
    const { podId, members } = await flow.planningPod(5, W(48));
    const [a, b, c] = members as [string, string, string];
    const handlers = replayHandlers(deps);
    const hA = await uidHash(testUidHmac, a);
    const hB = await uidHash(testUidHmac, b);
    const entry = (kind: string, uidH: string, ref?: string) => ({ id: `replay-${base32Id(10)}`, uidH, kind: kind as never, ...(ref ? { ref } : {}), atMs: deps.clock.now });

    // block: the restore lost the block; replay re-applies it (blockedH, removal from the shared pod).
    expect(await handlers.block(entry('block', hA, `${hB}:${podId}`))).toBe('replayed');
    expect((await docs(deps.db).block(a, b).get()).exists).toBe(true);
    expect((await read.pod(deps, podId))!.memberUids).not.toContain(b);
    expect(await handlers.block(entry('block', hA, `${hB}:${podId}`))).toBe('nothingToDo');
    expect(await handlers.unblock(entry('unblock', hA, `${hB}:${podId}`))).toBe('replayed');
    expect((await docs(deps.db).block(a, b).get()).exists).toBe(false);
    await flow.call('blockUser', blockUser, a, { podId, uid: c });
    await flow.call('unblockUser', unblockUser, a, { uid: c });

    // gender: the restored profile still holds it.
    await docs(deps.db).user(c).update({ gender: 'woman', 'prefs.sameGenderOnly': true });
    await docs(deps.db).matchProfile(c).update({ gender: 'woman', sameGenderOnly: true });
    const g = entry('gender', await uidHash(testUidHmac, c));
    expect(await handlers.gender(g)).toBe('replayed');
    expect((await read.user(deps, c))).toMatchObject({ gender: null, prefs: { sameGenderOnly: false } });
    expect((await deps.db.doc(`erasureLedger/${g.id}`).get()).get('kind')).toBe('gender');
    expect(await handlers.gender(g)).toBe('nothingToDo');
    expect(updateProfile).toBeTypeOf('function');

    // photo: an older version comes back with the restore; a newer upload is left alone.
    await docs(deps.db).user(a).update({ photo: { v: 2 } });
    expect(await handlers.photo(entry('photo', hA, '3'))).toBe('replayed');
    expect((await read.user(deps, a))!.photo).toBeNull();
    await docs(deps.db).user(a).update({ photo: { v: 4 } });
    expect(await handlers.photo(entry('photo', hA, '3'))).toBe('nothingToDo');

    // interest and consentWithdrawal with nothing to erase; account with the user gone keeps the uidH-keyed part.
    expect(await handlers.interest(entry('interest', hA, 'a'.repeat(16)))).toBe('nothingToDo');
    expect(await handlers.consentWithdrawal(entry('consentWithdrawal', hA))).toBe('nothingToDo');
    await purgeUser(deps, b, null);
    await docs(deps.db).matchProfile(c).update({ blockedH: FieldValue.arrayUnion(hB) });
    expect(await replayHandlers(deps).account(entry('account', hB))).toBe('nothingToDo');
    expect((await read.profile(deps, c)).blockedH).not.toContain(hB);
    expect(await handlers.account(entry('account', hA))).toBe('replayed');
    expect(await read.user(deps, a)).toBeUndefined();
  });
});
