/**
 * `restore replay-ledger` (DESIGN.md §13 Backups, PRIVACY.md §5): after a PITR or backup restore, every
 * `erasureLedger` entry (account deletions, interest removals, consent withdrawals, gender opt-outs, photo deletions,
 * blocks and unblocks) is replayed before traffic resumes, each kind by the same server code as the original action.
 *
 * Firestore restores into a new database, and the restored copy's own ledger stops at the restore point. The ledger
 * is therefore read from the source database (`--ledger-database`, the live one by default, which still holds the
 * 35-day ledger) and replayed into the restored one (`--database`).
 *
 * Replay is all or nothing: if any entry is malformed or its kind has no replay path, nothing is replayed and the run
 * exits non-zero, so a partly erased restore is never mistaken for a finished one. Entries run in `at` order (an
 * unblock must follow its block); the run stops at the first failure and can simply be run again, because every
 * replay path must be idempotent.
 *
 * Today no kind has a replay path the CLI can call (see UNAVAILABLE): the server code is still a stub for most kinds,
 * and where it exists it lives inside a callable that takes the user's own call context and writes a new ledger
 * entry. Each handler, once added, receives the ledger entry (which carries only `uidH`, never the uid, so the
 * server side must resolve uidH to uid with UID_HMAC_KEY) and the restored database.
 */
import { ERASURE_KINDS, erasureLedgerDocSchema, type ErasureKind } from '@grouper/core';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { table } from './format';

export const ERASURE_LEDGER = 'erasureLedger';

export interface LedgerEntry {
  readonly id: string;
  readonly uidH: string;
  readonly kind: ErasureKind;
  readonly ref?: string;
  readonly atMs: number;
}

export type ReplayOutcome = 'replayed' | 'nothingToDo';
export type ReplayHandler = (entry: LedgerEntry, target: Firestore) => Promise<ReplayOutcome>;
export type ReplayHandlers = Partial<Record<ErasureKind, ReplayHandler>>;

/** Why each kind cannot be replayed yet, naming the server code its replay must call. */
export const UNAVAILABLE: Readonly<Record<ErasureKind, string>> = {
  account: 'not available yet: purgeUser (functions/src/tasks/index.ts) is a stub; replay will enqueue purgeUser for the resolved uid',
  interest: 'not available yet: removeInterest (functions/src/callables/index.ts) is a stub',
  consentWithdrawal:
    'not available yet: withdrawArt9Consent (functions/src/callables/art9Consent.ts) has stubbed holding steps and no replay entry point (it needs the user\'s call context and writes a new ledger entry)',
  gender: 'not available yet: the gender withdrawal in updateProfile (functions/src/callables/updateProfile.ts) has no replay entry point',
  photo: 'not available yet: deletePhoto (functions/src/callables/index.ts) is a stub',
  block: 'not available yet: blockUser (functions/src/callables/index.ts) is a stub',
  unblock: 'not available yet: unblockUser (functions/src/callables/index.ts) is a stub',
};

/** No kind has a replay path yet (see UNAVAILABLE). */
export const DEFAULT_REPLAY_HANDLERS: ReplayHandlers = {};

export interface LedgerRead {
  readonly entries: readonly LedgerEntry[];
  /** Ids of ledger docs that do not parse; any of them blocks the replay. */
  readonly invalid: readonly string[];
}

export async function readLedger(db: Firestore, sinceMs?: number): Promise<LedgerRead> {
  let q = db.collection(ERASURE_LEDGER).orderBy('at');
  if (sinceMs !== undefined) q = q.where('at', '>=', Timestamp.fromMillis(sinceMs));
  const snap = await q.get();
  const entries: LedgerEntry[] = [];
  const invalid: string[] = [];
  for (const doc of snap.docs) {
    const parsed = erasureLedgerDocSchema.safeParse(doc.data());
    if (!parsed.success) {
      invalid.push(doc.id);
      continue;
    }
    const e = parsed.data;
    entries.push({ id: doc.id, uidH: e.uidH, kind: e.kind, ...(e.ref === undefined ? {} : { ref: e.ref }), atMs: e.at.toMillis() });
  }
  return { entries, invalid };
}

