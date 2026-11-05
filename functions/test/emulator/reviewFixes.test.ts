/**
 * Regression tests for the independent review's findings (functions/, packages/core): activity tracking in the
 * onboarded-callable wrapper, blocks in `happened` pods (Keep loop and every grant path), feedback per Keep round, the
 * Auth reconciliation race, exports racing a purge, the blanket withdrawal racing a backfill, replay of overtaken ledger
 * entries, adminRuns at erasure, report expiry and TTL, push tokens, exits from ended pods, the concept GC race and
 * roster refreshes in ended pods. Owns drop weeks 2028-W14–W24.
 */
import { NOTICE_CODES, dropSchedule, uidHash, type WeekId } from '@grouper/core';
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { expect, it } from 'vitest';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { registerPushToken } from '../../src/callables/account';
import { markArt9Withdrawal, withdrawBlanketConsent } from '../../src/callables/art9Consent';
import * as pods from '../../src/callables/pods';
import { blockUser, report } from '../../src/callables/safety';
import { updateProfile } from '../../src/callables/updateProfile';
import { withActivity } from '../../src/lib/activity';
import { COLLECTIONS, DAY_MS, PATHS, docs, ts } from '../../src/lib/firestore';
import { OBJECT_PATHS } from '../../src/lib/objects';
import { upsertToken } from '../../src/lib/pushTokens';
import { processUpload } from '../../src/photos/process';
import { recipientsFor, withPod } from '../../src/pods/effects';
import { exitPod } from '../../src/pods/exit';
import { advance, endPod } from '../../src/pods/transitions';
import { replayHandlers } from '../../src/replay';
import { expireReports, inactivity, reconcileAuth } from '../../src/scheduled/maintenance';
import { buildExport } from '../../src/tasks/export';
import { maintainConcept } from '../../src/tasks/interestsBatch';
import { ADMIN_RUN_REDACTED, purgeUser } from '../../src/tasks/purge';
import { describeEmulator, emulatorDeps, errorCode, newUid, type TestDeps } from '../helpers/emulator';
import { testJpeg } from '../helpers/jpeg';
import { testUidHmac } from '../helpers/keys';
import { DAY, HOUR, podFlow } from '../helpers/podFlow';
import { base32Id, makeUser, makeUsers, newConcept, read, releasedPod } from '../helpers/pods';

const W = (n: number) => `2028-W${n}` as WeekId;
const h = (uid: string) => uidHash(testUidHmac, uid);

