/**
 * Wrappers for task, scheduled and event functions with the same logging rules as handler.ts (§13): payloads
 * are never logged (task payloads carry uids). Failures are rethrown so the platform's retry policy applies,
 * except invalid task payloads, which a retry cannot fix.
 */
import { parseSafely, type Schema } from '@friendpod/core/node';
import { HttpsError } from 'firebase-functions/https';
import { AppError } from './errors';
import { errorFields, type Log, type LogFields } from './log';

export interface BackgroundDeps {
  now(): number;
  readonly log: Log;
}

export type BackgroundKind = 'task' | 'schedule' | 'event';

/**
 * What a background function throws after logging the scrubbed entry. The platform logs whatever is thrown:
 * the task handler logs a non-HttpsError in full as "Unhandled error", the scheduler logs `err.message` and
 * the event runtime logs the error. A Firestore error message names document paths with uids, so the original
 * error never leaves this module; the replacement carries only the app code. An HttpsError("internal") makes
 * the task handler answer 500 (Cloud Tasks retries) without logging it again.
 */
function dataFreeFailure(kind: BackgroundKind, code: string): Error {
  return kind === 'task' ? new HttpsError('internal', code) : new Error(code);
}

export async function runBackground(kind: BackgroundKind, name: string, deps: BackgroundDeps, body: () => Promise<LogFields | void>): Promise<void> {
  const started = deps.now();
  try {
    const fields = await body();
    deps.log.info(kind, { fn: name, outcome: 'ok', ms: deps.now() - started, ...(fields ?? {}) });
  } catch (err) {
    const details: LogFields = err instanceof AppError ? { code: err.code, ...err.extra } : { code: 'INTERNAL', ...errorFields(err) };
    deps.log.error(`${kind}.failed`, { fn: name, ms: deps.now() - started, ...details });
    throw dataFreeFailure(kind, err instanceof AppError ? err.code : 'INTERNAL');
  }
}

export async function runTask<T>(name: string, schema: Schema<T>, data: unknown, deps: BackgroundDeps, body: (payload: T) => Promise<LogFields | void>): Promise<void> {
  const payload = parseSafely(schema, data);
  if (!payload.ok) {
    deps.log.error('task.invalidPayload', { fn: name, issues: payload.issues.map((i) => ({ path: i.path, code: i.code })) });
    return;
  }
  await runBackground('task', name, deps, () => body(payload.data));
}
