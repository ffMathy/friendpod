/**
 * Firestore + Auth emulator tests. They run under `firebase emulators:exec --only auth,firestore`, which sets
 * FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST, so no port is hard-coded here. Without them the
 * suites are skipped locally and fail in CI. Every test uses fresh uids, so files can run in parallel.
 */
import { randomBytes } from 'node:crypto';
import type { CallableInput, CallableName, CallableOutput } from '@friendpod/core';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { afterAll, describe } from 'vitest';
import { runCallable, type CallContext } from '../../src/lib/handler';
import { log } from '../../src/lib/log';
import type { PushKind, PushParams, PushRecipient } from '../../src/lib/push';
import type { AppDeps } from '../../src/lib/runtime';
import type { TaskOptions, TaskQueueName } from '../../src/lib/tasks';
import { testUidHmac } from './keys';
import { MemoryUserObjects } from './objects';
import { PROJECT_ID, request, type RequestOptions } from './requests';

export const HAS_EMULATORS = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (!HAS_EMULATORS && process.env.CI) {
  throw new Error('emulator tests need FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST: run them under `firebase emulators:exec --only auth,firestore`');
}
export const describeEmulator = HAS_EMULATORS ? describe : describe.skip;

export interface SentPush {
  readonly kind: PushKind;
  readonly recipients: readonly PushRecipient[];
  readonly params?: PushParams;
}

export interface EnqueuedTask {
  readonly queue: TaskQueueName;
  readonly data: Record<string, unknown>;
  readonly options: TaskOptions;
}

export interface TestDeps extends AppDeps {
  readonly clock: { now: number };
  /** Every push the code under test sent; there is no FCM emulator. */
  readonly pushes: SentPush[];
  /** Every task enqueued (duplicates by id answered `exists`, as Cloud Tasks does); there is no Tasks emulator here. */
  readonly enqueued: EnqueuedTask[];
  readonly objects: MemoryUserObjects;
}

/** One Admin app per test file, against the emulators; a settable clock instead of Date.now(), pushes recorded. */
export function emulatorDeps(startMs: number): TestDeps {
  let app: App | undefined;
  const clock = { now: startMs };
  const pushes: SentPush[] = [];
  const enqueued: EnqueuedTask[] = [];
  const objects = new MemoryUserObjects();
  const lazyApp = (): App => (app ??= initializeApp({ projectId: PROJECT_ID }, `test-${randomBytes(6).toString('hex')}`));
  afterAll(async () => {
    if (app) await deleteApp(app);
  });
  return {
    clock,
    pushes,
    enqueued,
    objects,
    tasks: {
      async enqueue(queue, data, options) {
        if (enqueued.some((t) => t.queue === queue && t.options.id === options.id)) return 'exists';
        enqueued.push({ queue, data, options });
        return 'enqueued';
      },
    },
    now: () => clock.now,
    uidHmac: () => testUidHmac,
    log,
    push: async (kind, recipients, params) => {
      pushes.push({ kind, recipients, ...(params ? { params } : {}) });
      return { sent: recipients.reduce((n, r) => n + r.tokens.length, 0), staleTokens: [] };
    },
    get db() {
      return getFirestore(lazyApp());
    },
    get auth() {
      return getAuth(lazyApp());
    },
  };
}

/** Firebase-style uid: 28 characters, unique per call. */
export function newUid(): string {
  return randomBytes(21).toString('base64url');
}

type Impl<N extends CallableName> = (deps: AppDeps, call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

/** Calls a callable's implementation through the real wrapper, as an authenticated, attested client would. */
export function invoke<N extends CallableName>(name: N, impl: Impl<N>, deps: TestDeps, data: unknown, o: Omit<RequestOptions, 'nowMs'> = {}): Promise<CallableOutput<N>> {
  return runCallable(name, (call, input) => impl(deps, call, input), request(data, { nowMs: deps.clock.now, ...o }), deps);
}

/** The app code of a rejected call (`HttpsError.details.code`). */
export async function errorCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return String((e as { details?: { code?: unknown } }).details?.code);
  }
  throw new Error('expected the call to fail');
}
