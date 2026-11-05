/**
 * hourlySweeper's non-pod work and dailyMaintenance (DESIGN.md §4.1, §10.3; PRIVACY.md §5). Every step is idempotent
 * and pages through an indexed query, so a retry or a late run is safe; one failing item is logged (without uids) and
 * picked up by the next run.
 */
import { NOTICE_CODES, REPORT_RETENTION_MS, nextDropWeek, toLocal, uidHash, weekIdAt, type WeekId } from '@grouper/core';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { deleteAuthUser, startAccountDeletion } from '../callables/account';
import { DAY_MS, COLLECTIONS, PATHS, docs, erasureLedger, matchProfiles, podStates, ts } from '../lib/firestore';
import { FunnelIncrements } from '../lib/funnel';
import { errorFields } from '../lib/log';
import { writeNotice } from '../lib/notices';
import type { AppDeps } from '../lib/runtime';
import { taskId } from '../lib/tasks';
import { removeHoldings } from '../interests/remove';
import { pruneRecent, recentMinUntil } from '../pods/context';
import { pushTo } from '../pods/effects';

const PAGE = 200;

/** Local weekday of an instant in Europe/Copenhagen: 0 = Sunday … 6 = Saturday. */
export function localWeekday(now: number): number {
  const l = toLocal(now);
  return new Date(Date.UTC(l.year, l.month - 1, l.day)).getUTCDay();
}

async function each<T>(deps: Pick<AppDeps, 'log'>, step: string, items: readonly T[], f: (item: T) => Promise<boolean | void>): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;
  for (const item of items) {
    try {
      if ((await f(item)) !== false) done++;
    } catch (err) {
      failed++;
      deps.log.error('maintenance.itemFailed', { step, ...errorFields(err) });
    }
  }
  return { done, failed };
}

// ---------------------------------------------------------------- hourly: the Monday 10:00 nudge (§4.1)

/**
 * "In this week?" to manual-participation users who have not opted in to this week's drop. The first sweep at or after
 * Monday 10:00 local sends it, once per week (`drops/{weekId}.mondayNudgeAt` is the marker).
 */
export async function mondayNudge(deps: AppDeps, now: number): Promise<{ sent: number; skipped?: string }> {
  const local = toLocal(now);
  if (localWeekday(now) !== 1 || local.hour < 10) return { sent: 0, skipped: 'notMonday' };
  const week = weekIdAt(now);
  const marker = deps.db.doc(`drops/${week}`);
  const first = await deps.db.runTransaction(async (tx) => {
    const snap = await tx.get(marker);
    if (snap.get('mondayNudgeAt') !== undefined) return false;
    tx.set(marker, { mondayNudgeAt: ts(now) }, { merge: true });
    return true;
  });
  if (!first) return { sent: 0, skipped: 'alreadySent' };
  const dropWeek = nextDropWeek(now);
  let sent = 0;
  let after: string | null = null;
  for (;;) {
    let q = matchProfiles(deps.db).where('participation.mode', '==', 'manual').where('status', '==', 'active').orderBy(FieldPath.documentId()).limit(500);
    if (after) q = q.startAfter(after);
    const page = await q.get();
    const uids = page.docs.filter((d) => d.data().participation.optInWeekId !== dropWeek && d.data().participation.skipWeekId !== dropWeek).map((d) => d.id);
    if (uids.length > 0) sent += await pushTo(deps, 'weeklyNudge', uids);
    if (page.size < 500) break;
    after = page.docs[page.docs.length - 1]!.id;
  }
  return { sent };
}

// ---------------------------------------------------------------- daily

/** Recursive deletion of a pod that ended long enough ago (§4.2): the pod with its options and messages, every card, feedback and grant entry, then podState. */
export async function deletePod(deps: AppDeps, podId: string): Promise<boolean> {
  const refs = docs(deps.db);
  const ps = (await refs.podState(podId).get()).data();
  if (!ps) return false;
  await deps.db.recursiveDelete(deps.db.doc(PATHS.pod(podId)));
  for (const m of ps.memberList) {
    await refs.podCard(m, podId).delete();
    await refs.podFeedback(podId, m).delete();
  }
  for (const a of ps.memberList) {
    for (const b of ps.memberList) {
      if (a === b) continue;
      await deps.db.runTransaction(async (tx) => {
        const g = (await tx.get(refs.photoGrant(a, b))).data();
        if (!g?.pods.includes(podId)) return;
        const pods = g.pods.filter((p) => p !== podId);
        if (pods.length === 0) tx.delete(refs.photoGrant(a, b));
        else tx.set(refs.photoGrant(a, b), { ...g, pods });
      });
    }
  }
  await refs.podState(podId).delete();
  return true;
}