describeEmulator('review fixes (emulator)', () => {
  const deps = emulatorDeps(dropSchedule(W(14)).releaseAt);
  const flow = podFlow(deps);
  /** deps with some members replaced (the rest, clock and recorded pushes included, shared). */
  const variant = (o: Partial<TestDeps>): TestDeps => {
    const v = Object.create(deps) as TestDeps;
    for (const [k, value] of Object.entries(o)) Object.defineProperty(v, k, { value });
    return v;
  };
  const lastActive = async (uid: string) => (await read.user(deps, uid))!.lastActiveAt.toMillis();
  const noticeCodes = async (uid: string) => (await deps.db.collection(`${PATHS.user(uid)}/notices`).get()).docs.map((d) => d.get('code') as string);

  /** A scheduled pod past its meetup: `happened`, the meetup chat (T+24 h) closed. */
  async function happenedPod(weekId: WeekId, o: Parameters<typeof flow.scheduledPod>[2] = {}) {
    const p = await flow.scheduledPod(4, weekId, o);
    await flow.sweepPod(p.podId, p.meetupAt + 2 * HOUR + 60_000);
    expect((await flow.state(p.podId)).state).toBe('happened');
    return { ...p, afterChat: p.meetupAt + 2 * DAY };
  }

  // ------------------------------------------------------------------ 1. activity
  it('[1] every onboarded callable records activity in the wrapper, at most once a day, so a warned user who opens the app keeps the account', async () => {
    expect(withActivity('completeOnboarding', completeOnboarding)).toBe(completeOnboarding);
    const uid = await makeUser(deps);
    const t0 = deps.clock.now;
    const register = withActivity('registerPushToken', registerPushToken);
    await flow.call('registerPushToken', register, uid, { token: `tok-${uid}`, platform: 'ios' }, t0);
    expect(await lastActive(uid)).toBe(t0);
    await flow.call('registerPushToken', register, uid, { token: `tok-${uid}`, platform: 'ios' }, t0 + HOUR);
    expect(await lastActive(uid)).toBe(t0);

    // Pod callables too.
    const { podId, members } = await flow.planningPod(4, W(14));
    const before = await lastActive(members[0]!);
    await flow.call('leavePod', withActivity('leavePod', pods.leavePod), members[0]!, { podId }, deps.clock.now + HOUR);
    expect(await lastActive(members[0]!)).toBe(deps.clock.now);
    expect(before).toBeLessThan(deps.clock.now - DAY_MS);

    // Inactive for a year: warned; opening the app (registerPushToken at start) keeps the account.
    const idle = await makeUser(deps);
    const t1 = deps.clock.now + 400 * DAY_MS;
    await inactivity(deps, t1, { only: (u) => u === idle });
    expect((await read.user(deps, idle))!.inactivityWarnedAt).toBeDefined();
    // The deletion warning still tries the (by now stale) token.
    expect(deps.pushes.some((x) => x.kind === 'notice' && x.recipients.some((r) => r.tokens.includes(`tok-${idle}`)))).toBe(true);
    await flow.call('registerPushToken', register, idle, { token: `tok-${idle}`, platform: 'ios' }, t1 + DAY_MS);
    await inactivity(deps, t1 + 31 * DAY_MS, { only: (u) => u === idle });
    expect((await read.user(deps, idle))!.status).toBe('active');
    expect((await read.user(deps, idle))!.inactivityWarnedAt).toBeUndefined();
  });

  // ------------------------------------------------------------------ 2. blocks in `happened` pods
  it('[2] the Keep loop drops the blocked member of a pair blocked after the meetup chat closed; no grant between them', async () => {
    const { podId, members, afterChat } = await happenedPod(W(15));
    const [a, b, c, d] = members as [string, string, string, string];
    await flow.call('blockUser', blockUser, a, { podId, uid: b }, afterChat);
    // The chat had closed: the block leaves both in the happened pod.
    expect((await read.pod(deps, podId))!.memberUids).toContain(b);
    for (const uid of members) await flow.call('submitFeedback', pods.submitFeedback, uid, { podId, met: true, notThere: [], meetAgain: {}, keep: true }, afterChat + HOUR);
    const ps = await flow.state(podId);
    await flow.sweepPod(podId, ps.timers.feedbackCloses!.toMillis() + 60_000);
    expect((await flow.state(podId)).state).toBe('planning');
    expect((await read.pod(deps, podId))!.memberUids).toEqual([a, c, d].sort());
    expect((await read.card(deps, b, podId))!.myStatus).toBe('left');
    expect(await read.grant(deps, a, b)).toBeUndefined();
    expect(await read.grant(deps, b, a)).toBeUndefined();
  });

  it('[2] an open report between two keepers keeps its target out of the next round', async () => {
    const { podId, members, afterChat } = await happenedPod(W(16));
    const [a, b] = members as [string, string];
    await flow.call('report', report, a, { target: { type: 'user', podId, uid: b }, category: 'harassment' }, afterChat);
    for (const uid of members) await flow.call('submitFeedback', pods.submitFeedback, uid, { podId, met: true, notThere: [], meetAgain: {}, keep: true }, afterChat + HOUR);
    await flow.sweepPod(podId, (await flow.state(podId)).timers.feedbackCloses!.toMillis() + 60_000);
    expect((await read.pod(deps, podId))!.memberUids).not.toContain(b);
    expect((await read.pod(deps, podId))!.memberUids).toContain(a);
  });

  it('[2] setPhotoSharing and a new photo version never grant to someone blocked in either direction', async () => {
    const s = await happenedPod(W(17), { sensitive: true, user: { photoV: 1 } });
    const [a, b, c] = s.members as [string, string, string];
    await flow.call('blockUser', blockUser, a, { podId: s.podId, uid: b }, s.afterChat);
    await flow.call('setPhotoSharing', pods.setPhotoSharing, b, { podId: s.podId, share: true }, s.afterChat + HOUR);
    expect(await read.grant(deps, b, c)).toBeDefined();
    expect(await read.grant(deps, b, a)).toBeUndefined();

    const o = await happenedPod(W(18));
    const [x, y, z] = o.members as [string, string, string];
    await flow.call('blockUser', blockUser, x, { podId: o.podId, uid: y }, o.afterChat);
    expect(await read.grant(deps, y, x)).toBeUndefined();
    deps.objects.put(OBJECT_PATHS.pendingUpload(y), testJpeg(800, 600));
    deps.objects.put(OBJECT_PATHS.pendingThumb(y), testJpeg(256, 192));
    expect((await processUpload(deps, OBJECT_PATHS.pendingThumb(y), { configPath: 'config/none' })).outcome).toBe('processed');
    expect(await read.grant(deps, y, z)).toBeDefined();
    expect(await read.grant(deps, y, x)).toBeUndefined();
  });

  // ------------------------------------------------------------------ 3. feedback per Keep round
  it('[3] feedback of one round is gone in the next: no carried-over Keep, and the reminder reaches everyone', async () => {
    const { podId, members, meetupAt, afterChat } = await happenedPod(W(19));
    const [a, b, c, d] = members as [string, string, string, string];
    for (const uid of members) await flow.call('submitFeedback', pods.submitFeedback, uid, { podId, met: true, notThere: uid === a ? [d] : [], meetAgain: {}, keep: true }, afterChat);
    const close1 = (await flow.state(podId)).timers.feedbackCloses!.toMillis();
    await flow.sweepPod(podId, close1 + 60_000);
    expect((await flow.state(podId)).state).toBe('planning');
    for (const uid of members) expect((await docs(deps.db).podFeedback(podId, uid).get()).exists).toBe(false);

    // Round 2: only a gives feedback.
    const lock2 = close1 + HOUR;
    const meetup2 = meetupAt + 14 * DAY;
    const opt = await flow.option(podId, a, meetup2, lock2);
    for (const uid of members) await flow.vote(podId, uid, opt, 'yes', lock2);
    expect((await flow.state(podId)).state).toBe('scheduled');
    await flow.sweepPod(podId, meetup2 + 2 * HOUR + 60_000);
    await flow.call('submitFeedback', pods.submitFeedback, a, { podId, met: true, notThere: [], meetAgain: {}, keep: true }, meetup2 + 3 * HOUR);
    const t = (await flow.state(podId)).timers;
    await flow.sweepPod(podId, t.feedbackPush!.toMillis() + 60_000);
    const p = deps.pushes.length;
    await flow.sweepPod(podId, t.feedbackReminder!.toMillis() + 60_000);
    expect(deps.pushes.slice(p).filter((x) => x.kind === 'feedback').flatMap((x) => x.recipients.flatMap((r) => r.tokens)).sort()).toEqual([b, c, d].map((u) => `tok-${u}`).sort());
    await flow.sweepPod(podId, t.feedbackCloses!.toMillis() + 60_000);
    // One keeper: archived (round 1's Keeps no longer count), and d is not a no-show twice.
    expect((await flow.state(podId)).state).toBe('archived');
    expect((await read.user(deps, d))!.stats.noShows).toBe(0);
  });

  // ------------------------------------------------------------------ 4. Auth reconciliation race
  it('[4] the Auth reconciliation never purges a profile created after the listing started, nor one whose Auth user exists', async () => {
    const missed = await makeUser(deps);
    await deps.auth.createUser({ uid: missed });
    const wall = Date.now();
    await docs(deps.db).user(missed).update({ createdAt: ts(wall - DAY_MS) });
    const late = await makeUser(deps);
    await docs(deps.db).user(late).update({ createdAt: ts(wall + HOUR) });
    const auth = deps.auth;
    // A listing that misses `missed` (it was created while the pages were read).
    const racing = variant({
      auth: {
        listUsers: async (n?: number, t?: string) => {
          const page = await auth.listUsers(n, t);
          return { ...page, users: page.users.filter((u) => u.uid !== missed) };
        },
        getUser: (uid: string) => auth.getUser(uid),
        deleteUser: (uid: string) => auth.deleteUser(uid),
      } as unknown as Auth,
    });
    const mine = new Set([missed, late]);
    expect(await reconcileAuth(racing, wall, { only: (u) => mine.has(u) })).toEqual({ abandoned: 0, purged: 0 });
    for (const uid of mine) expect((await read.user(deps, uid))!.status).toBe('active');
    expect(deps.enqueued.some((x) => x.queue === 'purgeUser' && mine.has(x.data.uid as string))).toBe(false);
  });

  // ------------------------------------------------------------------ 5. export vs purge
  it('[5] an export assembled while the account is deleted writes nothing and deletes its file; the purge clears exports again', async () => {
    const uid = await makeUser(deps);
    const exportId = deps.db.collection('x').doc().id;
    await docs(deps.db).export(uid, exportId).set({ status: 'pending', expiresAt: ts(deps.clock.now + DAY_MS) });
    const objects = deps.objects;
    const racing = variant({
      objects: Object.assign(Object.create(objects) as typeof objects, {
        write: async (path: string, data: Uint8Array, o: { contentType: string; cacheControl: string }) => {
          await objects.write(path, data, o);
          await docs(deps.db).user(uid).update({ status: 'deleting' });
        },
      }),
    });
    expect(await buildExport(racing, uid, exportId)).toBe('gone');
    expect(objects.names(`exports/${uid}/`)).toEqual([]);
    expect((await docs(deps.db).export(uid, exportId).get()).data()!.status).toBe('pending');
    expect(await noticeCodes(uid)).not.toContain(NOTICE_CODES.EXPORT_READY);

    // A file written right after the purge's Storage step is caught by its last step.
    const other = await makeUser(deps);
    let listed = 0;
    const late = variant({
      objects: Object.assign(Object.create(objects) as typeof objects, {
        list: async (prefix: string) => {
          const names = await objects.list(prefix);
          if (prefix === OBJECT_PATHS.exportsPrefix(other) && listed++ === 0) objects.put(OBJECT_PATHS.export(other, 'late'), new Uint8Array([1]), 'application/json');
          return names;
        },
      }),
    });
    await purgeUser(late, other, null);
    expect(listed).toBe(2);
    expect(objects.names(`exports/${other}/`)).toEqual([]);
  });

  // ------------------------------------------------------------------ 6. withdrawal vs release
  it('[6] a sensitive pod released during the blanket withdrawal cannot invite the withdrawing user', async () => {
    const t1 = newConcept();
    const t2 = newConcept();
    // x is in a sensitive pod on t1 (week 20); week 21's result puts x in a sensitive pod on t2.
    const x = await makeUser(deps, { themes: [{ c: t1, sens: true }, { c: t2, sens: true }, { c: newConcept() }] });
    const a = await flow.proposedPod(4, W(20), { sensitive: true, theme: t1, members: [x, ...(await makeUsers(deps, 3, { themes: [{ c: t1, sens: true }] }))] });
    await docs(deps.db).matchProfile(x).update({ sensitiveProposals: [] });
    const others = await makeUsers(deps, 4, { themes: [{ c: t2, sens: true }] });

    // The release commits at the withdrawal's first HMAC use (inside its first pod exit).
    let released: string | null = null;
    const racing = variant({
      uidHmac: () => async (m: Uint8Array) => {
        if (released === null) {
          released = 'pending';
          released = await releasedPod(deps, [...others, x], { weekId: W(21), theme: t2, sensitive: true });
        }
        return testUidHmac(m);
      },
    });
    await withdrawBlanketConsent(racing, x, deps.clock.now, { ledger: { uidH: await h(x) } });
    expect(released).not.toBeNull();
    const psC = await flow.state(released!);
    expect(Object.keys(psC.members).sort()).toEqual([...others].sort());
    expect(psC.memberList).not.toContain(x);
    expect((await flow.state(a.podId)).members[x]).toBeUndefined();
    expect((await read.profile(deps, x)).themes.some((t) => t.sens)).toBe(false);
    expect((await read.user(deps, x))!.legal.art9).toBeUndefined();
    expect((await deps.db.collection(`users/${x}/sensitiveInterests`).get()).size).toBe(0);
    // A second run changes nothing.
    expect(await markArt9Withdrawal(deps, x, deps.clock.now, { ledger: null })).toBe(false);
  });

  // ------------------------------------------------------------------ 7. replay of overtaken entries
  it('[7] replay skips ledger entries the restored data has overtaken (consent, holding, gender consent, block)', async () => {
    const theme = newConcept();
    const uid = await makeUser(deps, { themes: [{ c: theme, sens: true }, { c: newConcept() }] });
    const uidH = await h(uid);
    // Everyone the replay must resolve exists before the handlers index the database.
    const other = await makeUser(deps);
    const podId = base32Id(20);
    const blockAt = deps.clock.now;
    await docs(deps.db).block(uid, other).set({ blocker: uid, blocked: other, podId, createdAt: ts(blockAt) });
    await docs(deps.db).userBlock(uid, other).set({ firstName: 'Bo', podId, since: ts(blockAt) });
    const handlers = replayHandlers(deps);
    const user = (await read.user(deps, uid))!;
    const art9At = user.legal.art9!.at.toMillis();
    const entry = (kind: 'consentWithdrawal' | 'interest' | 'gender' | 'unblock', atMs: number, ref?: string) => ({ id: base32Id(20), uidH, kind, atMs, ...(ref ? { ref } : {}) });

    expect(await handlers.consentWithdrawal(entry('consentWithdrawal', art9At - DAY_MS, 'art9'))).toBe('nothingToDo');
    expect((await deps.db.collection(`users/${uid}/sensitiveInterests`).get()).size).toBe(1);

    const holding = (await deps.db.collection(`users/${uid}/interests`).get()).docs[0]!;
    const createdAt = (holding.get('createdAt') as { toMillis(): number }).toMillis();
    expect(await handlers.interest(entry('interest', createdAt - DAY_MS, holding.id))).toBe('nothingToDo');
    expect((await docs(deps.db).interest(uid, holding.id).get()).exists).toBe(true);

    const consentAt = deps.clock.now;
    await docs(deps.db).user(uid).update({ gender: 'woman', 'prefs.sameGenderOnly': true, 'legal.genderConsentAt': ts(consentAt) });
    expect(await handlers.gender(entry('gender', consentAt - HOUR))).toBe('nothingToDo');
    expect((await read.user(deps, uid))!.gender).toBe('woman');

    expect(await handlers.unblock(entry('unblock', blockAt - HOUR, `${await h(other)}:${podId}`))).toBe('nothingToDo');
    expect((await docs(deps.db).block(uid, other).get()).exists).toBe(true);
    // An unblock after the block still replays.
    expect(await handlers.unblock(entry('unblock', blockAt + HOUR, `${await h(other)}:${podId}`))).toBe('replayed');
    expect((await docs(deps.db).block(uid, other).get()).exists).toBe(false);
  });

  // ------------------------------------------------------------------ 8. adminRuns at erasure
  it('[8] purgeUser redacts the admin runs about the user (subjectH), leaving no uidH in them', async () => {
    const uid = await makeUser(deps);
    const uidH = await h(uid);
    const run = deps.db.collection(COLLECTIONS.adminRuns).doc();
    await run.set({ command: 'sanctions lift', target: `sanctions/${uidH}`, subjectH: uidH, reason: 'pause looked wrong', actor: 'a@x', project: 'demo', outcome: 'lifted', at: ts(deps.clock.now), expiresAt: ts(deps.clock.now + 365 * DAY_MS) });
    await purgeUser(deps, uid, null);
    const after = (await run.get()).data()!;
    expect(after).toMatchObject({ command: 'sanctions lift', target: ADMIN_RUN_REDACTED, reason: ADMIN_RUN_REDACTED, outcome: 'lifted' });
    expect(JSON.stringify(after)).not.toContain(uidH);
  });

  // ------------------------------------------------------------------ 9. report expiry
  it('[9] expireReports finds open reports behind any number of resolved ones, and an open report has no TTL until then', async () => {
    const { podId, members } = await flow.planningPod(4, W(22));
    const [a, b] = members as [string, string];
    const { reportId } = await flow.call('report', report, a, { target: { type: 'user', podId, uid: b }, category: 'harassment' });
    const ref = docs(deps.db).report(reportId);
    expect((await ref.get()).data()!.expiresAt).toBeUndefined();
    // Many older resolved reports would fill a createdAt-only page.
    const old = ts(Date.UTC(2020, 0, 1));
    for (let i = 0; i < 2; i++) {
      const batch = deps.db.batch();
      for (let j = 0; j < 500; j++) {
        batch.set(deps.db.collection(COLLECTIONS.reports).doc(), { reporterH: 'r'.repeat(43), targetH: 't'.repeat(43), podId, target: { type: 'user' }, category: 'content', status: 'resolved', decision: 'EXPIRED', createdAt: old, resolvedAt: old, expiresAt: ts(Date.UTC(2021, 0, 1)) });
      }
      await batch.commit();
    }
    const createdAt = (await ref.get()).data()!.createdAt.toMillis();
    const at = createdAt + 364 * DAY_MS;
    await expireReports(deps, at);
    const r = (await ref.get()).data()!;
    expect(r).toMatchObject({ status: 'resolved', decision: 'EXPIRED' });
    expect(r.expiresAt!.toMillis()).toBe(createdAt + 365 * DAY_MS);
    expect((await read.profile(deps, b)).openReportCount).toBe(0);
  });

  it('[12] report refuses a reporter whose account is being deleted', async () => {
    const { podId, members } = await flow.planningPod(4, W(23));
    await docs(deps.db).user(members[0]!).update({ status: 'deleting' });
    expect(await errorCode(flow.call('report', report, members[0]!, { target: { type: 'user', podId, uid: members[1]! }, category: 'harassment' }))).toBe('STATE');
  });

  // ------------------------------------------------------------------ 10. push tokens
  it('[10] pushes skip tokens older than 60 days, and a token moves to the account that registered it last', async () => {
    const [u1, u2] = await makeUsers(deps, 2);
    const now = deps.clock.now;
    await docs(deps.db).pushTokens(u1!).set({ tokens: [{ token: 'shared', platform: 'ios', updatedAt: ts(now - DAY_MS) }, { token: 'stale', platform: 'ios', updatedAt: ts(now - 61 * DAY_MS) }] });
    // A legacy doc without tokenHs still loses the token at push time to the later registration.
    await docs(deps.db).pushTokens(u2!).set({ tokens: [{ token: 'shared', platform: 'ios', updatedAt: ts(now) }] });
    expect(await recipientsFor(deps, [u1!, u2!])).toEqual([{ locale: 'en', tokens: ['shared'] }]);
    expect((await recipientsFor(deps, [u1!]))[0]!.tokens).toEqual(['shared']);

    await upsertToken(deps, u1!, 'shared', 'ios', now);
    await upsertToken(deps, u2!, 'shared', 'ios', now + 1000);
    expect((await docs(deps.db).pushTokens(u1!).get()).exists).toBe(false);
    expect((await docs(deps.db).pushTokens(u2!).get()).data()!.tokens.map((t) => t.token)).toEqual(['shared']);
  });

  // ------------------------------------------------------------------ 13. exit from an ended pod
  it('[13] erasure from an archived pod sends no "A member left" notice or push', async () => {
    const { podId, members } = await flow.planningPod(4, W(24));
    const at = deps.clock.now + HOUR;
    await withPod(deps, podId, at, async (ctx) => {
      await advance(ctx);
      ctx.ps.hasMet = true;
      await endPod(ctx, 'archived');
    });
    const p = deps.pushes.length;
    expect(await exitPod(deps, podId, members[0]!, 'erasure')).toBe(true);
    for (const uid of members.slice(1)) expect(await noticeCodes(uid)).not.toContain(NOTICE_CODES.POD_MEMBER_LEFT);
    expect(deps.pushes.slice(p).filter((x) => x.kind === 'podChanged')).toEqual([]);
  });

  // ------------------------------------------------------------------ 14. concept GC race
  it('[14] interest maintenance does not delete a concept that gained a member tag after its scan', async () => {
    const id = newConcept();
    const vec = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
    const at = ts(deps.clock.now);
    await deps.db.doc(`concepts/${id}`).set({ centroid: FieldValue.vector(vec), medoid: FieldValue.vector(vec), sum: Buffer.alloc(768 * 4), c128: Buffer.alloc(512), n: 0, sensitive: false, labels: {}, holderCount: 0, status: 'active', gen: 0, createdAt: at, updatedAt: at });
    const snap = await deps.db.doc(`concepts/${id}`).get();
    // addInterests assigns a tag right after the scan's first tag query.
    let added = false;
    const addTag = async () => {
      if (added) return;
      added = true;
      await deps.db.doc(`tags/race_${base32Id(8)}`).set({ norm: 'race', vec: FieldValue.vector(vec), sens: { sensitive: false }, conceptId: id, refCount: 1, langHints: { da: 0, en: 1 } });
    };
    const real = deps.db;
    const wrapQuery = (q: object): object =>
      new Proxy(q, {
        get(target, prop) {
          const v = Reflect.get(target, prop) as unknown;
          if (prop === 'where') return (...args: unknown[]) => wrapQuery((v as (...a: unknown[]) => object).apply(target, args));
          if (prop === 'get') return async () => {
            const res = await (v as () => Promise<unknown>).apply(target);
            await addTag();
            return res;
          };
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
      });
    const db = new Proxy(real, {
      get(target, prop) {
        const v = Reflect.get(target, prop) as unknown;
        if (prop === 'collection') return (path: string) => (path === 'tags' ? wrapQuery(target.collection(path)) : target.collection(path));
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    }) as Firestore;
    expect(await maintainConcept({ db }, snap, deps.clock.now)).toBe('unchanged');
    expect(added).toBe(true);
    expect((await real.doc(`concepts/${id}`).get()).exists).toBe(true);
  });

  // ------------------------------------------------------------------ 15. rosters of ended pods
  it('[15] updateProfile refreshes the roster copy in archived pods too', async () => {
    const { podId, members } = await flow.planningPod(4, W(24));
    await withPod(deps, podId, deps.clock.now + HOUR, async (ctx) => {
      await advance(ctx);
      ctx.ps.hasMet = true;
      await endPod(ctx, 'archived');
    });
    await flow.call('updateProfile', updateProfile, members[0]!, { firstName: 'Renamed', aboutMe: '' });
    const entry = (await read.pod(deps, podId))!.roster[members[0]!]!;
    expect(entry.firstName).toBe('Renamed');
    expect(entry.aboutMe).toBeUndefined();
  });

  it('[1] a callable from an account being deleted does not touch lastActiveAt', async () => {
    const uid = await makeUser(deps);
    await docs(deps.db).user(uid).update({ status: 'deleting' });
    const before = await lastActive(uid);
    await flow.call('registerPushToken', withActivity('registerPushToken', registerPushToken), uid, { token: 'x', platform: 'ios' }).catch(() => undefined);
    expect(await lastActive(uid)).toBe(before);
    expect(newUid()).not.toBe(uid);
  });
});
