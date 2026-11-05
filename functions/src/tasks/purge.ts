/**
 * purgeUser (DESIGN.md §10.3; PRIVACY.md §6 "Erasure sequence"), idempotent and retried. Steps in the documented order:
 *   1. the account is `deleting` (deleteAccount set it; a purge from the Auth reconciliation sets it here);
 *   2. interests: sensitive holdings with the full withdrawal effects, ordinary ones with their counts; tags and
 *      concepts garbage-collected;
 *   3. pods (found through `podState.memberList`, archived ones included): out of each pod with exitPod (memberUids
 *      and roster first; unscheduled options deleted, the winning one reattributed to "former member"; votes,
 *      feedback, meet-again entries and chat messages; `podState.members`/`memberList` last);
 *   4. other links: photo grants both ways, blocks both ways, `blockedH` and `recentH` entries of the user's uidH in
 *      other profiles, `pairSignals`, push tokens, rate-limit buckets;
 *   5. reports: `reporterUid` → `reporterH`, `targetUid` → `targetH` (kept until their 12-month expiry); admin runs
 *      about the user (`adminRuns.subjectH`) lose their target and reason;
 *      `sanctions/{uid}` deleted;
 *   6. bulk delete: `users/{uid}` recursively ("about me" included), `matchProfiles/{uid}` with the area's
 *      waitlistCount (eraseMatchProfileAndAreaCount), Storage `photos/`, `uploads/` and `exports/`;
 *   7. records: consent events `uid` → `uidH`, `redactedAt`, `expiresAt` + 3 years; one erasure-ledger entry (`account`);
 *   8. the Auth user is deleted again if it still exists;
 *   9. `exports/` once more, for a file a running buildExport wrote after step 6 (buildExport then writes nothing).
 * Afterwards no document or object holds the uid or its uidH except consentEvents, erasureLedger and retained reports.
 */
import { uidHash, type WeekId } from '@grouper/core';
import { FieldPath, FieldValue, type Query } from 'firebase-admin/firestore';
import { eraseMatchProfileAndAreaCount } from '../lib/areas';
import { CONSENT_EVENT_RETENTION_MS, COLLECTIONS, ERASURE_LEDGER_TTL_MS, PATHS, docs, erasureLedger, matchProfiles, ts } from '../lib/firestore';
import { recentMinUntil } from '../pods/context';
import { OBJECT_PATHS, deletePrefix } from '../lib/objects';
import type { AppDeps } from '../lib/runtime';
import { deleteAuthUser, outgoingGrants } from '../callables/account';
import { removeHoldings } from '../interests/remove';
import { exitPod, podsOf } from '../pods/exit';

export interface PurgeOptions {
  /** Ledger entry id to reuse (restore runbook replay, §13); a fresh id otherwise. */
  readonly ledgerId?: string;
  /** Storage is not restored with Firestore, so a replay may skip it. */
  readonly storage?: boolean;
  /** Delete the Auth user (step 8). */
  readonly auth?: boolean;
}

const PAGE = 300;
/** What an erased user's admin runs keep in place of their target and reason. */
export const ADMIN_RUN_REDACTED = 'redacted (account erased)';

async function deleteQuery(deps: Pick<AppDeps, 'db'>, q: Query): Promise<number> {
  let n = 0;
  for (;;) {
    const page = await q.limit(PAGE).get();
    if (page.empty) return n;
    const batch = deps.db.batch();
    for (const d of page.docs) batch.delete(d.ref);
    await batch.commit();
    n += page.size;
    if (page.size < PAGE) return n;
  }
}

