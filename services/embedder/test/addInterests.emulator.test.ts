/**
 * addInterests end to end against the Firestore emulator, with the StubEmbedder (DESIGN.md §13 "embedder"):
 * the consent gate writes, caches and logs nothing; consent persists atomically; vectors never leave;
 * cache keys carry the modelId; partitions never mix; self-flags stay private; third-party refusals.
 */
import {
  consentProofFor,
  interestId,
  lexiconCheck,
  newConceptId,
  uidHash,
  type CallableOutput,
} from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { createAddInterestsHandler } from '../src/callable';
import { MODEL } from '../src/config';
import { fromF32Bytes } from '../src/lib/vectors';
import { tagKeyFor } from '../src/tags';
import { captureOutput } from './helpers/capture';
import { changedPaths, clearFirestore, describeEmulator, dumpAll, testDb } from './helpers/emulator';
import { callRequest, harness, hmac, seedConcept, seedUser, type Harness } from './helpers/fixtures';

type Output = CallableOutput<'addInterests'>;
const DA = consentProofFor('art9-tag-da-v1');
const consent = { ...DA, appVersion: '1.2.3', checked: true as const };

describeEmulator('addInterests (emulator)', () => {
  let db: Firestore;
  let h: Harness;
  let call: (uid: string | null, data: unknown, opts?: { onb?: boolean; appCheck?: boolean }) => Promise<Output>;

  beforeAll(async () => {
    db = testDb();
    // First contact initialises the client (and any credential lookup) outside the captured windows.
    await db.doc('warmup/x').get();
  });

  beforeEach(async () => {
    await clearFirestore();
    h = await harness(db);
    const handler = createAddInterestsHandler(h.metrics, () => h.deps);
    call = (uid, data, opts) => handler(callRequest(uid, data, opts));
    await seedUser(db, 'alice');
    await seedUser(db, 'bob', { locale: 'en' });
  });

  afterEach(() => {
    h.metrics.flush();
  });

  const rateLimitDoc = (uid: string): string => `rateLimits/${uid}_addInterests`;

  it('consent gate: a lexicon-sensitive tag without consent writes, caches, embeds and logs nothing', async () => {
    expect(lexiconCheck('gravid').hit).toBe(true);
    const before = await dumpAll(db);
    const lruBefore = h.lru.keys();
    const body = { items: [{ text: 'Gravid' }] };
    const out = captureOutput();
    let res: Output;
    try {
      res = await call('alice', body);
    } finally {
      out.restore();
    }
    expect(res.results).toEqual([{ status: 'needsConsent' }]);

    // Only the per-call rate-limit window changed: a counter, no text and no vector.
    const changed = changedPaths(before, await dumpAll(db));
    expect(changed).toEqual([rateLimitDoc('alice')]);
    const bucket = (await db.doc(rateLimitDoc('alice')).get()).data();
    expect(Object.keys(bucket ?? {}).sort()).toEqual(['count', 'expiresAt', 'windowStart']);

    expect(h.lru.keys()).toEqual(lruBefore);
    expect(h.stub.calls).toHaveLength(0);
    expect(h.runtimeLoads).toBe(0);

    const logged = out.text();
    const uidH = await uidHash(hmac, 'alice');
    for (const needle of ['alice', uidH, 'gravid', 'Gravid', JSON.stringify(body)]) expect(logged).not.toContain(needle);
    expect(logged).toBe('');

    // The aggregate counter is the only trace, flushed later as one uid-free entry.
    h.metrics.flush();
    const entry = h.entries.at(-1);
    expect(entry?.kind).toBe('embedder');
    expect(entry?.values.needsConsent).toBe(1);
    expect(Object.values(entry?.values ?? {}).every((v) => typeof v === 'number')).toBe(true);
    expect(JSON.stringify(entry)).not.toMatch(/alice|gravid/i);
  });

  it('consent gate: a detector-suspected new tag is embedded but nothing about it is kept', async () => {
    expect(lexiconCheck('ønsker os et barn').hit).toBe(false);
    const before = await dumpAll(db);
    const out = captureOutput();
    let res: Output;
    try {
      res = await call('alice', { items: [{ text: 'ønsker os et barn' }] });
    } finally {
      out.restore();
    }
    expect(res.results).toEqual([{ status: 'needsConsent' }]);
    expect(h.stub.calls).toHaveLength(1);
    const changed = changedPaths(before, await dumpAll(db));
    expect(changed).toEqual([`rateLimits/global_embedMiss_2026-11-04`, rateLimitDoc('alice')].sort());
    expect(h.lru.size).toBe(0);
    expect(out.text()).toBe('');
    h.metrics.flush();
    expect(h.entries.at(-1)?.values).toMatchObject({ needsConsent: 1, flagged: 1, cacheMisses: 1 });
  });

  it('valid consent persists the holding and its consent event in one transaction', async () => {
    const res = await call('alice', { items: [{ text: 'Gravid', consent, category: 'health' }] });
    const id = await interestId(hmac, 'alice', 'gravid');
    expect(res.results).toEqual([{ status: 'added', interestId: id }]);

    const holding = (await db.doc(`users/alice/sensitiveInterests/${id}`).get()).data();
    expect(holding).toMatchObject({ display: 'Gravid', norm: 'gravid', selfFlagged: false, source: 'lexicon', categoryConfirmed: 'health', consentTextVersion: DA.textVersion });
    expect((await db.doc(`users/alice/interests/${id}`).get()).exists).toBe(false);

    const event = (await db.doc(`consentEvents/${holding?.consentEventId}`).get()).data();
    expect(event).toMatchObject({
      uid: 'alice',
      scope: 'art9',
      interestId: id,
      category: 'health',
      action: 'grant',
      textVersion: DA.textVersion,
      textSha256: DA.textSha256,
      locale: 'da',
      appVersion: '1.2.3',
      method: 'checkbox+button',
    });
    expect(JSON.stringify(event)).not.toContain('gravid');

    const tagKey = tagKeyFor('gravid', MODEL.modelId);
    const tag = (await db.doc(`tags/${tagKey}`).get()).data();
    expect(tag).toMatchObject({ refCount: 1, conceptId: holding?.conceptId, sens: { lexiconHit: true } });
    expect(JSON.stringify(tag)).not.toContain('alice');
    const concept = (await db.doc(`concepts/${holding?.conceptId}`).get()).data();
    expect(concept).toMatchObject({ sensitive: true, labels: {}, holderCount: 0, n: 1, status: 'active' });

    const profile = (await db.doc('matchProfiles/alice').get()).data();
    expect(profile?.themes).toEqual([{ c: holding?.conceptId, starred: false, sens: true, consentRef: holding?.consentEventId }]);
    expect(profile?.secondary).toEqual([]);
    expect((await db.doc('users/alice').get()).get('interestCount')).toBe(1);
    expect(h.lru.keys()).toEqual([tagKey]);
  });

  it('a failing transaction leaves neither holding nor consent event behind', async () => {
    await db.doc('matchProfiles/alice').delete();
    await expect(call('alice', { items: [{ text: 'Gravid', consent }] })).rejects.toMatchObject({
      code: 'failed-precondition',
      details: { code: 'NOT_ONBOARDED' },
    });
    expect((await db.collection('consentEvents').get()).size).toBe(0);
    expect((await db.collection('users/alice/sensitiveInterests').get()).size).toBe(0);
    expect((await db.collection('tags').get()).size).toBe(0);
    expect((await db.collection('concepts').get()).size).toBe(0);
    expect(h.lru.size).toBe(0);
  });

  it('refuses every sensitive holding while withdrawal is not available, before consent is asked or anything is kept', async () => {
    const gated = await harness(db, { art9: false });
    const handler = createAddInterestsHandler(gated.metrics, () => gated.deps);
    const before = await dumpAll(db);
    const res = await handler(
      callRequest('alice', { items: [{ text: 'Gravid' }, { text: 'Gravid i uge 20', consent }, { text: 'ønsker os et barn' }, { text: 'board games', selfFlag: true, consent }, { text: 'cooking' }] }),
    );
    const unavailable = { status: 'limit', reasonCode: 'SENSITIVE_UNAVAILABLE' };
    expect(res.results.slice(0, 4)).toEqual([unavailable, unavailable, unavailable, unavailable]);
    expect(res.results[4]).toMatchObject({ status: 'added' });
    // Only the ordinary holding and its bookkeeping were written: nothing in the sensitive partition, no consent event.
    const changed = changedPaths(before, await dumpAll(db));
    expect(changed.filter((p) => /sensitiveInterests|consentEvents|reviewQueue/.test(p))).toEqual([]);
    const tags = await db.collection('tags').get();
    expect(tags.docs.map((d) => d.get('norm'))).toEqual(['cooking']);
    expect(gated.lru.size).toBe(1);
  });

  it('refuses an account that is being deleted or is suspended, before the window, the model or any write', async () => {
    for (const status of ['deleting', 'suspended'] as const) {
      await seedUser(db, 'zed');
      await db.doc('users/zed').update({ status });
      const before = await dumpAll(db);
      await expect(call('zed', { items: [{ text: 'Gravid', consent }] })).rejects.toMatchObject({ code: 'failed-precondition', details: { code: 'STATE' } });
      await expect(call('zed', { items: [] })).rejects.toMatchObject({ details: { code: 'STATE' } });
      expect(changedPaths(before, await dumpAll(db)), status).toEqual([]);
    }
    expect(h.runtimeLoads).toBe(0);
    expect(h.stub.calls).toHaveLength(0);
  });

  it('writes nothing when the account starts deleting while the request is being embedded (PRIVACY.md §6)', async () => {
    const takeUidCall = h.deps.takeUidCall;
    const racing = createAddInterestsHandler(h.metrics, () => ({
      ...h.deps,
      // deleteAccount commits right after this request passed its window check.
      takeUidCall: async (uid, at) => {
        const ok = await takeUidCall(uid, at);
        await db.doc(`users/${uid}`).update({ status: 'deleting' });
        return ok;
      },
    }));
    await expect(racing(callRequest('alice', { items: [{ text: 'Gravid', consent }] }))).rejects.toMatchObject({ details: { code: 'STATE' } });
    expect(h.stub.calls.length).toBeGreaterThan(0);
    expect((await db.collection('consentEvents').get()).size).toBe(0);
    expect((await db.collection('users/alice/sensitiveInterests').get()).size).toBe(0);
    expect((await db.collection('tags').get()).size).toBe(0);
    expect((await db.collection('concepts').get()).size).toBe(0);
    expect((await db.doc('matchProfiles/alice').get()).get('themes')).toEqual([]);
  });

  it('an unknown consent text or hash is rejected before anything is processed', async () => {
    const before = await dumpAll(db);
    const badHash = { textVersion: DA.textVersion, textSha256: '0'.repeat(64), appVersion: '1.2.3', checked: true };
    await expect(call('alice', { items: [{ text: 'Gravid', consent: badHash }] })).rejects.toMatchObject({
      code: 'invalid-argument',
      details: { code: 'VALIDATION' },
    });
    // A valid hash of another scope (gender) does not cover an Art. 9 tag either.
    const gender = { ...consentProofFor('gender-da-v1'), appVersion: '1.2.3', checked: true };
    await expect(call('alice', { items: [{ text: 'Gravid', consent: gender }] })).rejects.toMatchObject({ details: { code: 'VALIDATION' } });
    expect(changedPaths(before, await dumpAll(db))).toEqual([rateLimitDoc('alice')]);
    expect(h.stub.calls).toHaveLength(0);
  });

  it('responses carry statuses only, never vectors', async () => {
    await seedConcept(db, h.stub, 'seed_cooking', 'cooking', { sensitive: false, holderCount: 12, labels: { da: 'madlavning', en: 'cooking' } });
    const res = await call('alice', { items: [{ text: 'hjemmelavet mad' }, { text: 'Gravid', consent }, { text: 'x' }] });
    expect(JSON.stringify(res)).not.toMatch(/\[\s*-?\d+(\.\d+)?\s*,/);
    for (const r of res.results) {
      expect(Object.keys(r).every((k) => ['status', 'interestId', 'suggestion', 'reasonCode', 'warning'].includes(k))).toBe(true);
    }
    expect(res.results[0]?.suggestion).toEqual({ conceptId: 'seed_cooking', label: 'madlavning' });
    expect(res.results[2]).toEqual({ status: 'rejected', reasonCode: 'TAG_TOO_SHORT' });
  });

  it('cache keys and tag docs carry the modelId', async () => {
    await call('alice', { items: [{ text: 'Løb' }] });
    const key = sha256Hex(`${MODEL.modelId}|768|sts|løb`);
    expect(tagKeyFor('løb', MODEL.modelId)).toBe(key);
    const tag = await db.doc(`tags/${key}`).get();
    expect(tag.exists).toBe(true);
    expect(tag.get('modelId')).toBe(MODEL.modelId);
    expect(tagKeyFor('løb', 'eg300m-q4@5090578')).not.toBe(key);
  });

  it('a second holder of a persisted text is served from the LRU without a model call', async () => {
    await call('alice', { items: [{ text: 'løb' }] });
    expect(h.stub.calls).toHaveLength(1);
    const res = await call('bob', { items: [{ text: 'LØB' }] });
    expect(res.results[0]?.status).toBe('added');
    expect(h.stub.calls).toHaveLength(1);
    const tag = await db.doc(`tags/${tagKeyFor('løb', MODEL.modelId)}`).get();
    expect(tag.get('refCount')).toBe(2);
  });

  it('merges into a close ordinary concept and suggests a near one', async () => {
    const cooking = await seedConcept(db, h.stub, 'seed_cooking', 'cooking', { sensitive: false, holderCount: 12, labels: { da: 'madlavning', en: 'cooking' } });
    const res = await call('alice', { items: [{ text: 'Madlavning' }, { text: 'hjemmelavet mad' }] });
    expect(res.results[0]).toMatchObject({ status: 'added' });
    expect(res.results[0]?.suggestion).toBeUndefined();
    const merged = (await db.doc(`users/alice/interests/${res.results[0]?.interestId}`).get()).data();
    expect(merged?.conceptId).toBe('seed_cooking');
    const concept = (await db.doc('concepts/seed_cooking').get()).data();
    expect(concept?.n).toBe(2);
    const sum = fromF32Bytes(concept?.sum as Uint8Array, MODEL.dim);
    const expected = h.stub.vector('madlavning').map((x, i) => x + cooking[i]!);
    expect(Math.max(...sum.map((x, i) => Math.abs(x - expected[i]!)))).toBeLessThan(1e-6);

    const nearKey = tagKeyFor('hjemmelavet mad', MODEL.modelId);
    const near = (await db.doc(`users/alice/interests/${res.results[1]?.interestId}`).get()).data();
    expect(near?.conceptId).toBe(await newConceptId(hmac, nearKey, false));
    expect(res.results[1]?.suggestion).toEqual({ conceptId: 'seed_cooking', label: 'madlavning' });
    const link = await db.doc(`conceptLinks/${[near?.conceptId, 'seed_cooking'].sort().join('__')}`).get();
    expect(link.data()).toMatchObject({ status: 'candidate', votes: 0 });
    const profile = (await db.doc('matchProfiles/alice').get()).data();
    expect(profile?.secondary).toEqual(['seed_cooking', near?.conceptId]);
  });

  it('never merges across sensitivity, in either direction', async () => {
    await seedConcept(db, h.stub, 'seed_yoga', 'yoga', { sensitive: false });
    await seedConcept(db, h.stub, 'seed_kirkegaenger', 'kirkegænger', { sensitive: true });

    // Sensitive tag at cos 0.97 to an ordinary concept (above every merge threshold): a new sensitive concept.
    const res = await call('alice', { items: [{ text: 'graviditetsyoga', consent }, { text: 'kirkekor' }] });
    expect(res.results.map((r) => r.status)).toEqual(['added', 'added']);
    const sens = (await db.doc(`users/alice/sensitiveInterests/${res.results[0]?.interestId}`).get()).data();
    expect(sens?.conceptId).not.toBe('seed_yoga');
    expect((await db.doc(`concepts/${sens?.conceptId}`).get()).get('sensitive')).toBe(true);
    // Ordinary tag at cos 0.97 to a sensitive concept: a new ordinary concept.
    const ord = (await db.doc(`users/alice/interests/${res.results[1]?.interestId}`).get()).data();
    expect(ord?.conceptId).not.toBe('seed_kirkegaenger');
    expect((await db.doc(`concepts/${ord?.conceptId}`).get()).get('sensitive')).toBe(false);
    // The seeded concepts are untouched.
    expect((await db.doc('concepts/seed_yoga').get()).get('n')).toBe(1);
    expect((await db.doc('concepts/seed_kirkegaenger').get()).get('n')).toBe(1);
    expect(await db.collection('conceptLinks').get().then((s) => s.size)).toBe(0);
  });

  it('sensitive concepts merge only above their own threshold and otherwise go to review', async () => {
    await seedConcept(db, h.stub, 'seed_gravid', 'gravid', { sensitive: true });
    const res = await call('alice', { items: [{ text: 'gravid i uge 20', consent }, { text: 'gravid med tvillinger', consent }, { text: 'ønsker os et barn', consent }] });
    expect(res.results.map((r) => r.status)).toEqual(['added', 'added', 'added']);
    const [merged, proposed, suspected] = await Promise.all(
      res.results.map(async (r) => (await db.doc(`users/alice/sensitiveInterests/${r.interestId}`).get()).data()),
    );
    expect(merged?.conceptId).toBe('seed_gravid');
    expect(proposed?.conceptId).toBe(await newConceptId(hmac, tagKeyFor('gravid med tvillinger', MODEL.modelId), false));
    expect(suspected).toMatchObject({ source: 'model' });

    const queue = (await db.collection('reviewQueue').get()).docs.map((d) => d.data());
    expect(queue).toEqual(
      expect.arrayContaining([
        { kind: 'conceptMerge', ref: `${proposed?.conceptId}__seed_gravid`, text: 'gravid med tvillinger', status: 'open' },
        { kind: 'tagSensitivity', ref: tagKeyFor('ønsker os et barn', MODEL.modelId), text: 'ønsker os et barn', status: 'open' },
      ]),
    );
    expect(queue).toHaveLength(2);
    expect(JSON.stringify(queue)).not.toContain('alice');
  });

  it('re-plans once from Firestore when a cached tag changed underneath', async () => {
    await call('alice', { items: [{ text: 'løb' }] });
    const key = tagKeyFor('løb', MODEL.modelId);
    const conceptId = (await db.doc(`tags/${key}`).get()).get('conceptId') as string;
    // As if alice's removal had garbage-collected the tag and its concept, while this instance still caches it.
    await db.doc(`tags/${key}`).delete();
    await db.doc(`concepts/${conceptId}`).delete();
    expect(h.lru.peek(key)?.conceptId).toBe(conceptId);

    const res = await call('bob', { items: [{ text: 'løb' }] });
    expect(res.results[0]?.status).toBe('added');
    const tag = (await db.doc(`tags/${key}`).get()).data();
    expect(tag).toMatchObject({ refCount: 1, conceptId });
    expect((await db.doc(`concepts/${conceptId}`).get()).get('n')).toBe(1);
    h.metrics.flush();
    expect(h.entries.at(-1)?.values.stalePlanRetries).toBe(1);
  });

  it('a self-flagged ordinary tag lands in the sensitive partition and never feeds ordinary data', async () => {
    const tagKey = tagKeyFor('board games', MODEL.modelId);
    const privateConcept = await newConceptId(hmac, tagKey, true);
    const a = await call('alice', { items: [{ text: 'Board games', selfFlag: true, consent }] });
    expect(a.results[0]?.status).toBe('added');
    const holding = (await db.doc(`users/alice/sensitiveInterests/${a.results[0]?.interestId}`).get()).data();
    expect(holding).toMatchObject({ conceptId: privateConcept, selfFlagged: true, source: 'self' });
    expect((await db.doc(`concepts/${privateConcept}`).get()).data()).toMatchObject({ sensitive: true, labels: {}, holderCount: 0 });
    let tag = (await db.doc(`tags/${tagKey}`).get()).data();
    expect(tag).toMatchObject({ conceptId: null, refCount: 0, privateAssign: { conceptId: privateConcept, refCount: 1 }, langHints: { da: 0, en: 0 } });
    const alice = (await db.doc('matchProfiles/alice').get()).data();
    expect(alice?.secondary).toEqual([]);
    expect(alice?.themes).toEqual([{ c: privateConcept, starred: false, sens: true, consentRef: holding?.consentEventId }]);

    // Another user adds the same text as an ordinary interest: an ordinary concept, A's holding unaffected.
    const b = await call('bob', { items: [{ text: 'board games' }] });
    const bobHolding = (await db.doc(`users/bob/interests/${b.results[0]?.interestId}`).get()).data();
    expect(bobHolding?.conceptId).toBe(await newConceptId(hmac, tagKey, false));
    expect((await db.doc(`concepts/${bobHolding?.conceptId}`).get()).get('sensitive')).toBe(false);
    tag = (await db.doc(`tags/${tagKey}`).get()).data();
    expect(tag).toMatchObject({ conceptId: bobHolding?.conceptId, refCount: 1, privateAssign: { refCount: 1 }, langHints: { en: 1 } });
    expect((await db.doc('matchProfiles/bob').get()).get('secondary')).toEqual([bobHolding?.conceptId]);
    const everything = [...(await dumpAll(db))].filter(([path]) => !path.startsWith('users/alice') && path !== 'matchProfiles/alice' && !path.startsWith('consentEvents/'));
    for (const [, data] of everything) expect(data).not.toContain('alice');
  });

  it('"Keep this private" is a typed stub while the user is in an active pod, and changes nothing', async () => {
    const first = await call('alice', { items: [{ text: 'board games' }] });
    await db.doc('pods/p1').set({ state: 'planning', memberUids: ['alice'] });
    const before = await dumpAll(db);
    await expect(call('alice', { items: [{ text: 'board games', selfFlag: true, consent }] })).rejects.toMatchObject({
      code: 'unimplemented',
      details: { code: 'NOT_IMPLEMENTED', design: '§10.2' },
    });
    expect(changedPaths(before, await dumpAll(db))).toEqual([rateLimitDoc('alice')]);
    expect((await db.doc(`users/alice/interests/${first.results[0]?.interestId}`).get()).exists).toBe(true);
  });

  it('"Keep this private" moves an existing ordinary holding into the sensitive partition', async () => {
    const tagKey = tagKeyFor('board games', MODEL.modelId);
    await call('bob', { items: [{ text: 'board games' }] });
    const first = await call('alice', { items: [{ text: 'board games' }] });
    const id = first.results[0]?.interestId;
    expect((await db.doc(`tags/${tagKey}`).get()).get('refCount')).toBe(2);

    const res = await call('alice', { items: [{ text: 'board games', selfFlag: true, consent }] });
    expect(res.results).toEqual([{ status: 'madePrivate', interestId: id }]);
    expect((await db.doc(`users/alice/interests/${id}`).get()).exists).toBe(false);
    const moved = (await db.doc(`users/alice/sensitiveInterests/${id}`).get()).data();
    expect(moved).toMatchObject({ conceptId: await newConceptId(hmac, tagKey, true), selfFlagged: true });
    expect((await db.doc(`tags/${tagKey}`).get()).data()).toMatchObject({ refCount: 1, privateAssign: { refCount: 1 } });
    const profile = (await db.doc('matchProfiles/alice').get()).data();
    expect(profile?.secondary).toEqual([]);
    expect(profile?.themes).toMatchObject([{ c: await newConceptId(hmac, tagKey, true), sens: true }]);
    expect((await db.doc('users/alice').get()).get('interestCount')).toBe(1);
  });

  it('refuses a sensitive tag about a third party, and warns on an ordinary one', async () => {
    const before = await dumpAll(db);
    const res = await call('alice', { items: [{ text: 'min datters diabetes', consent }] });
    expect(res.results).toEqual([{ status: 'rejected', reasonCode: 'THIRD_PARTY_SENSITIVE' }]);
    expect(changedPaths(before, await dumpAll(db))).toEqual([rateLimitDoc('alice')]);
    expect(h.stub.calls).toHaveLength(0);

    const ok = await call('alice', { items: [{ text: 'min datters fodbold' }] });
    expect(ok.results[0]).toMatchObject({ status: 'added', warning: 'THIRD_PARTY' });
    expect((await db.collection('users/alice/interests').get()).size).toBe(1);
  });

  it('answers duplicates, the interest limit and the weekly sensitive limit without writing', async () => {
    const res = await call('alice', { items: [{ text: 'løb' }, { text: 'LØB!' }] });
    expect(res.results.map((r) => r.status)).toEqual(['added', 'duplicate']);
    expect((await call('alice', { items: [{ text: 'løb' }] })).results[0]?.status).toBe('duplicate');

    for (let i = 0; i < 3; i++) {
      await db.collection('consentEvents').add({ uid: 'bob', scope: 'art9', action: 'grant', createdAt: Timestamp.fromDate(new Date('2026-11-02T00:00:00Z')) });
    }
    const limited = await call('bob', { items: [{ text: 'gravid', consent }] });
    expect(limited.results).toEqual([{ status: 'limit', reasonCode: 'SENSITIVE_ADD_LIMIT' }]);
    expect((await db.collection('users/bob/sensitiveInterests').get()).size).toBe(0);

    const batch = db.batch();
    for (let i = 0; i < 20; i++) batch.set(db.doc(`users/carol/interests/i${i}`), { norm: `x${i}` });
    await batch.commit();
    await seedUser(db, 'carol');
    expect((await call('carol', { items: [{ text: 'løb' }] })).results).toEqual([{ status: 'limit', reasonCode: 'INTEREST_LIMIT' }]);
  });

  it('rejects new texts over the daily embed budget while cached texts still work', async () => {
    await call('alice', { items: [{ text: 'løb' }] });
    const tight = await harness(db, { budget: false });
    const handler = createAddInterestsHandler(tight.metrics, () => tight.deps);
    const res = await handler(callRequest('bob', { items: [{ text: 'løb' }, { text: 'cooking' }] }));
    expect(res.results).toEqual([
      { status: 'added', interestId: await interestId(hmac, 'bob', 'løb') },
      { status: 'rejected', reasonCode: 'EMBED_BUDGET' },
    ]);
    expect(tight.stub.calls).toHaveLength(0);
  });

  it('warm-up passes auth, onboarding, the kill switch and the per-uid window before loading the model', async () => {
    await expect(call(null, { items: [] })).rejects.toMatchObject({ code: 'unauthenticated', details: { code: 'UNAUTHENTICATED' } });
    await expect(call('alice', { items: [] }, { appCheck: false })).rejects.toMatchObject({ code: 'unauthenticated', details: { code: 'APP_CHECK' } });
    await expect(call('alice', { items: [] }, { onb: false })).rejects.toMatchObject({ details: { code: 'NOT_ONBOARDED' } });
    expect(h.runtimeLoads).toBe(0);

    await db.doc('config/app').set({ features: { embedder: false, uploads: true } });
    await expect(call('alice', { items: [] })).rejects.toMatchObject({ code: 'unavailable', details: { code: 'FEATURE_DISABLED' } });
    expect(h.runtimeLoads).toBe(0);
    await db.doc('config/app').set({ features: { embedder: true, uploads: true } });

    expect(await call('alice', { items: [] })).toEqual({ results: [] });
    expect(h.runtimeLoads).toBe(1);

    // Accounts younger than 24 h get half the hourly allowance; warm-ups count.
    await seedUser(db, 'newbie', { createdAt: new Date('2026-11-04T08:00:00Z') });
    for (let i = 0; i < 15; i++) await call('newbie', { items: [] });
    const loads = h.runtimeLoads;
    await expect(call('newbie', { items: [] })).rejects.toMatchObject({ code: 'resource-exhausted', details: { code: 'RATE_LIMITED' } });
    expect(h.runtimeLoads).toBe(loads);
  });

  it('rejects malformed input with issue paths only', async () => {
    const out = captureOutput();
    try {
      await expect(call('alice', { items: [{ text: 'Gravid', extra: 'secret-ish' }] })).rejects.toMatchObject({ details: { code: 'VALIDATION' } });
    } finally {
      out.restore();
    }
    expect(out.text()).toContain('"code":"VALIDATION"');
    expect(out.text()).not.toMatch(/gravid|secret-ish|alice/i);
  });
});
