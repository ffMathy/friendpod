/**
 * Removing interests and withdrawing the blanket Art. 9 consent (DESIGN.md §5.2, §10.1; PRIVACY.md §3.5) against the
 * Firestore emulator, with real holdings from addInterests (stand-in device vectors) in real pods: withdrawal
 * completeness (no document references the uid together with a withdrawn interestId or concept, chat messages
 * included; `users.legal.art9` gone), single removals of either kind with tag and concept garbage collection,
 * `podInterests` recomputed after removals and "Keep this private", stars, and alias votes. Owns weeks 2027-W30–W34.
 */
import { EMBEDDING_MODEL, consentProofFor, dropSchedule, interestId, uidHash, type Prototypes, type WeekId } from '@grouper/core';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { beforeAll, expect, it } from 'vitest';
import { addInterestsWith } from '../../src/callables/addInterests';
import { setArt9Consent, withdrawArt9Consent } from '../../src/callables/art9Consent';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { confirmSuggestion, removeInterest, updateInterest } from '../../src/callables/interests';
import * as pods from '../../src/callables/pods';
import { C128_DIM } from '../../src/interests/config';
import { tagKeyFor } from '../../src/interests/tags';
import { toF32Bytes, truncateNormalize } from '../../src/interests/vectors';
import { PATHS, ts } from '../../src/lib/firestore';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { forbidInLogs } from '../helpers/logCapture';
import { DAY, HOUR, podFlow } from '../helpers/podFlow';
import { LAUNCH_CELL, read } from '../helpers/pods';
import { StubVectors } from '../helpers/vectors';

const W = (n: number) => `2027-W${n}` as WeekId;
const MODEL_KEY = EMBEDDING_MODEL.modelKey;
const V = new StubVectors({
  cooking: { to: 'food and drink', cos: 0.9 },
  'hjemmelavet mad': { to: 'cooking', cos: 0.915 },
  bagning: { to: 'food and drink', cos: 0.9 },
  hjemmebag: { to: 'bagning', cos: 0.915 },
  'board games': { to: 'games', cos: 0.9 },
  løb: { to: 'sports', cos: 0.9 },
  gravid: { to: 'gravid prototype', cos: 0.97 },
});
const PROTOTYPES: Prototypes = V.prototypes(['gravid prototype'], ['food and drink', 'games', 'sports']);
const item = (text: string, extra: Record<string, unknown> = {}) => V.item(text, PROTOTYPES, extra);
const BLANKET = { ...consentProofFor('art9-blanket-en-v2'), appVersion: '1.2.3', checked: true as const };

