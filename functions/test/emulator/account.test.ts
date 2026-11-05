/**
 * Account and data (DESIGN.md §3.9, §3.10, §9; PRIVACY.md §6) against the Firestore emulator, with the user bucket in
 * memory: push tokens, photo processing (EXIF stripped, versions, rosters, grants, kill switch, daily limit), photo
 * deletion, the export (contents, no co-member data, 24 h), and account deletion with the full purge, checked for
 * completeness: afterwards no document or object holds the uid or its uidH except the documented pseudonymised
 * records. Owns weeks 2027-W40–W44.
 */
import { NOTICE_CODES, dropSchedule, uidHash, type WeekId } from '@grouper/core';
import { expect, it } from 'vitest';
import { deleteAccount, deletePhoto, exportData, registerPushToken } from '../../src/callables/account';
import { report } from '../../src/callables/safety';
import { DAY_MS, PATHS, docs, ts } from '../../src/lib/firestore';
import { OBJECT_PATHS } from '../../src/lib/objects';
import { processUpload } from '../../src/photos/process';
import { buildExport, deleteExport } from '../../src/tasks/export';
import { purgeUser } from '../../src/tasks/purge';
import { describeEmulator, emulatorDeps, errorCode, newUid } from '../helpers/emulator';
import { testJpeg } from '../helpers/jpeg';
import { testUidHmac } from '../helpers/keys';
import { forbidInLogs } from '../helpers/logCapture';
import { DAY, HOUR, podFlow } from '../helpers/podFlow';
import { makeUser, read } from '../helpers/pods';

const W = (n: number) => `2027-W${n}` as WeekId;

