/**
 * addInterests end to end against the Firestore emulator (DESIGN.md §5.2, §13; D1–D3), with deterministic stand-ins
 * for the device's vectors: refusals write nothing and log nothing; the blanket consent decides sensitive holdings;
 * client vectors are trusted but the server repeats the lexicon and the margin; cache keys carry the modelId;
 * partitions never mix; the user's own overrides stay theirs.
 */
import { randomBytes } from 'node:crypto';
import {
  EMBEDDING_MODEL,
  consentProofFor,
  getLaunchArea,
  interestId,
  newConceptId,
  type CallableOutput,
  type Prototypes,
} from '@grouper/core';
import { sha256Hex } from '@grouper/core/node';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { beforeEach, expect, it } from 'vitest';
import { addInterestsWith, type InterestsRuntime } from '../../src/callables/addInterests';
import { setArt9Consent } from '../../src/callables/art9Consent';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { FirestoreConceptIndex } from '../../src/interests/assign';
import { C128_DIM, LIMITS } from '../../src/interests/config';
import { tagKeyFor } from '../../src/interests/tags';
import { fromF32Bytes, toF32Bytes, truncateNormalize } from '../../src/interests/vectors';
import { PATHS } from '../../src/lib/firestore';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { capturedLogs, forbidInLogs } from '../helpers/logCapture';
import { StubVectors } from '../helpers/vectors';

type Output = CallableOutput<'addInterests'>;
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const DAY = 86_400_000;
const MODEL_KEY = EMBEDDING_MODEL.modelKey;

/** Ordinary texts lean on a hobby anchor; sensitive ones on an Art. 9 prototype or the lexicon. Cosines are exact. */
const V = new StubVectors({
  cooking: { to: 'food and drink', cos: 0.9 },
  madlavning: { to: 'cooking', cos: 0.95 },
  'hjemmelavet mad': { to: 'cooking', cos: 0.915 },
  'board games': { to: 'games', cos: 0.9 },
  yoga: { to: 'exercise', cos: 0.9 },
  graviditetsyoga: { to: 'yoga', cos: 0.97 },
  kirkegænger: { to: 'music', cos: 0.9 },
  kirkekor: { to: 'kirkegænger', cos: 0.97 },
  'min datters fodbold': { to: 'sports', cos: 0.9 },
  'ønsker os et barn': { to: 'pregnancy and expecting a baby', cos: 0.95 },
  'gravid i uge 20': { to: 'gravid', cos: 0.96 },
  'gravid med tvillinger': { to: 'gravid', cos: 0.94 },
  løb: { to: 'sports', cos: 0.9 },
  knitting: { to: 'faith and church', cos: 0.9 },
});
const PROTOTYPES: Prototypes = V.prototypes(['pregnancy and expecting a baby', 'gravid', 'faith and church'], ['food and drink', 'games', 'exercise', 'music', 'sports']);
const item = (text: string, extra: Record<string, unknown> = {}) => V.item(text, PROTOTYPES, extra);
const body = (...items: Record<string, unknown>[]) => ({ modelKey: MODEL_KEY, items });

const BLANKET = { ...consentProofFor('art9-blanket-da-v1'), appVersion: '1.2.3', checked: true as const };

