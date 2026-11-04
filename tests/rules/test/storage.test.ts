/**
 * storage.rules (DESIGN.md §9): the fixed-name pending upload pair, photo reads by the owner or through a
 * photoGrants/{owner}_{viewer} doc (a cross-service Firestore read), owner-only exports, everything else denied.
 */
import { assertFails, assertSucceeds, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { onboarded, rulesEnv } from './env';

const ALICE = 'aliceUid0000000000000000000a';
const BOB = 'bobUid000000000000000000000b';
const CAROL = 'carolUid00000000000000000000';

const MAX_UPLOAD = 2 * 1024 * 1024;
const JPEG = { contentType: 'image/jpeg' };
const bytes = (n: number): Uint8Array => new Uint8Array(n).fill(0xff);

const SEEDED: Record<string, { contentType: string }> = {
  [`photos/${ALICE}/3.jpg`]: JPEG,
  [`photos/${ALICE}/3_256.jpg`]: JPEG,
  [`photos/${BOB}/1.jpg`]: JPEG,
  [`uploads/${ALICE}/pending.jpg`]: JPEG,
  [`exports/${ALICE}/e1.json`]: { contentType: 'application/json' },
  'drops/2026-W45/input.bin': { contentType: 'application/octet-stream' },
  'misc/readme.txt': { contentType: 'text/plain' },
};

let env: RulesTestEnvironment;
let anon: RulesTestContext;
let alice: RulesTestContext;
let bob: RulesTestContext;
let carol: RulesTestContext;

const grant = (owner: string, viewer: string) => `photoGrants/${owner}_${viewer}`;

beforeAll(async () => {
  env = await rulesEnv();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (admin) => {
    const bucket = admin.storage();
    await Promise.all(Object.entries(SEEDED).map(([path, meta]) => bucket.ref(path).put(bytes(16), meta).then()));
  });
  anon = env.unauthenticatedContext();
  alice = onboarded(env, ALICE);
  bob = onboarded(env, BOB);
  carol = onboarded(env, CAROL);
});

// Grants are per test so the revocation tests start from a known state.
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (admin) => {
    await admin.firestore().doc(grant(ALICE, BOB)).set({ pods: ['p1'], createdAt: new Date() });
  });
});

afterAll(async () => {
  await env?.clearStorage();
  await env?.clearFirestore();
  await env?.cleanup();
});

const ref = (ctx: RulesTestContext, path: string) => ctx.storage().ref(path);
const upload = (ctx: RulesTestContext, path: string, data: Uint8Array, meta?: { contentType: string }) =>
  ref(ctx, path).put(data, meta).then();
const metadata = (ctx: RulesTestContext, path: string) => ref(ctx, path).getMetadata();

describe('uploads/{uid}: create or overwrite the fixed-name pending pair only', () => {
  it('allows the owner to upload pending.jpg and pending_256.jpg, and to overwrite them', async () => {
    await assertSucceeds(upload(alice, `uploads/${ALICE}/pending.jpg`, bytes(1024), JPEG));
    await assertSucceeds(upload(alice, `uploads/${ALICE}/pending.jpg`, bytes(2048), JPEG));
    await assertSucceeds(upload(alice, `uploads/${ALICE}/pending_256.jpg`, bytes(256), JPEG));
  });

  it("denies uploads into another user's folder and unauthenticated uploads", async () => {
    await assertFails(upload(bob, `uploads/${ALICE}/pending.jpg`, bytes(1024), JPEG));
    await assertFails(upload(anon, `uploads/${ALICE}/pending.jpg`, bytes(1024), JPEG));
  });

  for (const name of ['photo.jpg', 'pending.jpeg', 'Pending.jpg', 'pending.jpg.jpg', 'pending_1080.jpg', 'x/pending.jpg']) {
    it(`denies any other object name: ${name}`, async () => {
      await assertFails(upload(alice, `uploads/${ALICE}/${name}`, bytes(1024), JPEG));
    });
  }

  it('denies uploads of 2 MiB or more', async () => {
    await assertSucceeds(upload(alice, `uploads/${ALICE}/pending.jpg`, bytes(MAX_UPLOAD - 1), JPEG));
    await assertFails(upload(alice, `uploads/${ALICE}/pending.jpg`, bytes(MAX_UPLOAD), JPEG));
  });

  it('denies any content type other than image/jpeg', async () => {
    for (const contentType of ['image/png', 'image/heic', 'application/octet-stream', 'text/html']) {
      await assertFails(upload(alice, `uploads/${ALICE}/pending.jpg`, bytes(1024), { contentType }));
    }
  });

  it('denies changing the content type of a pending upload through a metadata update', async () => {
    await assertFails(ref(alice, `uploads/${ALICE}/pending.jpg`).updateMetadata({ contentType: 'text/html' }));
  });

  it('denies reading, listing and deleting uploads, even for the owner', async () => {
    await assertFails(metadata(alice, `uploads/${ALICE}/pending.jpg`));
    await assertFails(ref(alice, `uploads/${ALICE}`).listAll());
    await assertFails(ref(alice, `uploads/${ALICE}/pending.jpg`).delete());
  });
});

