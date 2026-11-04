/**
 * Firestore emulator access for tests. `firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST, so the
 * suites are port-agnostic; without it they are skipped locally and fail in CI (as in functions/), and they
 * refuse any project that is not `demo-*`.
 */
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { describe } from 'vitest';

export const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
if (!EMULATOR_HOST && process.env.CI) {
  throw new Error('emulator tests need FIRESTORE_EMULATOR_HOST: run them under `firebase emulators:exec --only firestore --project demo-grouper`');
}
export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'demo-grouper';

export const describeEmulator = describe.skipIf(!EMULATOR_HOST);

export function testDb(): Firestore {
  if (!EMULATOR_HOST) throw new Error('FIRESTORE_EMULATOR_HOST is not set');
  if (!PROJECT_ID.startsWith('demo-')) throw new Error(`refusing non-demo project ${PROJECT_ID}`);
  if (getApps().length === 0) initializeApp({ projectId: PROJECT_ID });
  return getFirestore();
}

export async function clearFirestore(): Promise<void> {
  const res = await fetch(`http://${EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`clearing the emulator failed: ${res.status}`);
}

/** Every document in the database, keyed by path, as JSON-comparable data. */
export async function dumpAll(db: Firestore): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const walk = async (refs: DocumentReference[]): Promise<void> => {
    for (const ref of refs) {
      const snap = await ref.get();
      if (snap.exists) out.set(ref.path, JSON.stringify(snap.data()));
      for (const sub of await ref.listCollections()) await walk(await sub.listDocuments());
    }
  };
  for (const col of await db.listCollections()) await walk(await col.listDocuments());
  return out;
}

/** Paths that differ between two dumps (added, removed or changed). */
export function changedPaths(before: Map<string, string>, after: Map<string, string>): string[] {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((p) => before.get(p) !== after.get(p)).sort();
}