describeEmulator('interest removal and consent withdrawal (emulator)', () => {
  const deps = emulatorDeps(dropSchedule(W(30)).releaseAt - 3 * DAY);
  const flow = podFlow(deps);
  const add = (uid: string, ...items: Record<string, unknown>[]) =>
    invoke('addInterests', addInterestsWith({ art9Holdings: true, configPath: 'config/none' }), deps, { modelKey: MODEL_KEY, items }, { uid });
  const doc = async (path: string) => (await deps.db.doc(path).get()).data();

  beforeAll(async () => {
    for (const col of ['tags', 'concepts', 'conceptLinks']) await deps.db.recursiveDelete(deps.db.collection(col));
  });

  async function onboarded(texts: string[], o: { consent?: boolean; at?: number } = {}): Promise<string> {
    const uid = newUid();
    await deps.auth.createUser({ uid });
    const at = o.at ?? deps.clock.now;
    deps.clock.now = at - 30 * DAY;
    await invoke('completeOnboarding', completeOnboarding, deps, { firstName: 'Testa', dob: '1990-05-05', locale: 'en', area: { gh5: LAUNCH_CELL }, legal: { terms: 't1', privacy: 'p1' } }, { uid, claims: { onb: undefined } });
    if (o.consent) await invoke('setArt9Consent', setArt9Consent, deps, { consent: BLANKET }, { uid });
    deps.clock.now = at;
    if (texts.length > 0) await add(uid, ...texts.map((t) => item(t)));
    return uid;
  }
  const idOf = (uid: string, norm: string) => interestId(testUidHmac, uid, norm);
  const conceptOf = async (uid: string, norm: string, partition = 'interests') => (await doc(`users/${uid}/${partition}/${await idOf(uid, norm)}`))?.conceptId as string;

  /** Every document that could hold the uid next to the withdrawn interest or concept. */
  async function references(uid: string, needles: string[], podIds: string[]): Promise<string[]> {
    const paths: string[] = [];
    const check = (path: string, data: unknown) => {
      const s = JSON.stringify(data);
      if (s.includes(uid) && needles.some((n) => s.includes(n))) paths.push(path);
    };
    const subtree = async (ref: FirebaseFirestore.DocumentReference) => {
      const snap = await ref.get();
      if (snap.exists) check(ref.path, snap.data());
      for (const c of await ref.listCollections()) for (const d of (await c.get()).docs) await subtree(d.ref);
    };
    await subtree(deps.db.doc(`users/${uid}`));
    await subtree(deps.db.doc(`matchProfiles/${uid}`));
    for (const id of podIds) {
      await subtree(deps.db.doc(`pods/${id}`));
      await subtree(deps.db.doc(`podState/${id}`));
    }
    for (const col of ['tags', 'concepts', 'photoGrants', 'podFeedback', 'consentEvents', 'erasureLedger']) for (const d of (await deps.db.collection(col).get()).docs) check(d.ref.path, d.data());
    return paths;
  }

  it('withdrawArt9Consent: every sensitive holding goes with the §3.5 effects, in pods too; the consent goes last', async () => {
    const members = [];
    for (let i = 0; i < 5; i++) members.push(await onboarded(['gravid', 'cooking', 'løb'], { consent: true }));
    const [a, b] = members as [string, string];
    forbidInLogs(...members, 'gravid');
    const theme = await conceptOf(a, 'gravid', 'sensitiveInterests');
    expect(theme).toMatch(/^c_/);
    const { podId } = await flow.planningPod(5, W(30), { members, theme, sensitive: true });
    const at = dropSchedule(W(30)).releaseAt + 2 * HOUR;
    const optionId = await flow.option(podId, a, dropSchedule(W(30)).releaseAt + 5 * DAY, at);
    await flow.vote(podId, a, optionId, 'yes', at);
    const otherOption = await flow.option(podId, b, dropSchedule(W(30)).releaseAt + 6 * DAY, at);
    await flow.vote(podId, a, otherOption, 'yes', at);
    await flow.call('setPhotoSharing', pods.setPhotoSharing, a, { podId, share: true }, at);
    expect(await read.grant(deps, a, b)).toBeDefined();
    await deps.db.doc(PATHS.podMessage(podId, 'm1')).set({ authorUid: a, text: 'hej allesammen', createdAt: ts(at), expiresAt: ts(at + 7 * DAY) });
    const interest = await idOf(a, 'gravid');

    deps.clock.now = at + HOUR;
    await expect(invoke('withdrawArt9Consent', (d, c) => withdrawArt9Consent(d, c), deps, {}, { uid: a })).resolves.toEqual({ removed: 1 });

    expect((await deps.db.collection(`users/${a}/sensitiveInterests`).get()).size).toBe(0);
    expect((await deps.db.collection(`users/${a}/interests`).get()).size).toBe(2);
    expect((await read.user(deps, a))!.legal.art9).toBeUndefined();
    expect((await read.user(deps, a))!.interestCount).toBe(2);
    expect((await read.profile(deps, a)).themes.some((t) => t.sens)).toBe(false);
    const pod = (await read.pod(deps, podId))!;
    expect(pod.memberUids).not.toContain(a);
    expect(Object.keys(pod.roster)).not.toContain(a);
    const ps = await flow.state(podId);
    expect(ps.members[a]).toBeUndefined();
    expect(ps.memberList).not.toContain(a);
    expect(await read.card(deps, a, podId)).toBeUndefined();
    expect(await read.options(deps, podId)).toEqual([otherOption]);
    expect((await doc(PATHS.option(podId, otherOption)))!.votes).toEqual({});
    expect(await doc(PATHS.podMessage(podId, 'm1'))).toBeUndefined();
    expect(await read.grant(deps, a, b)).toBeUndefined();
    expect((await doc(`tags/${tagKeyFor('gravid', MODEL_KEY)}`))!.refCount).toBe(4);
    const events = (await deps.db.collection('consentEvents').where('uid', '==', a).get()).docs.map((d) => d.data());
    expect(events.map((e) => e.action).sort()).toEqual(['grant', 'withdraw']);
    for (const e of events) expect(e.expiresAt).toBeDefined();
    const ledger = (await deps.db.collection('erasureLedger').where('uidH', '==', await uidHash(testUidHmac, a)).get()).docs.map((d) => d.data());
    expect(ledger).toEqual([expect.objectContaining({ kind: 'consentWithdrawal', ref: 'art9' })]);
    expect(await references(a, [interest, theme], [podId])).toEqual([]);
    // Idempotent: nothing left to withdraw.
    await expect(invoke('withdrawArt9Consent', (d, c) => withdrawArt9Consent(d, c), deps, {}, { uid: a })).resolves.toEqual({ removed: 0 });

    // removeInterest of one sensitive holding: the same effects for it only; the blanket consent stays.
    await flow.call('removeInterest', removeInterest, b, { interestId: await idOf(b, 'gravid') });
    expect((await read.user(deps, b))!.legal.art9).toBeDefined();
    expect((await read.pod(deps, podId))!.memberUids).not.toContain(b);
    expect(await read.card(deps, b, podId)).toBeUndefined();
    expect(await references(b, [await idOf(b, 'gravid'), theme], [podId])).toEqual([]);
    const bLedger = (await deps.db.collection('erasureLedger').where('uidH', '==', await uidHash(testUidHmac, b)).get()).docs.map((d) => d.data());
    expect(bLedger).toEqual([expect.objectContaining({ kind: 'interest', ref: await idOf(b, 'gravid') })]);
    expect(await errorCode(flow.call('removeInterest', removeInterest, b, { interestId: await idOf(b, 'gravid') }))).toBe('NOT_FOUND');
  });

  it('removeInterest of an ordinary holding: counts, concept GC, matchProfiles, podInterests, ledger', async () => {
    deps.clock.now = dropSchedule(W(31)).releaseAt - 3 * DAY;
    const members = [];
    for (let i = 0; i < 4; i++) members.push(await onboarded(['cooking', 'board games', 'løb']));
    const games = await conceptOf(members[0]!, 'board games');
    await deps.db.doc(`concepts/${games}`).update({ labels: { da: 'brætspil', en: 'board games' } });
    const theme = await conceptOf(members[0]!, 'cooking');
    const { podId } = await flow.planningPod(4, W(31), { members, theme });
    expect((await read.pod(deps, podId))!.podInterests.en).toContain('board games');

    for (const [i, uid] of members.entries()) {
      await flow.call('removeInterest', removeInterest, uid, { interestId: await idOf(uid, 'board games') });
      const shared = (await read.pod(deps, podId))!.podInterests.en;
      // Two holders are needed for a shared interest (S2).
      expect(shared.includes('board games')).toBe(i < 2);
      expect((await read.profile(deps, uid)).secondary).not.toContain(games);
    }
    expect(await doc(`tags/${tagKeyFor('board games', MODEL_KEY)}`)).toBeUndefined();
    expect(await doc(`concepts/${games}`)).toBeUndefined();
    expect((await read.user(deps, members[0]!))!.interestCount).toBe(2);
    const ledger = (await deps.db.collection('erasureLedger').where('uidH', '==', await uidHash(testUidHmac, members[0]!)).get()).docs.map((d) => d.get('kind'));
    expect(ledger).toEqual(['interest']);
  });

  it('"Keep this private" in an active pod takes the concept out of podInterests at once (§10.2)', async () => {
    deps.clock.now = dropSchedule(W(32)).releaseAt - 3 * DAY;
    const members = [];
    for (let i = 0; i < 4; i++) members.push(await onboarded(['cooking', 'board games', 'løb'], { consent: i < 3 }));
    const games = await conceptOf(members[0]!, 'board games');
    await deps.db.doc(`concepts/${games}`).update({ labels: { en: 'board games' } });
    const { podId } = await flow.planningPod(4, W(32), { members, theme: await conceptOf(members[0]!, 'cooking') });
    for (const uid of members.slice(0, 3)) {
      const res = await add(uid, item('board games', { selfFlagPrivate: true }));
      expect(res.results[0]).toMatchObject({ status: 'madePrivate' });
    }
    expect((await read.pod(deps, podId))!.podInterests.en).not.toContain('board games');
  });

  it('updateInterest stars at most 3 holdings and mirrors stars into matchProfiles.themes', async () => {
    const uid = await onboarded(['cooking', 'board games', 'løb', 'hjemmelavet mad']);
    const ids = await Promise.all(['cooking', 'board games', 'løb', 'hjemmelavet mad'].map((t) => idOf(uid, t)));
    for (const id of ids.slice(0, 3)) await flow.call('updateInterest', updateInterest, uid, { interestId: id, starred: true });
    expect(await errorCode(flow.call('updateInterest', updateInterest, uid, { interestId: ids[3], starred: true }))).toBe('STAR_LIMIT');
    expect((await read.profile(deps, uid)).themes.filter((t) => t.starred)).toHaveLength(3);
    await flow.call('updateInterest', updateInterest, uid, { interestId: ids[0], starred: false });
    await flow.call('updateInterest', updateInterest, uid, { interestId: ids[3], starred: true });
    expect((await doc(`users/${uid}/interests/${ids[3]}`))!.starred).toBe(true);
    expect(await errorCode(flow.call('updateInterest', updateInterest, uid, { interestId: 'a'.repeat(16), starred: true }))).toBe('NOT_FOUND');
  });

  it('confirmSuggestion re-points the holding and records an alias vote; at 3 distinct users the text maps to the concept for everyone', async () => {
    const vec = V.vector('bagning');
    const target = 'c_00000000000000000a1a';
    const at = Timestamp.fromMillis(deps.clock.now);
    await deps.db.doc(`concepts/${target}`).set({
      centroid: FieldValue.vector(Array.from(vec)),
      medoid: FieldValue.vector(Array.from(vec)),
      sum: toF32Bytes(vec),
      c128: toF32Bytes(truncateNormalize(vec, C128_DIM)),
      n: 1,
      sensitive: false,
      labels: { da: 'bagning', en: 'baking' },
      holderCount: 12,
      status: 'active',
      gen: 0,
      seed: true,
      createdAt: at,
      updatedAt: at,
    });
    const users = [];
    for (let i = 0; i < 4; i++) users.push(await onboarded([]));
    const results = [];
    for (const uid of users) results.push((await add(uid, item('hjemmebag'))).results[0]!);
    expect(results[0]).toMatchObject({ status: 'added', suggestion: { conceptId: target, label: 'baking' } });
    const own = await conceptOf(users[0]!, 'hjemmebag');
    for (const uid of users.slice(0, 2)) await flow.call('confirmSuggestion', confirmSuggestion, uid, { interestId: await idOf(uid, 'hjemmebag'), conceptId: target });
    const key = tagKeyFor('hjemmebag', MODEL_KEY);
    expect((await doc(`tags/${key}`))).toMatchObject({ conceptId: own, aliasVotes: { [target]: 2 } });
    expect(await conceptOf(users[0]!, 'hjemmebag')).toBe(target);
    expect((await read.profile(deps, users[0]!)).themeIds).toContain(target);
    expect(await errorCode(flow.call('confirmSuggestion', confirmSuggestion, users[2]!, { interestId: await idOf(users[2]!, 'hjemmebag'), conceptId: 'c_00000000000000000bbb' }))).toBe('STATE');

    await flow.call('confirmSuggestion', confirmSuggestion, users[2]!, { interestId: await idOf(users[2]!, 'hjemmebag'), conceptId: target });
    expect((await doc(`tags/${key}`))).toMatchObject({ conceptId: target, assign: { method: 'alias' } });
    // The fourth holder never voted, and now points at the concept too; the emptied concept is gone.
    expect(await conceptOf(users[3]!, 'hjemmebag')).toBe(target);
    expect((await read.profile(deps, users[3]!)).themeIds).toContain(target);
    expect(await doc(`concepts/${own}`)).toBeUndefined();
    expect((await doc(`concepts/${target}`))!.n).toBe(2);
    // Removing such a holding still finds its tag slot.
    await flow.call('removeInterest', removeInterest, users[0]!, { interestId: await idOf(users[0]!, 'hjemmebag') });
    expect((await doc(`tags/${key}`))!.refCount).toBe(3);
  });
});
