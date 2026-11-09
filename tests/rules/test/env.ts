/**
 * Shared setup for the rules suites. They run under `firebase emulators:exec --only firestore,storage
 * --project demo-friendpod`, which sets FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST;
 * @firebase/rules-unit-testing reads those, so no port is hard-coded here.
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestContext, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const PROJECT_ID = 'demo-friendpod';

const REQUIRED_ENV = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST'] as const;

const repoFile = (name: string): string => readFileSync(new URL(`../../../${name}`, import.meta.url), 'utf8');

/** One environment per test file, loaded with the repo's real rules files. */
export async function rulesEnv(): Promise<RulesTestEnvironment> {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `rules tests need ${missing.join(' and ')}: from the repo root run ` +
        '`firebase emulators:exec --only firestore,storage --project demo-friendpod "npm --prefix tests/rules test"`',
    );
  }
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: repoFile('firestore.rules') },
    storage: { rules: repoFile('storage.rules') },
  });
}

/** A signed-in user; `onb` is the onboarding custom claim (§9). */
export function user(env: RulesTestEnvironment, uid: string, claims: { onb?: unknown } = {}): RulesTestContext {
  return env.authenticatedContext(uid, claims);
}

export const onboarded = (env: RulesTestEnvironment, uid: string): RulesTestContext => user(env, uid, { onb: true });
