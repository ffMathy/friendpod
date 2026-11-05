/**
 * firestore.rules (DESIGN.md §9): owner-only reads under users/{uid}, pods, options and meetup-chat messages for
 * confirmed members with the `onb` claim, areas for onboarded users, config/app for anyone, everything else
 * server-only, and no client writes anywhere.
 */
import { assertFails, assertSucceeds, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { onboarded, rulesEnv, user } from './env';

const ALICE = 'aliceUid0000000000000000000a';
const BOB = 'bobUid000000000000000000000b';
const CAROL = 'carolUid00000000000000000000';
const MALLORY = 'malloryUid000000000000000000';
const WEEK = '2026-W45';
const AT = new Date('2026-11-05T17:00:00Z');

type Data = Record<string, unknown>;

/** Every client-readable document under users/{uid} (§8.1). */
const ownerDocs = (uid: string, other: string): Record<string, Data> => ({
  // "About me" (D4) lives on the users doc, so only its owner reads it there.
  [`users/${uid}`]: { firstName: 'Ada', locale: 'da', status: 'active', aboutMe: 'Ny i byen, glad for brætspil', createdAt: AT },
  [`users/${uid}/interests/int1`]: { display: 'Bouldering', norm: 'bouldering', conceptId: 'c1', starred: true, state: 'active' },
  [`users/${uid}/sensitiveInterests/sen1`]: { display: 'Theme', norm: 'theme', conceptId: 'c9', selfFlagged: false, source: 'lexicon' },
  [`users/${uid}/pods/p1`]: { state: 'confirmed', myStatus: 'accepted', themeLabel: 'Bouldering', themeSensitive: false },
  [`users/${uid}/blocks/${other}`]: { firstName: 'Bo', podId: 'p1', since: AT },
  [`users/${uid}/notices/n1`]: { type: 'system', code: 'EXPORT_READY', params: {}, createdAt: AT, expiresAt: AT },
  [`users/${uid}/exports/e1`]: { status: 'ready', expiresAt: AT },
});

/** A Google Places pick (D8); the rules do not look inside it. */
const place = (name: string): Data => ({ placeId: `ChIJ${name}0000000`, name, address: 'Aarhus C', lat: 56.1567, lng: 10.2108, type: 'cafe', mapUrl: 'https://www.google.com/maps/search/?api=1' });

const POD_DOCS: Record<string, Data> = {
  // The roster carries each confirmed member's "about me" (D4): pods are readable through memberUids only.
  'pods/p1': { state: 'confirmed', weekId: WEEK, memberUids: [ALICE, BOB], roster: { [ALICE]: { firstName: 'Ada', photoV: 1, aboutMe: 'Ny i byen' } } },
  'pods/p1/options/o1': { authorUid: BOB, startsAt: AT, place: place('Librarycafe'), votes: { [BOB]: 'yes' } },
  'pods/p2': { state: 'confirmed', weekId: WEEK, memberUids: [BOB, CAROL] },
  'pods/p1/messages/m1': { authorUid: BOB, text: 'Running 5 minutes late', createdAt: AT, expiresAt: AT },
  'pods/p1/messages/m2': { authorUid: ALICE, text: "I'm here", createdAt: AT, expiresAt: AT },
  'pods/p2/options/o2': { authorUid: CAROL, startsAt: AT, place: place('Park'), votes: {} },
  'pods/p2/messages/m3': { authorUid: CAROL, text: 'At the gate', createdAt: AT, expiresAt: AT },
  // Mutated by the removal test only.
  'pods/p3': { state: 'scheduled', weekId: WEEK, memberUids: [ALICE, CAROL] },
  'pods/p3/options/o3': { authorUid: CAROL, startsAt: AT, place: place('Harbour'), votes: {} },
  'pods/p3/messages/m4': { authorUid: CAROL, text: 'On my way', createdAt: AT, expiresAt: AT },
};

const PUBLICISH_DOCS: Record<string, Data> = {
  'areas/aarhus': { label: 'Aarhus', status: 'waitlist', chips: [] },
  // A new launch city with the waitlist counter (§3.1 step 12).
  'areas/vejle': { label: { da: 'Vejle', en: 'Vejle' }, status: 'waitlist', waitlistCount: 12, goal: { waitlist: 250 }, chips: [] },
  'config/app': { minAppVersion: '0.1.0', features: { interests: true, uploads: true } },
  'config/internal': { note: 'not public' },
};

/** Server-only collections (§8.2). Doc ids include Alice's uid where the real ids do. */
const SERVER_ONLY_DOCS: Record<string, Data> = {
  [`matchProfiles/${ALICE}`]: { status: 'active', themeIds: ['c1'], blockedH: [] },
  'tags/t1': { norm: 'bouldering', refCount: 1 },
  'concepts/c1': { sensitive: false, status: 'active', n: 1 },
  'conceptLinks/c1__c2': { cos: 0.91, status: 'candidate' },
  'podState/p1': { weekId: WEEK, state: 'confirmed', memberList: [ALICE, BOB] },
  [`podFeedback/p1_${ALICE}`]: { met: true, keep: true },
  [`drops/${WEEK}`]: { status: 'released', mondayNudgeAt: AT },
  [`drops/${WEEK}/components/c0`]: { status: 'computed' },
  'consentEvents/ev1': { uid: ALICE, scope: 'art9', action: 'grant', createdAt: AT },
  [`blocks/${ALICE}_${BOB}`]: { blocker: ALICE, blocked: BOB, podId: 'p1', createdAt: AT },
  'reports/r1': { reporterUid: ALICE, targetUid: BOB, podId: 'p1', category: 'other', expiresAt: AT },
  [`sanctions/${ALICE}`]: { type: 'pause', reasonCode: 'SAFETY_REPORT' },
  'bans/emailHash1': { reasonCode: 'UNDERAGE', createdAt: AT, expiresAt: AT },
  // Meet-again answers of a pair (D9): never shown to either member.
  'pairSignals/pk0123456789abcdef0123456789abcd': { uidHs: ['uidhashA', 'uidhashB'], answers: { uidhashA: true }, meetWeek: WEEK, updatedAt: AT },
  [`photoGrants/${ALICE}_${BOB}`]: { pods: ['p1'], createdAt: AT },
  [`pushTokens/${ALICE}`]: { tokens: [] },
  [`rateLimits/${ALICE}_addInterests`]: { count: 1, windowStart: AT, expiresAt: AT },
  [`rateLimits/${ALICE}_sensitiveAdds`]: { count: 1, windowStart: AT, expiresAt: AT },
  [`rateLimits/${ALICE}_addInterestItems`]: { count: 10, windowStart: AT, expiresAt: AT },
  [`rateLimits/${ALICE}_report`]: { count: 1, windowStart: AT, expiresAt: AT },
  [`rateLimits/${ALICE}_photoUploads`]: { count: 1, windowStart: AT, expiresAt: AT },
  // Admin CLI run records (§8.2 adminRuns): who ran what and why; no client reads them.
  'adminRuns/run1': { command: 'areas list', reason: 'check', actor: 'admin@example.test', outcome: 'read', at: AT, expiresAt: AT },
  'erasureLedger/l1': { uidH: 'uidhash', kind: 'interest', at: AT, expiresAt: AT },
  'underageMarkers/emailHash2': { createdAt: AT, expiresAt: AT },
  // Day-1 funnel counters (§6.8): uid-free, but only the admin CLI reads them (and suppresses cells under 10).
  [`funnel/aarhus_${WEEK}`]: { areaId: 'aarhus', weekId: WEEK, counts: { signup: 12, onboarded: 11 }, sources: { friend: 3 }, expiresAt: AT },
  [`funnel/none_${WEEK}`]: { areaId: 'none', weekId: WEEK, counts: { signup: 2 }, expiresAt: AT },
};

const UNKNOWN_DOCS: Record<string, Data> = { 'misc/doc1': { x: 1 } };

const ALL_DOCS: Record<string, Data> = {
  ...ownerDocs(ALICE, BOB),
  ...ownerDocs(BOB, ALICE),
  ...POD_DOCS,
  ...PUBLICISH_DOCS,
  ...SERVER_ONLY_DOCS,
  ...UNKNOWN_DOCS,
};

const parentOf = (path: string): string => path.slice(0, path.lastIndexOf('/'));
const lastId = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

let env: RulesTestEnvironment;
let anon: RulesTestContext;
let alice: RulesTestContext; // signed in, not onboarded
let aliceOnb: RulesTestContext;
let bobOnb: RulesTestContext;
let malloryOnb: RulesTestContext;

beforeAll(async () => {
  env = await rulesEnv();
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (admin) => {
    const db = admin.firestore();
    await Promise.all(Object.entries(ALL_DOCS).map(([path, data]) => db.doc(path).set(data)));
  });
  anon = env.unauthenticatedContext();
  alice = user(env, ALICE);
  aliceOnb = onboarded(env, ALICE);
  bobOnb = onboarded(env, BOB);
  malloryOnb = onboarded(env, MALLORY);
});