export async function deleteEndedPods(deps: AppDeps, now: number) {
  const due = await podStates(deps.db).where('deleteAt', '<=', ts(now)).select().limit(PAGE * 5).get();
  return each(deps, 'endedPods', due.docs.map((d) => d.id), (id) => deletePod(deps, id));
}

/** `pendingConsent` holdings (rescan hits without the consent) after 14 days (§5.2 (8), PRIVACY.md §5). */
export async function deletePendingConsent(deps: AppDeps, now: number) {
  const due = await deps.db.collectionGroup('interests').where('pendingUntil', '<=', ts(now)).limit(PAGE * 5).get();
  return each(deps, 'pendingConsent', due.docs, async (d) => {
    if (d.get('state') !== 'pendingConsent') return false;
    const uid = d.ref.parent.parent!.id;
    await removeHoldings(deps, uid, () => ({ ordinary: [d.id], sensitive: [] }), now);
    return true;
  });
}

/** Expired `recentH` entries of profiles no drop wrote recently (§8.2 `recentMinUntil`). */
export async function pruneRecentH(deps: AppDeps, now: number) {
  const week = weekIdAt(now);
  const due = await matchProfiles(deps.db).where('recentMinUntil', '<=', week).limit(PAGE * 5).get();
  return each(deps, 'recentH', due.docs, (d) =>
    deps.db.runTransaction(async (tx) => {
      const p = (await tx.get(d.ref)).data();
      if (!p || p.recentMinUntil === null || p.recentMinUntil > week) return false;
      const recentH = pruneRecent(p.recentH, week as WeekId);
      tx.set(d.ref, { ...p, recentH, recentMinUntil: recentMinUntil(recentH) });
      return true;
    }),
  );
}

/**
 * Reports are never resolved by hand (F17): an open report keeps the pair apart in matching until it expires
 * (12 months). Two days before that, the pair leaves `blockedH` (unless a block or another open report keeps
 * it), the target's `openReportCount` goes down and the report gets its TTL (`expiresAt`, 12 months after it was filed,
 * never earlier than a day from now). DESIGN-DEVIATION: §8.2 says the pair is removed "at resolution";
 * with no reviewer, the expiry is the resolution.
 */
export async function expireReports(deps: AppDeps, now: number) {
  const cutoff = ts(now - REPORT_RETENTION_MS + 2 * DAY_MS);
  // Open reports only (composite index status + createdAt), so resolved ones can never fill the page and hide them.
  const due = await deps.db.collection(COLLECTIONS.reports).where('status', '==', 'open').where('createdAt', '<=', cutoff).orderBy('createdAt').limit(PAGE * 5).get();
  const hmac = deps.uidHmac();
  return each(deps, 'reports', due.docs, async (r) => {
    if (r.get('status') !== 'open') return false;
    const reporter = r.get('reporterUid') as string | undefined;
    const target = r.get('targetUid') as string | undefined;
    await deps.db.runTransaction(async (tx) => {
      const fresh = await tx.get(r.ref);
      if (fresh.get('status') !== 'open') return;
      const refs = docs(deps.db);
      const reads = reporter && target
        ? await Promise.all([
            tx.get(refs.block(reporter, target)),
            tx.get(refs.block(target, reporter)),
            tx.get(deps.db.collection(COLLECTIONS.reports).where('reporterUid', '==', reporter).where('targetUid', '==', target)),
            tx.get(deps.db.collection(COLLECTIONS.reports).where('reporterUid', '==', target).where('targetUid', '==', reporter)),
            tx.get(refs.matchProfile(reporter)),
            tx.get(refs.matchProfile(target)),
          ] as const)
        : null;
      const targetProfile = target ? (reads ? reads[5] : await tx.get(refs.matchProfile(target))) : null;
      // The TTL starts only now: an open report carries no expiresAt (report()), so it is never deleted unresolved.
      const createdMs = (fresh.get('createdAt') as { toMillis(): number }).toMillis();
      tx.update(r.ref, { status: 'resolved', decision: 'EXPIRED', resolvedAt: ts(now), expiresAt: ts(Math.max(createdMs + REPORT_RETENTION_MS, now + DAY_MS)) });
      if (targetProfile?.exists) tx.update(targetProfile.ref.withConverter(null), { openReportCount: Math.max(0, Number(targetProfile.get('openReportCount') ?? 0) - 1) });
      if (reads && reporter && target) {
        const [b1, b2, q1, q2, pr, pt] = reads;
        const otherOpen = [...q1.docs, ...q2.docs].some((d) => d.id !== r.id && d.get('status') === 'open');
        if (!b1.exists && !b2.exists && !otherOpen) {
          const [hr, ht] = await Promise.all([uidHash(hmac, reporter), uidHash(hmac, target)]);
          if (pr.exists) tx.update(pr.ref.withConverter(null), { blockedH: FieldValue.arrayRemove(ht) });
          if (pt.exists) tx.update(pt.ref.withConverter(null), { blockedH: FieldValue.arrayRemove(hr) });
        }
      }
    });
    return true;
  });
}

