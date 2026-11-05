/**
 * Automated sanctions (DESIGN.md §3.7, §4.4, §8.2 `sanctions/{uid}`; F17, A38). A rule in core decides; this module
 * writes the decision inside the caller's transaction (report, feedback close, late cancel) and lifts it again when it
 * has expired (hourlySweeper). Every sanction has an end date and a statement of reasons; nothing here is permanent
 * and nobody reviews it. The admin CLI can only end one early by moving `until` to now (tools/admin sanctions lift).
 */
import { NOTICE_CODES, mergeSanction, type SanctionDecision } from '@grouper/core';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { docs, matchProfiles, ts, type DocOf } from './firestore';
import { errorFields } from './log';
import { writeNotice } from './notices';
import type { AppDeps } from './runtime';

type UserDoc = DocOf<'user'>;
type ProfileDoc = DocOf<'matchProfile'>;
type SanctionDoc = DocOf<'sanction'>;

/** The account and mirror after a sanction: paused (or suspended) with the reason and its end date (§8.1). */
export function sanctionedDocs(user: UserDoc, profile: ProfileDoc, d: SanctionDecision, now: number): { user: UserDoc; profile: ProfileDoc } {
  const { pausedUntil: _p, pauseReason: _r, ...participation } = user.participation;
  const status = d.type === 'suspension' ? 'suspended' : 'paused';
  return {
    user: { ...user, status, participation: { ...participation, pauseReason: d.reason, pausedUntil: ts(d.until) } },
    // The mirror carries no end date: only the sweeper lifts an automated pause, so the drop never does it early.
    profile: { ...profile, status, participation: { ...profile.participation, pausedUntil: null }, updatedAt: ts(now) },
  };
}

/**
 * Applies `decision` on top of the running sanction (read by the caller in the same transaction). Returns the user
 * and profile docs for the caller to write, and `write`, which the caller runs after its last read (a Firestore
 * transaction reads before it writes): `sanctions/{uid}` and the statement of reasons. Null for an account being
 * deleted.
 */
export function applySanction(
  db: Firestore,
  uid: string,
  docsIn: { readonly user: UserDoc; readonly profile: ProfileDoc; readonly existing: SanctionDoc | null },
  decision: SanctionDecision,
  now: number,
): { user: UserDoc; profile: ProfileDoc; write: (tx: Transaction) => void } | null {
  if (docsIn.user.status === 'deleting') return null;
  const existing = docsIn.existing ? { type: docsIn.existing.type, reason: docsIn.existing.reasonCode, until: docsIn.existing.until.toMillis() } : null;
  const merged = mergeSanction(existing, decision, now);
  const restarted = !existing || existing.until <= now || merged.reason !== existing.reason || decision.reason === 'underageReport';
  const write = (tx: Transaction): void => {
    const noticeId = writeNotice(db, tx, uid, 'statementOfReasons', decision.noticeCode, { until: merged.until, type: merged.type }, now);
    tx.set(docs(db).sanction(uid), {
      type: merged.type,
      until: ts(merged.until),
      reasonCode: merged.reason,
      noticeId,
      createdAt: docsIn.existing?.createdAt ?? ts(now),
      since: restarted ? ts(now) : (docsIn.existing?.since ?? ts(now)),
    });
  };
  return { ...sanctionedDocs(docsIn.user, docsIn.profile, merged, now), write };
}

/** Lifts one expired sanction (§10.3 hourlySweeper); idempotent. */
export async function liftSanction(deps: Pick<AppDeps, 'db'>, uid: string, now: number): Promise<boolean> {
  const refs = docs(deps.db);
  return deps.db.runTransaction(async (tx) => {
    const [s, u, p] = await Promise.all([tx.get(refs.sanction(uid)), tx.get(refs.user(uid)), tx.get(refs.matchProfile(uid))]);
    const sanction = s.data();
    if (!sanction || sanction.until.toMillis() > now) return false;
    tx.delete(refs.sanction(uid));
    const user = u.data();
    const profile = p.data();
    if (!user || !profile || user.status === 'deleting') return true;
    const ours = user.status === 'suspended' || (user.status === 'paused' && user.participation.pauseReason === sanction.reasonCode);
    if (!ours) return true;
    const { pausedUntil: _p, pauseReason: _r, ...participation } = user.participation;
    tx.set(refs.user(uid), { ...user, status: 'active', participation });
    tx.set(refs.matchProfile(uid), { ...profile, status: 'active', participation: { ...profile.participation, pausedUntil: null }, updatedAt: ts(now) });
    writeNotice(deps.db, tx, uid, 'system', NOTICE_CODES.SANCTION_ENDED, {}, now);
    return true;
  });
}

const PAGE = 200;

/** Every sanction whose `until` has passed, and every expired sensitive-theme hold (S7). */
export async function liftExpired(deps: Pick<AppDeps, 'db' | 'log'>, now: number): Promise<{ sanctions: number; holds: number; failed: number }> {
  let sanctions = 0;
  let holds = 0;
  let failed = 0;
  const due = await deps.db.collection('sanctions').where('until', '<=', ts(now)).select().limit(PAGE * 10).get();
  for (const d of due.docs) {
    try {
      if (await liftSanction(deps, d.id, now)) sanctions++;
    } catch (err) {
      failed++;
      deps.log.error('sanctions.liftFailed', errorFields(err));
    }
  }
  const held = await matchProfiles(deps.db).where('sensitiveHold.until', '<=', ts(now)).limit(PAGE * 10).get();
  for (const d of held.docs) {
    try {
      const lifted = await deps.db.runTransaction(async (tx) => {
        const snap = await tx.get(d.ref);
        const p = snap.data();
        if (!p?.sensitiveHold || p.sensitiveHold.until.toMillis() > now) return false;
        tx.set(d.ref, { ...p, sensitiveHold: null, updatedAt: ts(now) });
        return true;
      });
      if (lifted) holds++;
    } catch (err) {
      failed++;
      deps.log.error('sanctions.holdLiftFailed', errorFields(err));
    }
  }
  return { sanctions, holds, failed };
}