/** Erases one user: by uid and uidH (uid may be null when only uidH-keyed records are left, e.g. in a replay). */
export async function purgeUser(deps: AppDeps, uid: string | null, uidHIn: string | null, o: PurgeOptions = {}): Promise<{ pods: number }> {
  const db = deps.db;
  const refs = docs(db);
  const now = deps.now();
  const uidH = uidHIn ?? (await uidHash(deps.uidHmac(), uid!));
  let podCount = 0;

  if (uid) {
    // 1.
    const user = (await refs.user(uid).get()).data();
    if (user && user.status !== 'deleting') await refs.user(uid).update({ status: 'deleting' });
    const profile = await refs.matchProfile(uid).get();
    if (profile.exists && profile.get('status') !== 'deleting') await profile.ref.update({ status: 'deleting', updatedAt: ts(now) });

    // 2.
    await removeHoldings(deps, uid, (h) => ({ ordinary: [...h.ordinary.keys()], sensitive: [...h.sensitive.keys()] }), now);

    // 3. Co-members are collected first: after exitPod the pods no longer list the user.
    const pods = await podsOf(deps, uid);
    const coMembers = new Set<string>();
    for (const { podId, ps } of pods) {
      for (const m of ps.memberList) if (m !== uid) coMembers.add(m);
      if (await exitPod(deps, podId, uid, 'erasure')) podCount++;
    }

    // 4.
    for (const g of await outgoingGrants(deps, uid)) await g.ref.delete();
    for (const m of coMembers) await refs.photoGrant(m, uid).delete();
    await deleteQuery(deps, db.collection('blocks').where('blocker', '==', uid));
    const blockedBy = await db.collection('blocks').where('blocked', '==', uid).get();
    for (const b of blockedBy.docs) {
      await db.doc(PATHS.userBlock(String(b.get('blocker')), uid)).delete();
      await b.ref.delete();
    }
    await refs.pushTokens(uid).delete();
    await deleteQuery(deps, db.collection('rateLimits').orderBy(FieldPath.documentId()).startAt(`${uid}_`).endAt(`${uid}_`));

    // 5.
    for (const r of (await db.collection(COLLECTIONS.reports).where('reporterUid', '==', uid).get()).docs) await r.ref.update({ reporterUid: FieldValue.delete(), reporterH: uidH });
    for (const r of (await db.collection(COLLECTIONS.reports).where('targetUid', '==', uid).get()).docs) await r.ref.update({ targetUid: FieldValue.delete(), targetH: uidH });
    await refs.sanction(uid).delete();

    // 6.
    await db.recursiveDelete(db.doc(PATHS.user(uid)));
    await eraseMatchProfileAndAreaCount(deps, uid);
    if (o.storage !== false) {
      await deletePrefix(deps.objects, OBJECT_PATHS.photosPrefix(uid));
      await deletePrefix(deps.objects, OBJECT_PATHS.uploadsPrefix(uid));
      await deletePrefix(deps.objects, OBJECT_PATHS.exportsPrefix(uid));
    }

    // 7. consent events
    for (const e of (await db.collection(COLLECTIONS.consentEvents).where('uid', '==', uid).get()).docs) {
      await e.ref.update({ uid: FieldValue.delete(), uidH, redactedAt: ts(now), expiresAt: ts(now + CONSENT_EVENT_RETENTION_MS) });
    }
  }

  // 4. (uidH-keyed records; these are all a replay can find when the uid is no longer in the database)
  for (const p of (await matchProfiles(db).where('blockedH', 'array-contains', uidH).get()).docs) {
    await p.ref.withConverter(null).update({ blockedH: FieldValue.arrayRemove(uidH) });
  }
  const recent = await db.collection('matchProfiles').where(new FieldPath('recentH', uidH), '>=', '').get();
  for (const p of recent.docs) {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(p.ref);
      const recentH = { ...((fresh.get('recentH') as Record<string, string> | undefined) ?? {}) };
      if (!(uidH in recentH)) return;
      delete recentH[uidH];
      tx.update(p.ref, { [`recentH.${uidH}`]: FieldValue.delete(), recentMinUntil: recentMinUntil(recentH as Record<string, WeekId>) });
    });
  }
  await deleteQuery(deps, db.collection(COLLECTIONS.pairSignals).where('uidHs', 'array-contains', uidH));
  // Admin runs about this user (tools/admin `sanctions lift`) name them only by `subjectH`; the run stays on record,
  // without its target and reason (which may describe the user).
  for (const r of (await db.collection(COLLECTIONS.adminRuns).where('subjectH', '==', uidH).get()).docs) {
    await r.ref.update({ subjectH: FieldValue.delete(), target: ADMIN_RUN_REDACTED, reason: ADMIN_RUN_REDACTED });
  }

  // 7. ledger
  const ledgerRef = o.ledgerId ? erasureLedger(db).doc(o.ledgerId) : erasureLedger(db).doc();
  await ledgerRef.set({ uidH, kind: 'account', at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });

  // 8.
  if (uid && o.auth !== false) await deleteAuthUser(deps, uid);
  // 9. A buildExport that was assembling a file when the purge started deletes its own object on finding the account
  // gone; this second pass catches one written between step 6 and that check.
  if (uid && o.storage !== false) await deletePrefix(deps.objects, OBJECT_PATHS.exportsPrefix(uid));
  return { pods: podCount };
}