describe('photos/{owner}: get by the owner or through a photo grant', () => {
  it('allows the owner', async () => {
    await assertSucceeds(metadata(alice, `photos/${ALICE}/3.jpg`));
    await assertSucceeds(metadata(alice, `photos/${ALICE}/3_256.jpg`));
  });

  it('allows a viewer with photoGrants/{owner}_{viewer}', async () => {
    await assertSucceeds(metadata(bob, `photos/${ALICE}/3.jpg`));
    await assertSucceeds(metadata(bob, `photos/${ALICE}/3_256.jpg`));
  });

  it('denies users without a grant and unauthenticated clients', async () => {
    await assertFails(metadata(carol, `photos/${ALICE}/3.jpg`));
    await assertFails(metadata(anon, `photos/${ALICE}/3.jpg`));
  });

  it('is directional: a grant to see Alice does not let Alice see Bob', async () => {
    await assertFails(metadata(alice, `photos/${BOB}/1.jpg`));
  });

  it('stops at once when the grant doc is deleted', async () => {
    await assertSucceeds(metadata(bob, `photos/${ALICE}/3.jpg`));
    await env.withSecurityRulesDisabled(async (admin) => {
      await admin.firestore().doc(grant(ALICE, BOB)).delete();
    });
    await assertFails(metadata(bob, `photos/${ALICE}/3.jpg`));
  });

  it('denies listing, even for the owner', async () => {
    await assertFails(ref(alice, `photos/${ALICE}`).listAll());
    await assertFails(ref(bob, `photos/${ALICE}`).listAll());
  });

  it('denies every client write, even by the owner', async () => {
    await assertFails(upload(alice, `photos/${ALICE}/4.jpg`, bytes(1024), JPEG));
    await assertFails(upload(alice, `photos/${ALICE}/3.jpg`, bytes(1024), JPEG));
    await assertFails(ref(alice, `photos/${ALICE}/3.jpg`).updateMetadata({ cacheControl: 'public, max-age=31536000' }));
    await assertFails(ref(alice, `photos/${ALICE}/3.jpg`).delete());
    await assertFails(upload(bob, `photos/${ALICE}/4.jpg`, bytes(1024), JPEG));
  });
});

describe('exports/{uid}: get by the owner only', () => {
  it('allows the owner', async () => {
    await assertSucceeds(metadata(alice, `exports/${ALICE}/e1.json`));
  });

  it('denies other users, unauthenticated clients and grantees', async () => {
    await assertFails(metadata(bob, `exports/${ALICE}/e1.json`)); // Bob holds a photo grant from Alice
    await assertFails(metadata(anon, `exports/${ALICE}/e1.json`));
  });

  it('denies listing and every client write', async () => {
    await assertFails(ref(alice, `exports/${ALICE}`).listAll());
    await assertFails(upload(alice, `exports/${ALICE}/e2.json`, bytes(16), { contentType: 'application/json' }));
    await assertFails(ref(alice, `exports/${ALICE}/e1.json`).delete());
  });
});

describe('everything else is denied', () => {
  for (const path of ['drops/2026-W45/input.bin', 'misc/readme.txt']) {
    it(path, async () => {
      for (const ctx of [anon, alice]) {
        await assertFails(metadata(ctx, path));
        await assertFails(upload(ctx, path, bytes(16), JPEG));
        await assertFails(ref(ctx, path).delete());
      }
    });
  }

  it('denies uploads outside uploads/{uid}/', async () => {
    await assertFails(upload(alice, 'pending.jpg', bytes(16), JPEG));
    await assertFails(upload(alice, `${ALICE}/pending.jpg`, bytes(16), JPEG));
    await assertFails(upload(alice, `uploads/pending.jpg`, bytes(16), JPEG));
  });

  it('denies listing the bucket root', async () => {
    await assertFails(ref(alice, '').listAll());
  });
});