export interface KindSummary {
  entries: number;
  replayed: number;
  nothingToDo: number;
  notRun: number;
}

export interface ReplaySummary {
  readonly complete: boolean;
  readonly dryRun: boolean;
  readonly byKind: Readonly<Record<ErasureKind, KindSummary>>;
  readonly invalid: readonly string[];
  /** Kinds present in the ledger that have no replay path, with the reason. */
  readonly unavailable: readonly { kind: ErasureKind; reason: string }[];
  readonly failure?: { readonly entryId: string; readonly kind: ErasureKind; readonly message: string };
}

function emptyByKind(): Record<ErasureKind, KindSummary> {
  return Object.fromEntries(ERASURE_KINDS.map((k) => [k, { entries: 0, replayed: 0, nothingToDo: 0, notRun: 0 }])) as Record<ErasureKind, KindSummary>;
}

export async function replayLedger(
  ledger: LedgerRead,
  target: Firestore,
  handlers: ReplayHandlers = DEFAULT_REPLAY_HANDLERS,
  opts: { dryRun?: boolean } = {},
): Promise<ReplaySummary> {
  const byKind = emptyByKind();
  const entries = [...ledger.entries].sort((a, b) => a.atMs - b.atMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const e of entries) {
    byKind[e.kind].entries++;
    byKind[e.kind].notRun++;
  }
  const unavailable = ERASURE_KINDS.filter((k) => byKind[k].entries > 0 && handlers[k] === undefined).map((kind) => ({ kind, reason: UNAVAILABLE[kind] }));
  const dryRun = opts.dryRun === true;
  if (dryRun || unavailable.length > 0 || ledger.invalid.length > 0) {
    return { complete: false, dryRun, byKind, invalid: ledger.invalid, unavailable };
  }
  for (const e of entries) {
    try {
      const outcome = await handlers[e.kind]!(e, target);
      byKind[e.kind].notRun--;
      byKind[e.kind][outcome]++;
    } catch (err) {
      return { complete: false, dryRun, byKind, invalid: [], unavailable: [], failure: { entryId: e.id, kind: e.kind, message: err instanceof Error ? err.message : String(err) } };
    }
  }
  return { complete: true, dryRun, byKind, invalid: [], unavailable: [] };
}

export function formatReplay(s: ReplaySummary, where: { source: string; target: string }): string {
  const kinds = ERASURE_KINDS.filter((k) => s.byKind[k].entries > 0);
  const lines = [`erasureLedger from ${where.source}, replayed into ${where.target}`];
  lines.push(
    kinds.length === 0
      ? 'no ledger entries'
      : table(
          ['kind', 'entries', 'replayed', 'nothingToDo', 'notRun'],
          kinds.map((k) => [k, s.byKind[k].entries, s.byKind[k].replayed, s.byKind[k].nothingToDo, s.byKind[k].notRun]),
          1,
        ),
  );
  if (s.invalid.length > 0) lines.push(`malformed ledger entries (fix or remove before replaying): ${s.invalid.join(', ')}`);
  for (const u of s.unavailable) lines.push(`${u.kind}: ${u.reason}`);
  if (s.failure) lines.push(`stopped at ${s.failure.entryId} (${s.failure.kind}): ${s.failure.message}; run again once fixed (replays are idempotent)`);
  if (s.dryRun) lines.push('dry run: nothing was replayed');
  else if (s.complete) lines.push('every entry replayed; traffic may resume once the drill checks pass');
  else lines.push(s.unavailable.length > 0 || s.invalid.length > 0 ? 'nothing was replayed. Do NOT resume traffic.' : 'replay incomplete. Do NOT resume traffic.');
  return lines.join('\n');
}