afterAll(async () => {
  await env?.clearFirestore();
  await env?.cleanup();
});

const get = (ctx: RulesTestContext, path: string) => ctx.firestore().doc(path).get();
const list = (ctx: RulesTestContext, collectionPath: string) => ctx.firestore().collection(collectionPath).get();

describe('users/{uid}/** is readable by its owner only', () => {
  for (const path of Object.keys(ownerDocs(ALICE, BOB))) {
    it(`${path.replace(ALICE, '{alice}')}`, async () => {
      await assertSucceeds(get(alice, path)); // the owner does not need the onb claim (onboarding reads)
      await assertSucceeds(get(aliceOnb, path));
      await assertFails(get(bobOnb, path));
      await assertFails(get(anon, path));
    });
  }

  for (const sub of ['interests', 'sensitiveInterests', 'pods', 'blocks', 'notices', 'exports']) {
    it(`lists users/{alice}/${sub} only as Alice`, async () => {
      await assertSucceeds(list(alice, `users/${ALICE}/${sub}`));
      await assertFails(list(bobOnb, `users/${ALICE}/${sub}`));
      await assertFails(list(anon, `users/${ALICE}/${sub}`));
    });
  }

  it('denies listing the users collection', async () => {
    await assertFails(list(aliceOnb, 'users'));
  });

  for (const group of ['interests', 'sensitiveInterests', 'pods', 'blocks']) {
    it(`denies collection-group queries on ${group}`, async () => {
      await assertFails(aliceOnb.firestore().collectionGroup(group).get());
    });
  }
});

