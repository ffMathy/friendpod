/**
 * Every admin run records who ran it and why (DESIGN.md §9 Admin access: "each run records a reason").
 *
 * Runs go to `adminRuns/{autoId}` (DESIGN.md §8.2; server-only: the rules deny every path they do not list) with
 * `expiresAt` = run + 12 months, deleted by the TTL policy on `adminRuns.expiresAt` in firestore.indexes.json. A record holds the command, its target (an area id, a database
 * id, or for a user only `sanctions/{uidH}`), the reason, the admin and an outcome code with counts; never a raw uid,
 * report text, tags or other user content. A run about a user carries `subjectH` (their uidH), so purgeUser can
 * redact its target and reason when the account is erased.
 */
import { FieldValue, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import type { AdminContext } from './context';

export const ADMIN_RUNS = 'adminRuns';
export const ADMIN_RUN_RETENTION_MS = 365 * 24 * 3600 * 1000;

export interface RunRecord {
  readonly command: string;
  readonly target?: string;
  readonly reason: string;
  /** The uidH of the user the run is about (never the uid itself). */
  readonly subjectH?: string;
}

export type RunDetails = Readonly<Record<string, string | number | boolean>>;

/** Writes the record before the command acts, so a run that dies half-way is still on record. */
export async function startRun(ctx: AdminContext, db: Firestore, run: RunRecord): Promise<DocumentReference> {
  const now = ctx.now();
  const ref = db.collection(ADMIN_RUNS).doc();
  await ref.create({
    command: run.command,
    ...(run.target === undefined ? {} : { target: run.target }),
    ...(run.subjectH === undefined ? {} : { subjectH: run.subjectH }),
    reason: run.reason,
    actor: await ctx.actor(),
    project: ctx.project,
    outcome: 'started',
    at: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + ADMIN_RUN_RETENTION_MS),
  });
  return ref;
}

export async function finishRun(ref: DocumentReference, outcome: string, details: RunDetails = {}): Promise<void> {
  await ref.update({ outcome, details, finishedAt: FieldValue.serverTimestamp() });
}

/** Runs `body` between startRun and finishRun; a thrown error is recorded as `failed` and rethrown. */
export async function recorded<T>(
  ctx: AdminContext,
  db: Firestore,
  run: RunRecord,
  body: () => Promise<{ value: T; outcome: string; details?: RunDetails }>,
): Promise<T> {
  const ref = await startRun(ctx, db, run);
  try {
    const { value, outcome, details } = await body();
    await finishRun(ref, outcome, details);
    return value;
  } catch (err) {
    await finishRun(ref, 'failed').catch(() => undefined);
    throw err;
  }
}
