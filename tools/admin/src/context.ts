/**
 * Firebase access for the admin CLI (DESIGN.md §9 Admin access): Application Default Credentials of a named admin
 * (`gcloud auth application-default login`), never a service-account key, and the project named by `--project`.
 * The emulators are used when FIRESTORE_EMULATOR_HOST (and, for task enqueues, CLOUD_TASKS_EMULATOR_HOST) is set,
 * which firebase-admin reads itself; then the project must be a `demo-*` project, and a `demo-*` project is refused
 * without the emulator, so a run can never be mistaken for the other.
 */
import { FUNCTIONS_REGION, OPEN_AREA_DISPATCH_DEADLINE_SECONDS, openAreaTask, openAreaTaskId } from '@grouper/core';
import { applicationDefault, deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { UsageError } from './args';

/** Shared with codebase "default" through @grouper/core (deploy.ts), so the two cannot drift. */
export { FUNCTIONS_REGION, OPEN_AREA_DISPATCH_DEADLINE_SECONDS, openAreaTaskId };
export const DEFAULT_DATABASE = '(default)';

export type EnqueueOutcome = 'enqueued' | 'alreadyQueued';

/** Enqueues the server's task functions. Tests inject a fake. */
export interface TaskEnqueuer {
  /** `openArea` (§10.3) with the deterministic task id `open-{areaId}`. */
  openArea(areaId: string): Promise<EnqueueOutcome>;
}

export interface AdminContext {
  readonly project: string;
  readonly emulator: boolean;
  db(databaseId?: string): Firestore;
  readonly tasks: TaskEnqueuer;
  /** The admin running the command, recorded with every run. */
  actor(): Promise<string>;
  now(): number;
  close(): Promise<void>;
}

const PROJECT_ID = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const DATABASE_ID = /^(\(default\)|[a-z][a-z0-9-]{2,61}[a-z0-9])$/;

export function checkDatabaseId(id: string): string {
  if (!DATABASE_ID.test(id)) throw new UsageError(`not a Firestore database id: ${id}`);
  return id;
}

/** Validates `--project` against the emulator environment (see the module comment). */
export function checkProject(project: string | undefined, env: NodeJS.ProcessEnv = process.env): { project: string; emulator: boolean } {
  if (!project) throw new UsageError('--project <id> is required (grouper-staging, grouper-prod, or demo-grouper with the emulators)');
  if (!PROJECT_ID.test(project)) throw new UsageError(`not a Firebase project id: ${project}`);
  const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST?.trim());
  const demo = project.startsWith('demo-');
  if (demo && !emulator) throw new UsageError(`${project} is a demo project: set FIRESTORE_EMULATOR_HOST to use the emulators`);
  if (!demo && emulator) throw new UsageError(`FIRESTORE_EMULATOR_HOST is set: use a demo-* project with the emulators, or unset it to reach ${project}`);
  return { project, emulator };
}

interface TaskQueueLike {
  enqueue(data: Record<string, unknown>, opts: { id: string; dispatchDeadlineSeconds: number }): Promise<void>;
}

/** Cloud Tasks through firebase-admin; `queueFor` is the seam the tests use. */
export function taskEnqueuer(queueFor: (functionName: string) => TaskQueueLike): TaskEnqueuer {
  return {
    async openArea(areaId) {
      const payload = openAreaTask.parse({ areaId });
      try {
        await queueFor(`locations/${FUNCTIONS_REGION}/functions/openArea`).enqueue(payload, {
          id: openAreaTaskId(areaId),
          dispatchDeadlineSeconds: OPEN_AREA_DISPATCH_DEADLINE_SECONDS,
        });
        return 'enqueued';
      } catch (err) {
        // Cloud Tasks keeps a task name for a while after the task ran; openArea is idempotent, so an existing task
        // with this id means the area's opening is already queued or done.
        if ((err as { code?: unknown }).code === 'functions/task-already-exists') return 'alreadyQueued';
        throw err;
      }
    },
  };
}

/** The ADC principal's email, from Google's token info endpoint; "unknown" when ADC has no email scope. */
async function adcPrincipal(app: App): Promise<string> {
  try {
    const token = await app.options.credential!.getAccessToken();
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token.access_token)}`);
    const body = (await res.json()) as { email?: unknown };
    if (res.ok && typeof body.email === 'string' && body.email.length > 0) return body.email;
  } catch {
    // fall through
  }
  return 'unknown';
}

export interface ContextOptions {
  readonly project: string | undefined;
  /** Identity Cloud Tasks uses to call the task function (§9 IAM: the task functions run as `sa-api@`). */
  readonly taskServiceAccount?: string | undefined;
  readonly env?: NodeJS.ProcessEnv;
}

export function createContext(options: ContextOptions): AdminContext {
  const env = options.env ?? process.env;
  const { project, emulator } = checkProject(options.project, env);
  const serviceAccountId = options.taskServiceAccount ?? `sa-api@${project}.iam.gserviceaccount.com`;
  const app = initializeApp(
    emulator ? { projectId: project } : { projectId: project, credential: applicationDefault(), serviceAccountId },
    `grouper-admin-${project}-${Date.now()}`,
  );
  const dbs = new Map<string, Firestore>();
  let principal: Promise<string> | undefined;
  return {
    project,
    emulator,
    db(databaseId = DEFAULT_DATABASE) {
      checkDatabaseId(databaseId);
      let db = dbs.get(databaseId);
      if (!db) {
        db = databaseId === DEFAULT_DATABASE ? getFirestore(app) : getFirestore(app, databaseId);
        dbs.set(databaseId, db);
      }
      return db;
    },
    tasks: taskEnqueuer((name) => {
      if (emulator && !env.CLOUD_TASKS_EMULATOR_HOST?.trim()) {
        throw new UsageError('CLOUD_TASKS_EMULATOR_HOST is not set: run under `firebase emulators:exec --only firestore,functions`');
      }
      return getFunctions(app).taskQueue(name);
    }),
    actor() {
      principal ??= emulator ? Promise.resolve(`emulator:${env.USER ?? 'local'}`) : adcPrincipal(app);
      return principal;
    },
    now: () => Date.now(),
    close: () => deleteApp(app),
  };
}