describe('pods/{podId} is readable by current members with the onb claim', () => {
  it('allows a member with onb', async () => {
    await assertSucceeds(get(aliceOnb, 'pods/p1'));
    await assertSucceeds(get(bobOnb, 'pods/p1'));
  });

  it('denies a member without onb, or with a non-boolean onb', async () => {
    await assertFails(get(alice, 'pods/p1'));
    await assertFails(get(user(env, ALICE, { onb: 'true' }), 'pods/p1'));
    await assertFails(get(user(env, ALICE, { onb: 1 }), 'pods/p1'));
    await assertFails(get(user(env, ALICE, { onb: false }), 'pods/p1'));
  });

  it('denies non-members and unauthenticated clients', async () => {
    await assertFails(get(malloryOnb, 'pods/p1'));
    await assertFails(get(aliceOnb, 'pods/p2'));
    await assertFails(get(anon, 'pods/p1'));
  });

  it('denies a pod that does not exist', async () => {
    await assertFails(get(aliceOnb, 'pods/missing'));
  });

  it('allows only queries constrained to the caller as a member', async () => {
    const pods = aliceOnb.firestore().collection('pods');
    await assertSucceeds(pods.where('memberUids', 'array-contains', ALICE).get());
    await assertFails(pods.where('memberUids', 'array-contains', BOB).get());
    await assertFails(pods.get());
    await assertFails(alice.firestore().collection('pods').where('memberUids', 'array-contains', ALICE).get());
  });
});

describe('pods/{podId}/options are readable by pod members with the onb claim', () => {
  it('allows members', async () => {
    await assertSucceeds(get(aliceOnb, 'pods/p1/options/o1'));
    await assertSucceeds(list(aliceOnb, 'pods/p1/options'));
  });

  it('denies non-members, members without onb and unauthenticated clients', async () => {
    await assertFails(get(malloryOnb, 'pods/p1/options/o1'));
    await assertFails(list(malloryOnb, 'pods/p1/options'));
    await assertFails(get(aliceOnb, 'pods/p2/options/o2'));
    await assertFails(list(aliceOnb, 'pods/p2/options'));
    await assertFails(get(alice, 'pods/p1/options/o1'));
    await assertFails(get(anon, 'pods/p1/options/o1'));
  });

  it('denies options of a pod that does not exist', async () => {
    await assertFails(list(aliceOnb, 'pods/missing/options'));
  });

  it('denies collection-group queries on options', async () => {
    await assertFails(aliceOnb.firestore().collectionGroup('options').get());
  });
});