/** Inactive 12 months → a warning (in-app notice and push; email waits for the provider, Q17); deleted 30 days later. */
export const INACTIVE_AFTER_MS = 365 * DAY_MS;
export const INACTIVE_GRACE_MS = 30 * DAY_MS;

export async function inactivity(deps: AppDeps, now: number, o: { readonly only?: (uid: string) => boolean } = {}) {
  const only = o.only ?? (() => true);
  const warned = await deps.db.collection('users').where('inactivityWarnedAt', '<=', ts(now)).limit(PAGE * 5).get();
  const r1 = await each(deps, 'inactiveDelete', warned.docs.filter((d) => only(d.id)), async (d) => {
    const warnedAt = (d.get('inactivityWarnedAt') as { toMillis(): number }).toMillis();
    const lastActive = (d.get('lastActiveAt') as { toMillis(): number }).toMillis();
    if (d.get('status') === 'deleting') return false;
    if (lastActive > warnedAt) {
      await d.ref.update({ inactivityWarnedAt: FieldValue.delete() });
      return false;
    }
    if (warnedAt > now - INACTIVE_GRACE_MS) return false;
    await startAccountDeletion(deps, d.id, now);
    return true;
  });
  const stale = await deps.db.collection('users').where('lastActiveAt', '<=', ts(now - INACTIVE_AFTER_MS)).limit(PAGE * 5).get();
  const toWarn = stale.docs.filter((d) => only(d.id) && d.get('inactivityWarnedAt') === undefined && d.get('status') !== 'deleting');
  const r2 = await each(deps, 'inactiveWarn', toWarn, async (d) => {
    const batch = deps.db.batch();
    batch.update(d.ref, { inactivityWarnedAt: ts(now) });
    writeNotice(deps.db, batch, d.id, 'system', NOTICE_CODES.INACTIVITY_WARNING, { deleteAfter: now + INACTIVE_GRACE_MS }, now);
    await batch.commit();
    // A year without opening the app means every token is older than 60 days: the deletion warning still tries them.
    await pushTo(deps, 'notice', [d.id], { includeStale: true });
    return true;
  });
  return { warned: r2.done, deleted: r1.done, failed: r1.failed + r2.failed };
}

/** An Auth user without a `users` doc after 7 days is an abandoned sign-up (§3.1, PRIVACY.md §5). */
export const ABANDONED_SIGNUP_MS = 7 * DAY_MS;

/**
 * Auth reconciliation (§10.3): pages through Auth `listUsers()` and diffs against `users` and `erasureLedger`. An Auth
 * user without a profile is deleted after 7 days (counted as a `signup` in the funnel, its only stage), or at once when
 * the ledger shows the account was erased (a failed Auth deletion), unless its profile appeared meanwhile. A `users`
 * doc without an Auth user is purged only if it predates the listing and `getUser` confirms the Auth user is gone, so a
 * sign-up that races the listing is never erased.
 */