describeEmulator('addInterests (emulator)', () => {
  const deps = emulatorDeps(NOW);
  const runtime = (o: Partial<InterestsRuntime> = {}): InterestsRuntime => ({ prototypes: async () => PROTOTYPES, art9Holdings: true, configPath: 'config/none', ...o });
  const call = (uid: string, data: unknown, rt: InterestsRuntime = runtime()): Promise<Output> => invoke('addInterests', addInterestsWith(rt), deps, data, { uid });

  beforeEach(async () => {
    // Only this file writes the shared tag and concept collections, so it may reset them.
    for (const col of ['tags', 'concepts', 'conceptLinks']) await deps.db.recursiveDelete(deps.db.collection(col));
    deps.clock.now = NOW;
  });

  async function onboarded(o: { locale?: 'da' | 'en'; consent?: boolean; ageMs?: number } = {}): Promise<string> {
    const uid = newUid();
    await deps.auth.createUser({ uid });
    const data = { firstName: 'Testa', dob: '1990-05-05', locale: o.locale ?? 'da', area: { gh5: getLaunchArea('aarhus')!.cells[0] }, legal: { terms: 't1', privacy: 'p1' } };
    deps.clock.now = NOW - (o.ageMs ?? 30 * DAY);
    try {
      await invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined } });
      if (o.consent) await invoke('setArt9Consent', setArt9Consent, deps, { consent: BLANKET }, { uid });
    } finally {
      deps.clock.now = NOW;
    }
    return uid;
  }

  async function seedConcept(id: string, text: string, o: { sensitive: boolean; labels?: { da?: string; en?: string }; holderCount?: number }): Promise<Float32Array> {
    const vec = V.vector(text);
    const at = Timestamp.fromMillis(NOW);
    await deps.db.doc(`concepts/${id}`).set({
      centroid: FieldValue.vector(Array.from(vec)),
      medoid: FieldValue.vector(Array.from(vec)),
      sum: toF32Bytes(vec),
      c128: toF32Bytes(truncateNormalize(vec, C128_DIM)),
      n: 1,
      sensitive: o.sensitive,
      labels: o.labels ?? {},
      holderCount: o.holderCount ?? 0,
      status: 'active',
      gen: 0,
      seed: true,
      createdAt: at,
      updatedAt: at,
    });
    return vec;
  }

  /** Every document that can carry this user's data or a tag: their subtree, profile, events, buckets, tags, concepts. */
  async function footprint(uid: string): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const add = (path: string, data: unknown) => out.set(path, JSON.stringify(data));
    for (const ref of [deps.db.doc(`users/${uid}`), deps.db.doc(`matchProfiles/${uid}`)]) {
      const snap = await ref.get();
      if (snap.exists) add(ref.path, snap.data());
      for (const sub of await ref.listCollections()) for (const d of (await sub.get()).docs) add(d.ref.path, d.data());
    }
    for (const d of (await deps.db.collection('consentEvents').where('uid', '==', uid).get()).docs) add(d.ref.path, d.data());
    for (const col of ['tags', 'concepts', 'conceptLinks']) for (const d of (await deps.db.collection(col).get()).docs) add(d.ref.path, d.data());
    for (const b of ['addInterests', 'sensitiveAdds']) {
      const snap = await deps.db.doc(`rateLimits/${uid}_${b}`).get();
      if (snap.exists) add(snap.ref.path, snap.data());
    }
    return out;
  }
  const changed = (a: Map<string, string>, b: Map<string, string>) => [...new Set([...a.keys(), ...b.keys()])].filter((p) => a.get(p) !== b.get(p)).sort();
  const grantId = async (uid: string) => (await deps.db.collection('consentEvents').where('uid', '==', uid).where('action', '==', 'grant').get()).docs[0]!.id;
  const doc = async (path: string) => (await deps.db.doc(path).get()).data();

  it('stores an ordinary tag with the client vector, the modelId in its key, and statuses only in the response', async () => {
    const uid = await onboarded();
    const sent = item('Løb');
    const res = await call(uid, body(sent));
    const id = await interestId(testUidHmac, uid, 'løb');
    expect(res).toEqual({ results: [{ status: 'added', interestId: id, private: false }] });

    const key = sha256Hex(`${MODEL_KEY}|768|sts|løb`);
    expect(tagKeyFor('løb', MODEL_KEY)).toBe(key);
    expect(tagKeyFor('løb', 'eg300m-q4@5090578')).not.toBe(key);
    const tag = await deps.db.doc(`tags/${key}`).get();
    expect(tag.get('modelId')).toBe(MODEL_KEY);
    expect((tag.get('vec') as { toArray(): number[] }).toArray()).toEqual(Array.from(Float32Array.from(sent.vector as number[])));
    expect(tag.get('sens')).toEqual({ sensitive: false, margin: expect.any(Number), lexiconHit: false, knownOrdinary: true, rulesVersion: expect.stringContaining('lexicon-') });
    expect(tag.get('refCount')).toBe(1);
    expect(JSON.stringify(tag.data())).not.toContain(uid);

    const holding = await doc(`users/${uid}/interests/${id}`);
    expect(holding).toMatchObject({ display: 'Løb', norm: 'løb', conceptId: tag.get('conceptId'), starred: false, state: 'active' });
    expect(holding?.notSensitiveForMe).toBeUndefined();
    expect((await doc(`matchProfiles/${uid}`))?.secondary).toEqual([tag.get('conceptId')]);
    expect((await doc(`users/${uid}`))?.interestCount).toBe(1);
    expect(JSON.stringify(res)).not.toMatch(/\[\s*-?\d+(\.\d+)?\s*,/);
  });

  it('refuses a sensitive holding without the blanket consent, writing and logging nothing about it', async () => {
    const uid = await onboarded();
    const texts = ['Gravid i uge 20', 'ønsker os et barn'];
    forbidInLogs(uid, ...texts, 'gravid', 'barn');
    const before = await footprint(uid);
    const res = await call(uid, body(item(texts[0]!), item(texts[1]!), item('board games', { selfFlagPrivate: true })));
    const refused = { status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' };
    expect(res.results).toEqual([refused, refused, refused]);
    // Only the per-call window changed: a counter, no text and no vector.
    expect(changed(before, await footprint(uid))).toEqual([`rateLimits/${uid}_addInterests`]);
    expect(capturedLogs().join('\n')).not.toMatch(/gravid|barn/i);
  });

  it('repeats the lexicon and the margin on the server: a client that understates sensitivity is still refused', async () => {
    const uid = await onboarded();
    const lying = (text: string) => ({ ...item(text), detector: { margin: -1, lexiconHit: false } });
    const res = await call(uid, body(lying('gravid med tvillinger'), lying('ønsker os et barn')));
    expect(res.results.map((r) => r.reasonCode)).toEqual(['ART9_CONSENT_REQUIRED', 'ART9_CONSENT_REQUIRED']);

    // Without prototypes.bin the server has only the client's margin to go on (D1); the lexicon still applies.
    const blind = runtime({ prototypes: async () => null });
    const trusted = await call(uid, body(lying('ønsker os et barn'), lying('gravid med tvillinger')), blind);
    expect(trusted.results[0]).toMatchObject({ status: 'added', private: false });
    expect(trusted.results[1]).toEqual({ status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' });
  });

  it('lets a later honest client raise sensitivity for its own holding when the first writer sent a crafted vector', async () => {
    const attacker = await onboarded();
    const honest = await onboarded({ consent: true });
    const text = 'ønsker os et barn';
    const tagKey = tagKeyFor(text, MODEL_KEY);
    // A vector on an ordinary anchor and a low margin: the server's own margin agrees, so the tag is stored ordinary.
    const crafted = { text, vector: Array.from(V.vector('sports')), detector: { margin: -1, lexiconHit: false } };
    expect((await call(attacker, body(crafted))).results[0]).toMatchObject({ status: 'added', private: false });
    expect((await doc(`tags/${tagKey}`))?.sens).toMatchObject({ sensitive: false });

    const sent = item(text);
    expect((sent.detector as { margin: number }).margin).toBeGreaterThan(EMBEDDING_MODEL.detectorMargin);
    const res = await call(honest, body(sent));
    expect(res.results[0]).toMatchObject({ status: 'added', private: true });
    const id = res.results[0]!.interestId!;
    expect(await doc(`users/${honest}/interests/${id}`)).toBeUndefined();
    expect(await doc(`users/${honest}/sensitiveInterests/${id}`)).toMatchObject({ source: 'model', selfFlagged: false });
    // The tag's own partition is unchanged; the honest holding sits in its private slot and adds no label hint.
    const tag = await doc(`tags/${tagKey}`);
    expect(tag).toMatchObject({ refCount: 1, privateAssign: { conceptId: await newConceptId(testUidHmac, tagKey, true), refCount: 1 }, langHints: { da: 1, en: 0 } });

    // Without the consent the same honest client is refused rather than silently stored as ordinary.
    const noConsent = await onboarded();
    expect((await call(noConsent, body(item(text)))).results[0]).toEqual({ status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' });
  });

  it('stores a sensitive holding under the blanket consent, pointing at its grant event, with no per-tag event', async () => {
    const uid = await onboarded({ consent: true });
    const res = await call(uid, body(item('Gravid i uge 20')));
    const id = await interestId(testUidHmac, uid, 'gravid i uge 20');
    expect(res.results).toEqual([{ status: 'added', interestId: id, private: true }]);

    const grant = await grantId(uid);
    const user = await doc(`users/${uid}`);
    const holding = await doc(`users/${uid}/sensitiveInterests/${id}`);
    expect(holding).toMatchObject({ display: 'Gravid i uge 20', selfFlagged: false, source: 'lexicon', consentEventId: grant, consentTextVersion: 'art9-blanket-da-v1' });
    expect((holding?.consentedAt as Timestamp).isEqual(user?.legal.art9.at)).toBe(true);
    expect(await doc(`users/${uid}/interests/${id}`)).toBeUndefined();
    const events = (await deps.db.collection('consentEvents').where('uid', '==', uid).get()).docs.map((d) => d.data());
    expect(events).toEqual([expect.objectContaining({ scope: 'art9', action: 'grant' })]);
    expect(JSON.stringify(events)).not.toContain(id);

    const tag = await doc(`tags/${tagKeyFor('gravid i uge 20', MODEL_KEY)}`);
    expect(tag).toMatchObject({ refCount: 1, conceptId: holding?.conceptId, sens: { sensitive: true, lexiconHit: true }, langHints: { da: 0, en: 0 } });
    expect(await doc(`concepts/${holding?.conceptId}`)).toMatchObject({ sensitive: true, labels: {}, n: 1 });
    const profile = await doc(`matchProfiles/${uid}`);
    expect(profile?.themes).toEqual([{ c: holding?.conceptId, starred: false, sens: true, consentRef: grant }]);
    expect(profile?.secondary).toEqual([]);
    expect((await deps.db.collection('reviewQueue').limit(1).get()).empty).toBe(true);
  });

  it('refuses every sensitive holding while sensitive holdings are switched off (the production setting)', async () => {
    const uid = await onboarded({ consent: true });
    const gated = runtime({ art9Holdings: undefined });
    const res = await call(uid, body(item('Gravid'), item('ønsker os et barn'), item('board games', { selfFlagPrivate: true }), item('cooking')), gated);
    const unavailable = { status: 'limit', reasonCode: 'SENSITIVE_UNAVAILABLE' };
    expect(res.results.slice(0, 3)).toEqual([unavailable, unavailable, unavailable]);
    expect(res.results[3]).toMatchObject({ status: 'added' });
    expect((await deps.db.collection(`users/${uid}/sensitiveInterests`).get()).size).toBe(0);
    expect((await deps.db.collection('tags').get()).docs.map((d) => d.get('norm'))).toEqual(['cooking']);
    expect((await deps.db.collection('concepts').where('sensitive', '==', true).get()).size).toBe(0);
  });

  it('keeps a known-ordinary hobby word ordinary even when the detector flags it', async () => {
    const uid = await onboarded();
    const sent = item('knitting');
    expect((sent.detector as { margin: number }).margin).toBeGreaterThan(EMBEDDING_MODEL.detectorMargin);
    expect((await call(uid, body(sent))).results[0]).toMatchObject({ status: 'added', private: false });
    expect((await doc(`tags/${tagKeyFor('knitting', MODEL_KEY)}`))?.sens).toMatchObject({ sensitive: false, knownOrdinary: true });
  });

  it('validates the model key and the vector before anything else', async () => {
    const uid = await onboarded();
    const ok = item('løb');
    expect(await errorCode(call(uid, { modelKey: 'eg300m-q4@5090578', items: [ok] }))).toBe('VALIDATION');
    expect(await errorCode(call(uid, body({ ...ok, vector: (ok.vector as number[]).map((x) => x * 2) })))).toBe('VALIDATION');
    expect(await errorCode(call(uid, body({ ...ok, vector: (ok.vector as number[]).slice(1) })))).toBe('VALIDATION');
    expect(await errorCode(call(uid, body({ ...ok, selfFlagPrivate: true, notSensitiveForMe: true })))).toBe('VALIDATION');
    expect(await errorCode(call(uid, { modelKey: MODEL_KEY, items: [] }))).toBe('VALIDATION');
    expect(await deps.db.doc(`rateLimits/${uid}_addInterests`).get().then((s) => s.exists)).toBe(false);
  });

  it('merges into a close ordinary concept and suggests a near one', async () => {
    const uid = await onboarded();
    const cooking = await seedConcept('seed_cooking', 'cooking', { sensitive: false, holderCount: 12, labels: { da: 'madlavning', en: 'cooking' } });
    const res = await call(uid, body(item('Madlavning'), item('hjemmelavet mad')));
    expect(res.results[0]).toMatchObject({ status: 'added' });
    expect(res.results[0]?.suggestion).toBeUndefined();
    expect((await doc(`users/${uid}/interests/${res.results[0]?.interestId}`))?.conceptId).toBe('seed_cooking');
    const concept = await doc('concepts/seed_cooking');
    expect(concept?.n).toBe(2);
    const sum = fromF32Bytes(concept?.sum as Uint8Array, EMBEDDING_MODEL.dim);
    const expected = V.vector('madlavning').map((x, i) => x + cooking[i]!);
    expect(Math.max(...sum.map((x, i) => Math.abs(x - expected[i]!)))).toBeLessThan(1e-6);

    const nearKey = tagKeyFor('hjemmelavet mad', MODEL_KEY);
    const near = await doc(`users/${uid}/interests/${res.results[1]?.interestId}`);
    expect(near?.conceptId).toBe(await newConceptId(testUidHmac, nearKey, false));
    expect(res.results[1]?.suggestion).toEqual({ conceptId: 'seed_cooking', label: 'madlavning' });
    expect(await doc(`conceptLinks/${[near?.conceptId, 'seed_cooking'].sort().join('__')}`)).toMatchObject({ status: 'candidate', votes: 0 });
  });

  it('never merges across sensitivity, and sensitive concepts merge only at their own threshold, without proposals', async () => {
    const uid = await onboarded({ consent: true });
    await seedConcept('seed_yoga', 'yoga', { sensitive: false });
    await seedConcept('seed_kirkegaenger', 'kirkegænger', { sensitive: true });
    await seedConcept('seed_gravid', 'gravid', { sensitive: true });

    const res = await call(uid, body(item('graviditetsyoga'), item('kirkekor'), item('gravid i uge 20'), item('gravid med tvillinger')));
    expect(res.results.map((r) => [r.status, r.private])).toEqual([
      ['added', true],
      ['added', false],
      ['added', true],
      ['added', true],
    ]);
    const [yogaS, kor, merged, near] = await Promise.all(
      res.results.map(async (r, i) => doc(`users/${uid}/${i === 1 ? 'interests' : 'sensitiveInterests'}/${r.interestId}`)),
    );
    // A sensitive tag at cos 0.97 to an ordinary concept, and an ordinary one at 0.97 to a sensitive concept: new concepts.
    expect(yogaS?.conceptId).not.toBe('seed_yoga');
    expect((await doc(`concepts/${yogaS?.conceptId}`))?.sensitive).toBe(true);
    expect(kor?.conceptId).not.toBe('seed_kirkegaenger');
    expect((await doc(`concepts/${kor?.conceptId}`))?.sensitive).toBe(false);
    // 0.96 ≥ the sensitive merge threshold; 0.94 is below it and simply becomes a new concept (D2: no merge proposal).
    expect(merged?.conceptId).toBe('seed_gravid');
    expect(near?.conceptId).toBe(await newConceptId(testUidHmac, tagKeyFor('gravid med tvillinger', MODEL_KEY), false));
    expect((await doc('concepts/seed_yoga'))?.n).toBe(1);
    expect((await doc('concepts/seed_kirkegaenger'))?.n).toBe(1);
    expect((await deps.db.collection('conceptLinks').get()).size).toBe(0);
    expect((await deps.db.collection('reviewQueue').limit(1).get()).empty).toBe(true);
  });

  it('re-plans once when another request stores the same new text between planning and the transaction', async () => {
    const [ada, bo] = [await onboarded(), await onboarded()];
    let raced = false;
    const racing = runtime({
      conceptIndex: (d) => {
        const real = new FirestoreConceptIndex(d.db, EMBEDDING_MODEL.dim);
        return {
          nearest: async (partition, vec) => {
            if (!raced) {
              raced = true;
              await call(bo, body(item('cooking')));
            }
            return real.nearest(partition, vec);
          },
        };
      },
    });
    const res = await call(ada, body(item('cooking')), racing);
    expect(res.results[0]).toMatchObject({ status: 'added' });
    const tag = await doc(`tags/${tagKeyFor('cooking', MODEL_KEY)}`);
    expect(tag).toMatchObject({ refCount: 2 });
    expect((await doc(`users/${ada}/interests/${res.results[0]?.interestId}`))?.conceptId).toBe(tag?.conceptId);
    expect((await doc(`concepts/${tag?.conceptId}`))?.n).toBe(1);
  });

  it('"Keep this private" puts an ordinary tag into the sensitive partition for that holding only', async () => {
    const ada = await onboarded({ consent: true });
    const bo = await onboarded({ locale: 'en' });
    const tagKey = tagKeyFor('board games', MODEL_KEY);
    const privateConcept = await newConceptId(testUidHmac, tagKey, true);
    const a = await call(ada, body(item('Board games', { selfFlagPrivate: true })));
    expect(a.results[0]).toMatchObject({ status: 'added', private: true });
    expect(await doc(`users/${ada}/sensitiveInterests/${a.results[0]?.interestId}`)).toMatchObject({ conceptId: privateConcept, selfFlagged: true, source: 'self' });
    expect(await doc(`tags/${tagKey}`)).toMatchObject({ conceptId: null, refCount: 0, privateAssign: { conceptId: privateConcept, refCount: 1 }, langHints: { da: 0, en: 0 } });

    const b = await call(bo, body(item('board games')));
    const boHolding = await doc(`users/${bo}/interests/${b.results[0]?.interestId}`);
    expect(boHolding?.conceptId).toBe(await newConceptId(testUidHmac, tagKey, false));
    expect(await doc(`tags/${tagKey}`)).toMatchObject({ conceptId: boHolding?.conceptId, refCount: 1, privateAssign: { refCount: 1 }, langHints: { en: 1 } });
  });

  it('"Keep this private" and "This isn\'t sensitive for me" move an existing holding between partitions', async () => {
    const uid = await onboarded({ consent: true });
    const other = await onboarded();
    const tagKey = tagKeyFor('board games', MODEL_KEY);
    await call(other, body(item('board games')));
    const first = await call(uid, body(item('board games')));
    const id = first.results[0]?.interestId;
    expect((await call(uid, body(item('board games')))).results).toEqual([{ status: 'duplicate', interestId: id }]);

    const priv = await call(uid, body(item('board games', { selfFlagPrivate: true })));
    expect(priv.results).toEqual([{ status: 'madePrivate', interestId: id, private: true }]);
    expect(await doc(`users/${uid}/interests/${id}`)).toBeUndefined();
    expect(await doc(`users/${uid}/sensitiveInterests/${id}`)).toMatchObject({ conceptId: await newConceptId(testUidHmac, tagKey, true), selfFlagged: true });
    expect(await doc(`tags/${tagKey}`)).toMatchObject({ refCount: 1, privateAssign: { refCount: 1 } });
    expect((await doc(`matchProfiles/${uid}`))?.secondary).toEqual([]);

    const back = await call(uid, body(item('board games', { notSensitiveForMe: true })));
    expect(back.results).toEqual([{ status: 'madeOrdinary', interestId: id, private: false }]);
    expect(await doc(`users/${uid}/sensitiveInterests/${id}`)).toBeUndefined();
    expect(await doc(`users/${uid}/interests/${id}`)).toMatchObject({ conceptId: await newConceptId(testUidHmac, tagKey, false) });
    const tag = await doc(`tags/${tagKey}`);
    expect(tag?.refCount).toBe(2);
    expect(tag?.privateAssign).toBeUndefined();
    // The private concept lost its only member and is gone.
    expect(await doc(`concepts/${await newConceptId(testUidHmac, tagKey, true)}`)).toBeUndefined();
    expect((await doc(`users/${uid}`))?.interestCount).toBe(1);
  });

  it('"This isn\'t sensitive for me" keeps a sensitive tag ordinary for that user only, never for a third party', async () => {
    const uid = await onboarded();
    const res = await call(uid, body(item('ønsker os et barn', { notSensitiveForMe: true }), item('min datters diabetes', { notSensitiveForMe: true })));
    expect(res.results[0]).toMatchObject({ status: 'added', private: false });
    expect(res.results[1]).toEqual({ status: 'rejected', reasonCode: 'THIRD_PARTY_SENSITIVE' });

    const tagKey = tagKeyFor('ønsker os et barn', MODEL_KEY);
    const holding = await doc(`users/${uid}/interests/${res.results[0]?.interestId}`);
    const overrideConcept = await newConceptId(testUidHmac, sha256Hex(`ordinaryAssign|${tagKey}`), false);
    expect(holding).toMatchObject({ notSensitiveForMe: true, conceptId: overrideConcept });
    // The tag stays sensitive for everyone else, and a sensitive text never feeds labels.
    expect(await doc(`tags/${tagKey}`)).toMatchObject({ sens: { sensitive: true }, conceptId: null, refCount: 0, ordinaryAssign: { conceptId: overrideConcept, refCount: 1 }, langHints: { da: 0, en: 0 } });
    expect((await doc(`concepts/${overrideConcept}`))?.sensitive).toBe(false);

    const other = await onboarded();
    expect((await call(other, body(item('ønsker os et barn')))).results[0]).toEqual({ status: 'rejected', reasonCode: 'ART9_CONSENT_REQUIRED' });
  });

  it('moving a holding is a typed stub while the user is in an active pod, and changes nothing', async () => {
    const uid = await onboarded({ consent: true });
    const first = await call(uid, body(item('board games')));
    await deps.db.doc(`pods/p_${randomBytes(6).toString('hex')}`).set({ state: 'planning', memberUids: [uid] });
    const before = await footprint(uid);
    const e = await call(uid, body(item('board games', { selfFlagPrivate: true }))).catch((err: unknown) => err as { code: string; details: unknown });
    expect(e).toMatchObject({ code: 'unimplemented', details: { code: 'NOT_IMPLEMENTED', design: '§10.2' } });
    expect(changed(before, await footprint(uid))).toEqual([`rateLimits/${uid}_addInterests`]);
    expect(await doc(`users/${uid}/interests/${first.results[0]?.interestId}`)).toBeDefined();
  });

  it('refuses a sensitive tag about a third party, and warns on an ordinary one', async () => {
    const uid = await onboarded({ consent: true });
    const res = await call(uid, body(item('min datters diabetes'), item('min datters fodbold')));
    expect(res.results[0]).toEqual({ status: 'rejected', reasonCode: 'THIRD_PARTY_SENSITIVE' });
    expect(res.results[1]).toMatchObject({ status: 'added', warning: 'THIRD_PARTY', private: false });
    expect((await deps.db.collection(`users/${uid}/sensitiveInterests`).get()).size).toBe(0);
  });

  it('answers duplicates, the interest limit and the weekly sensitive limit without writing', async () => {
    const uid = await onboarded({ consent: true });
    expect((await call(uid, body(item('løb'), item('LØB!')))).results.map((r) => r.status)).toEqual(['added', 'duplicate']);

    await deps.db.doc(`rateLimits/${uid}_sensitiveAdds`).set({ count: LIMITS.sensitiveAddsPer7Days, windowStart: Timestamp.fromMillis(NOW - 2 * DAY), expiresAt: Timestamp.fromMillis(NOW + 5 * DAY) });
    expect((await call(uid, body(item('gravid')))).results).toEqual([{ status: 'limit', reasonCode: 'SENSITIVE_ADD_LIMIT' }]);
    expect((await deps.db.collection(`users/${uid}/sensitiveInterests`).get()).size).toBe(0);
    deps.clock.now = NOW + 6 * DAY;
    expect((await call(uid, body(item('gravid')))).results[0]).toMatchObject({ status: 'added', private: true });
    expect(await doc(`rateLimits/${uid}_sensitiveAdds`)).toMatchObject({ count: 1, windowStart: Timestamp.fromMillis(NOW + 6 * DAY), expiresAt: Timestamp.fromMillis(NOW + 13 * DAY) });

    const full = await onboarded();
    const batch = deps.db.batch();
    for (let i = 0; i < LIMITS.maxInterests; i++) batch.set(deps.db.doc(`users/${full}/interests/i${i}`), { norm: `x${i}` });
    await batch.commit();
    expect((await call(full, body(item('løb')))).results).toEqual([{ status: 'limit', reasonCode: 'INTEREST_LIMIT' }]);
  });

  it('checks the kill switch, the account state and the per-uid window before the pipeline', async () => {
    const uid = await onboarded();
    const configPath = `config/addInterestsTest_${randomBytes(4).toString('hex')}`;
    await deps.db.doc(configPath).set({ features: { interests: false, uploads: true } });
    expect(await errorCode(call(uid, body(item('løb')), runtime({ configPath })))).toBe('FEATURE_DISABLED');
    await deps.db.doc(configPath).set({ features: { interests: true, uploads: true } });
    await expect(call(uid, body(item('løb')), runtime({ configPath }))).resolves.toHaveProperty('results');

    for (const status of ['deleting', 'suspended'] as const) {
      const zed = await onboarded();
      await deps.db.doc(PATHS.user(zed)).update({ status });
      const before = await footprint(zed);
      expect(await errorCode(call(zed, body(item('cooking'))))).toBe('STATE');
      expect(changed(before, await footprint(zed)), status).toEqual([]);
    }

    // Accounts younger than 24 h get half the hourly allowance.
    const newbie = await onboarded({ ageMs: 3_600_000 });
    for (let i = 0; i < LIMITS.callsPerHour / 2; i++) await call(newbie, body(item('løb')));
    expect(await errorCode(call(newbie, body(item('cooking'))))).toBe('RATE_LIMITED');
    expect(await doc(`users/${newbie}/interests/${await interestId(testUidHmac, newbie, 'cooking')}`)).toBeUndefined();
  });
});