describe('pods/{podId}/messages (meetup chat) are readable by pod members with the onb claim', () => {
  it('allows members to get and list, whoever wrote the message', async () => {
    await assertSucceeds(get(aliceOnb, 'pods/p1/messages/m1'));
    await assertSucceeds(get(bobOnb, 'pods/p1/messages/m2'));
    await assertSucceeds(list(aliceOnb, 'pods/p1/messages'));
    await assertSucceeds(aliceOnb.firestore().collection('pods/p1/messages').orderBy('createdAt').get());
  });

  it('denies non-members, members without onb and unauthenticated clients', async () => {
    await assertFails(get(malloryOnb, 'pods/p1/messages/m1'));
    await assertFails(list(malloryOnb, 'pods/p1/messages'));
    await assertFails(get(aliceOnb, 'pods/p2/messages/m3'));
    await assertFails(list(aliceOnb, 'pods/p2/messages'));
    await assertFails(get(alice, 'pods/p1/messages/m1'));
    await assertFails(list(alice, 'pods/p1/messages'));
    await assertFails(get(user(env, ALICE, { onb: 'true' }), 'pods/p1/messages/m1'));
    await assertFails(get(anon, 'pods/p1/messages/m1'));
    await assertFails(list(anon, 'pods/p1/messages'));
  });

  it('denies messages of a pod that does not exist', async () => {
    await assertFails(list(aliceOnb, 'pods/missing/messages'));
    await assertFails(get(aliceOnb, 'pods/missing/messages/m1'));
  });

  it('denies collection-group queries on messages', async () => {
    await assertFails(aliceOnb.firestore().collectionGroup('messages').get());
    await assertFails(aliceOnb.firestore().collectionGroup('messages').where('authorUid', '==', ALICE).get());
  });
});

describe('a member removed from memberUids (block, leave, withdrawal) loses options and messages at once', () => {
  it('denies the removed member and keeps the others', async () => {
    await assertSucceeds(get(aliceOnb, 'pods/p3/messages/m4'));
    await assertSucceeds(get(aliceOnb, 'pods/p3/options/o3'));
    await env.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc('pods/p3').update({ memberUids: [CAROL] });
    });
    const carolOnb = onboarded(env, CAROL);
    for (const path of ['pods/p3', 'pods/p3/messages/m4', 'pods/p3/options/o3']) {
      await assertFails(get(aliceOnb, path));
      await assertSucceeds(get(carolOnb, path));
    }
    await assertFails(list(aliceOnb, 'pods/p3/messages'));
  });
});

describe('areas require the onb claim', () => {
  it('allows onboarded users to get and list', async () => {
    await assertSucceeds(get(aliceOnb, 'areas/aarhus'));
    await assertSucceeds(get(aliceOnb, 'areas/vejle'));
    await assertSucceeds(get(bobOnb, 'areas/vejle'));
    await assertSucceeds(list(aliceOnb, 'areas'));
  });

  it('denies users without onb and unauthenticated clients', async () => {
    await assertFails(get(alice, 'areas/aarhus'));
    await assertFails(list(alice, 'areas'));
    await assertFails(get(anon, 'areas/aarhus'));
    await assertFails(get(alice, 'areas/vejle'));
    await assertFails(get(anon, 'areas/vejle'));
  });
});

describe('config: only config/app is public', () => {
  it('allows anyone to read config/app', async () => {
    await assertSucceeds(get(anon, 'config/app'));
    await assertSucceeds(get(aliceOnb, 'config/app'));
  });

  it('denies other config docs and listing', async () => {
    await assertFails(get(anon, 'config/internal'));
    await assertFails(get(aliceOnb, 'config/internal'));
    await assertFails(list(anon, 'config'));
  });
});

describe('server-only collections are unreadable by any client', () => {
  for (const path of [...Object.keys(SERVER_ONLY_DOCS), ...Object.keys(UNKNOWN_DOCS)]) {
    it(`${path.replaceAll(ALICE, '{alice}').replaceAll(BOB, '{bob}')}`, async () => {
      for (const ctx of [anon, alice, aliceOnb, bobOnb]) {
        await assertFails(get(ctx, path));
        await assertFails(list(ctx, parentOf(path)));
      }
    });
  }
});

describe('clients cannot write anywhere', () => {
  // Alice is the most privileged client there is: owner of users/{alice}, member of p1, onboarded.
  for (const path of Object.keys(ALL_DOCS)) {
    it(`${path.replaceAll(ALICE, '{alice}').replaceAll(BOB, '{bob}')}`, async () => {
      const db = aliceOnb.firestore();
      const created = `${parentOf(path)}/new-${lastId(path)}`;
      await assertFails(db.doc(created).set({ x: 1 }));
      await assertFails(db.doc(path).set({ x: 1 }));
      await assertFails(db.doc(path).set({ x: 1 }, { merge: true }));
      await assertFails(db.doc(path).update({ x: 1 }));
      await assertFails(db.doc(path).delete());
      await assertFails(anon.firestore().doc(created).set({ x: 1 }));
    });
  }

  it('denies batched writes and transactions', async () => {
    const db = aliceOnb.firestore();
    const batch = db.batch();
    batch.set(db.doc(`users/${ALICE}/interests/batched`), { display: 'x' });
    await assertFails(batch.commit());
    await assertFails(
      db.runTransaction(async (tx) => {
        await tx.get(db.doc(`users/${ALICE}`));
        tx.update(db.doc(`users/${ALICE}`), { firstName: 'Eve' });
      }),
    );
  });
});