export async function reconcileAuth(deps: AppDeps, now: number, o: { readonly only?: (uid: string) => boolean } = {}) {
  const only = o.only ?? (() => true);
  const listedAt = Math.min(now, deps.now());
  const authUids = new Set<string>();
  let abandoned = 0;
  let purged = 0;
  let pageToken: string | undefined;
  const hmac = deps.uidHmac();
  do {
    const page = await deps.auth.listUsers(1000, pageToken);
    pageToken = page.pageToken;
    const users = page.users.filter((u) => only(u.uid));
    for (const u of page.users) authUids.add(u.uid);
    if (users.length === 0) continue;
    const snaps = await deps.db.getAll(...users.map((u) => deps.db.doc(PATHS.user(u.uid))), { fieldMask: ['status'] });
    const funnel = new FunnelIncrements();
    for (let i = 0; i < users.length; i++) {
      if (snaps[i]!.exists) continue;
      const u = users[i]!;
      const created = Date.parse(u.metadata.creationTime);
      const h = await uidHash(hmac, u.uid);
      const erased = !(await erasureLedger(deps.db).where('uidH', '==', h).where('kind', '==', 'account').limit(1).get()).empty;
      if (!erased && !(created <= now - ABANDONED_SIGNUP_MS)) continue;
      try {
        // A profile written since the batch read (onboarding finished meanwhile) keeps the account.
        if ((await deps.db.doc(PATHS.user(u.uid)).get()).exists) continue;
        await deleteAuthUser(deps, u.uid);
        if (!erased) {
          funnel.stage(null, created, 'signup');
          abandoned++;
        }
      } catch (err) {
        deps.log.error('maintenance.itemFailed', { step: 'authReconcile', ...errorFields(err) });
      }
    }
    if (!funnel.isEmpty) {
      const batch = deps.db.batch();
      funnel.write(deps.db, batch);
      await batch.commit();
    }
  } while (pageToken);

  let after: string | null = null;
  const day = new Date(now).toISOString().slice(0, 10);
  for (;;) {
    let q = deps.db.collection('users').orderBy(FieldPath.documentId()).select('status', 'createdAt').limit(500);
    if (after) q = q.startAfter(after);
    const page = await q.get();
    for (const d of page.docs) {
      if (authUids.has(d.id) || !only(d.id)) continue;
      // An account created after the listing started may simply be missing from it (paging): never an orphan.
      const createdMs = (d.get('createdAt') as { toMillis?: () => number } | undefined)?.toMillis?.();
      if (createdMs === undefined || createdMs >= listedAt) continue;
      try {
        // Confirmed one by one: only an Auth user that is really gone makes the profile an orphan.
        if (await authUserExists(deps, d.id)) continue;
        await startAccountDeletion(deps, d.id, now, day);
        purged++;
      } catch (err) {
        deps.log.error('maintenance.itemFailed', { step: 'orphanUsers', ...errorFields(err) });
      }
    }
    if (page.size < 500) break;
    after = page.docs[page.docs.length - 1]!.id;
  }
  return { abandoned, purged };
}

async function authUserExists(deps: Pick<AppDeps, 'auth'>, uid: string): Promise<boolean> {
  try {
    await deps.auth.getUser(uid);
    return true;
  } catch (err) {
    if ((err as { code?: unknown }).code === 'auth/user-not-found') return false;
    throw err;
  }
}

/** Wednesdays: weekly interest maintenance (§5.2 (8)), once per week by task id. */
export async function wednesdayInterests(deps: AppDeps, now: number): Promise<boolean> {
  if (localWeekday(now) !== 3) return false;
  return (await deps.tasks.enqueue('interestsBatch', { op: 'maintenance' }, { id: taskId('interests-maintenance', weekIdAt(now)), dispatchDeadlineSeconds: 1800 })) === 'enqueued';
}

export async function dailyMaintenance(deps: AppDeps, now: number): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const steps: [string, () => Promise<Record<string, number> | { done: number; failed: number } | boolean>][] = [
    ['endedPods', () => deleteEndedPods(deps, now)],
    ['pendingConsent', () => deletePendingConsent(deps, now)],
    ['recentH', () => pruneRecentH(deps, now)],
    ['reports', () => expireReports(deps, now)],
    ['inactivity', () => inactivity(deps, now)],
    ['auth', () => reconcileAuth(deps, now)],
    ['interests', () => wednesdayInterests(deps, now)],
  ];
  let failures = 0;
  for (const [name, f] of steps) {
    try {
      const r = await f();
      if (typeof r === 'boolean') out[name] = r ? 1 : 0;
      else for (const [k, v] of Object.entries(r)) out[`${name}.${k}`] = v;
    } catch (err) {
      failures++;
      deps.log.error('maintenance.stepFailed', { step: name, ...errorFields(err) });
    }
  }
  if (failures > 0) throw new Error(`dailyMaintenance: ${failures} step(s) failed`);
  return out;
}