describeEmulator('account and data (emulator)', () => {
  const deps = emulatorDeps(dropSchedule(W(40)).releaseAt);
  const flow = podFlow(deps);
  const upload = (uid: string, full = testJpeg(800, 600), thumb = testJpeg(256, 192)) => {
    deps.objects.put(OBJECT_PATHS.pendingUpload(uid), full);
    deps.objects.put(OBJECT_PATHS.pendingThumb(uid), thumb);
  };

  it('registerPushToken upserts one entry per token and drops stale ones', async () => {
    const uid = await makeUser(deps);
    const now = deps.clock.now;
    await docs(deps.db).pushTokens(uid).set({ tokens: [{ token: 'old', platform: 'ios', updatedAt: ts(now - 61 * DAY_MS) }, { token: 'keep', platform: 'android', updatedAt: ts(now - DAY_MS) }] });
    await flow.call('registerPushToken', registerPushToken, uid, { token: 'fresh', platform: 'ios' });
    await flow.call('registerPushToken', registerPushToken, uid, { token: 'fresh', platform: 'ios' });
    const tokens = (await docs(deps.db).pushTokens(uid).get()).data()!.tokens.map((t) => t.token).sort();
    expect(tokens).toEqual(['fresh', 'keep']);
  });

  it('processes an upload pair: EXIF gone, next version, roster photoV and grants; earlier versions deleted', async () => {
    const { podId, members } = await flow.planningPod(4, W(40));
    const [a, b] = members as [string, string];
    upload(a);
    // The first event may find only one file; the pair is processed once.
    expect((await processUpload(deps, OBJECT_PATHS.pendingThumb(a), { configPath: 'config/none' })).outcome).toBe('processed');
    expect((await processUpload(deps, OBJECT_PATHS.pendingUpload(a), { configPath: 'config/none' })).outcome).toBe('waiting');
    expect(deps.objects.names(`uploads/${a}/`)).toEqual([]);
    expect(deps.objects.names(`photos/${a}/`)).toEqual([`photos/${a}/1.jpg`, `photos/${a}/1_256.jpg`]);
    const stored = deps.objects.objects.get(`photos/${a}/1.jpg`)!;
    expect(Buffer.from(stored.data).toString('latin1')).not.toMatch(/Exif|GPS/);
    expect(stored.cacheControl).toBe('private, max-age=3600');
    expect((await read.user(deps, a))!.photo).toEqual({ v: 1 });
    expect((await read.pod(deps, podId))!.roster[a]!.photoV).toBe(1);
    expect(await read.grant(deps, a, b)).toBeDefined();

    upload(a);
    await processUpload(deps, OBJECT_PATHS.pendingUpload(a), { configPath: 'config/none' });
    expect(deps.objects.names(`photos/${a}/`)).toEqual([`photos/${a}/2.jpg`, `photos/${a}/2_256.jpg`]);
    expect((await read.pod(deps, podId))!.roster[a]!.photoV).toBe(2);

    // deletePhoto: every version, the user doc, rosters, outgoing grants, a ledger entry with the version.
    await flow.call('deletePhoto', (d, c) => deletePhoto(d, c), a, {});
    expect(deps.objects.names(`photos/${a}/`)).toEqual([]);
    expect((await read.user(deps, a))!.photo).toBeNull();
    expect((await read.pod(deps, podId))!.roster[a]!.photoV).toBeNull();
    expect(await read.grant(deps, a, b)).toBeUndefined();
    expect(await read.grant(deps, b, a)).toBeDefined();
    const ledger = (await deps.db.collection('erasureLedger').where('uidH', '==', await uidHash(testUidHmac, a)).get()).docs.map((d) => d.data());
    expect(ledger).toEqual([expect.objectContaining({ kind: 'photo', ref: '2' })]);
  });

  it('refuses invalid images, honours the uploads kill switch and the daily limit', async () => {
    const uid = await makeUser(deps);
    upload(uid, testJpeg(5000, 600));
    expect((await processUpload(deps, OBJECT_PATHS.pendingUpload(uid), { configPath: 'config/none' })).outcome).toBe('invalid');
    expect(deps.objects.names(`uploads/${uid}/`)).toEqual([]);
    await deps.db.doc('config/uploadsOff').set({ features: { uploads: false } });
    upload(uid);
    expect((await processUpload(deps, OBJECT_PATHS.pendingUpload(uid), { configPath: 'config/uploadsOff' })).outcome).toBe('disabled');
    expect(deps.objects.names(`uploads/${uid}/`)).toEqual([]);
    for (let i = 0; i < 5; i++) {
      upload(uid);
      expect((await processUpload(deps, OBJECT_PATHS.pendingUpload(uid), { configPath: 'config/none' })).outcome).toBe('processed');
    }
    upload(uid);
    expect((await processUpload(deps, OBJECT_PATHS.pendingUpload(uid), { configPath: 'config/none' })).outcome).toBe('limited');
    expect((await read.user(deps, uid))!.photo).toEqual({ v: 5 });
  });

  it('exports the user\'s own data (never co-members\' names or answers), 1 per day, deleted after 24 h', async () => {
    const { podId, members } = await flow.planningPod(4, W(41));
    const [a, b] = members as [string, string];
    await docs(deps.db).user(a).update({ aboutMe: 'New in town' });
    await deps.db.doc(PATHS.podMessage(podId, 'm1')).set({ authorUid: a, text: 'see you there', createdAt: ts(deps.clock.now), expiresAt: ts(deps.clock.now + DAY) });
    await deps.db.doc(PATHS.podMessage(podId, 'm2')).set({ authorUid: b, text: 'not mine', createdAt: ts(deps.clock.now), expiresAt: ts(deps.clock.now + DAY) });
    await flow.call('report', report, b, { target: { type: 'message', podId, messageId: 'm1' }, category: 'content', text: 'the reporter wrote this' });

    const { exportId } = await flow.call('exportData', (d, c) => exportData(d, c), a, {});
    expect(deps.enqueued.at(-1)).toMatchObject({ queue: 'buildExport', data: { uid: a, exportId } });
    expect(await errorCode(flow.call('exportData', (d, c) => exportData(d, c), a, {}))).toBe('RATE_LIMITED');
    expect(await buildExport(deps, a, exportId)).toBe('built');
    const path = OBJECT_PATHS.export(a, exportId);
    const json = JSON.parse(Buffer.from(deps.objects.objects.get(path)!.data).toString('utf8')) as Record<string, unknown>;
    const text = JSON.stringify(json);
    expect(json.profile).toMatchObject({ firstName: 'Ada', aboutMe: 'New in town' });
    expect((json.interests as unknown[]).length).toBe(1);
    expect(json.meetupChatMessages).toEqual([expect.objectContaining({ podId, text: 'see you there' })]);
    expect(json.reportsAboutMe).toEqual([expect.objectContaining({ category: 'content', myMessage: 'see you there' })]);
    expect(json.pods).toEqual([expect.objectContaining({ podId, members: 4, myStatus: 'accepted' })]);
    for (const leak of ['not mine', 'the reporter wrote this', b]) expect(text).not.toContain(leak);
    expect((await docs(deps.db).export(a, exportId).get()).data()).toMatchObject({ status: 'ready', path });
    expect((await deps.db.collection(`users/${a}/notices`).where('code', '==', NOTICE_CODES.EXPORT_READY).get()).size).toBe(1);
    const del = deps.enqueued.find((t) => t.queue === 'deleteExport' && t.data.exportId === exportId)!;
    expect(del.options.scheduleTime).toBe(deps.clock.now + DAY_MS);
    await deleteExport(deps, a, exportId);
    expect(deps.objects.names(`exports/${a}/`)).toEqual([]);
    expect((await docs(deps.db).export(a, exportId).get()).exists).toBe(false);
  });

  it('deleteAccount then purgeUser: nothing holds the uid or its uidH except consentEvents, erasureLedger and reports', async () => {
    const { podId, members } = await flow.scheduledPod(5, W(42));
    const [a, b, c] = members as [string, string, string];
    const uid = a;
    const h = await uidHash(testUidHmac, uid);
    forbidInLogs(uid, h);
    await deps.auth.createUser({ uid });
    await deps.db.doc(PATHS.podMessage(podId, 'mx')).set({ authorUid: uid, text: 'on my way', createdAt: ts(deps.clock.now), expiresAt: ts(deps.clock.now + DAY) });
    await flow.call('report', report, uid, { target: { type: 'user', podId, uid: b }, category: 'content' });
    await flow.call('report', report, c, { target: { type: 'message', podId, messageId: 'mx' }, category: 'harassment' });
    await deps.db.collection('consentEvents').add({ uid, scope: 'gender', action: 'grant', textVersion: 'gender-en-v1', textSha256: '0'.repeat(64), locale: 'en', appVersion: '1', method: 'checkbox+button', createdAt: ts(deps.clock.now) });
    await docs(deps.db).matchProfile(b).update({ recentH: { [h]: '9999-W52' }, recentMinUntil: '9999-W52' });
    deps.objects.put(OBJECT_PATHS.photo(uid, 1), testJpeg(800, 600));
    deps.objects.put(OBJECT_PATHS.export(uid, 'e1'), new Uint8Array([1]));

    const at = dropSchedule(W(42)).releaseAt + 3 * HOUR;
    deps.clock.now = at;
    await flow.call('deleteAccount', (d, call) => deleteAccount(d, call), uid, {});
    expect((await read.user(deps, uid))!.status).toBe('deleting');
    expect(await deps.auth.getUser(uid).catch(() => null)).toBeNull();
    const purge = deps.enqueued.find((t) => t.queue === 'purgeUser' && t.data.uid === uid);
    expect(purge?.options.id).toBe(`purge-${h}`);

    await purgeUser(deps, uid, null);
    await purgeUser(deps, uid, null); // a retry changes nothing

    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).not.toContain(uid);
    // The winning option stays for the others, reattributed to "former member".
    const options = (await deps.db.collection(`pods/${podId}/options`).get()).docs.map((d) => d.data());
    expect(options.every((o) => o.authorUid !== uid && !(uid in o.votes))).toBe(true);
    const reports = (await deps.db.collection('reports').where('podId', '==', podId).get()).docs.map((d) => d.data());
    expect(reports).toEqual(expect.arrayContaining([expect.objectContaining({ reporterH: h }), expect.objectContaining({ targetH: h, message: { text: 'on my way' } })]));
    expect(deps.objects.names(`photos/${uid}/`)).toEqual([]);
    expect(deps.objects.names(`exports/${uid}/`)).toEqual([]);

    // Completeness (PRIVACY.md §6 step 8): scan everything.
    const allowed = new Set(['consentEvents', 'erasureLedger', 'reports']);
    const leaks: string[] = [];
    const check = (path: string, data: unknown) => {
      const text = `${path} ${JSON.stringify(data)}`;
      const top = path.split('/')[0]!;
      if ((text.includes(uid) || text.includes(h)) && !(allowed.has(top) && !text.includes(uid))) leaks.push(path);
    };
    const subtree = async (ref: FirebaseFirestore.DocumentReference) => {
      const snap = await ref.get();
      if (snap.exists) check(ref.path, snap.data());
      for (const sub of await ref.listCollections()) for (const d of await sub.listDocuments()) await subtree(d);
    };
    for (const col of await deps.db.listCollections()) for (const d of (await col.get()).docs) check(d.ref.path, d.data());
    for (const m of members) await subtree(deps.db.doc(`users/${m}`));
    await subtree(deps.db.doc(`pods/${podId}`));
    expect(leaks).toEqual([]);
    const events = (await deps.db.collection('consentEvents').where('uidH', '==', h).get()).docs.map((d) => d.data());
    expect(events).toEqual([expect.objectContaining({ redactedAt: expect.anything(), expiresAt: expect.anything() })]);
    expect((await deps.db.collection('erasureLedger').where('uidH', '==', h).where('kind', '==', 'account').get()).size).toBeGreaterThan(0);
  });

  it('a new user without onboarding is simply refused by the account callables', async () => {
    expect(await errorCode(flow.call('exportData', (d, c) => exportData(d, c), newUid(), {}))).toBe('NOT_FOUND');
  });
});
