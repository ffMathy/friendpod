/**
 * Account and data callables (DESIGN.md §3.9, §3.10, §9 Photos, §10.1): registerPushToken, deletePhoto, exportData and
 * deleteAccount. exportData and deleteAccount need a sign-in within 5 minutes and a replay-protected App Check token;
 * the callable wrapper checks both before any of this runs (handler.ts).
 */
import { uidHash, type CallableInput, type CallableOutput } from '@friendpod/core';
import { FieldPath } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { HOUR_MS } from '@friendpod/core';
import { DAY_MS, ERASURE_LEDGER_TTL_MS, docs, erasureLedger, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import { OBJECT_PATHS, deletePrefix } from '../lib/objects';
import { upsertToken } from '../lib/pushTokens';
import { rateLimitKey, takeWindow } from '../lib/rateLimits';
import type { AppDeps } from '../lib/runtime';
import { taskId } from '../lib/tasks';

export const PUSH_TOKEN_BUCKET = 'pushToken';
export const PUSH_TOKEN_CALLS_PER_HOUR = 30;
export const EXPORT_BUCKET = 'exportData';
/** One export per 24 h (§4.3). */
export const EXPORTS_PER_DAY = 1;

/** Charges one take of a per-uid bucket in its own transaction; RATE_LIMITED when the window is full. */
async function take(deps: AppDeps, uid: string, bucket: string, limit: number, windowMs: number, now: number): Promise<void> {
  const ref = docs(deps.db).rateLimit(rateLimitKey(uid, bucket));
  const ok = await deps.db.runTransaction(async (tx) => {
    const user = (await tx.get(docs(deps.db).user(uid))).data();
    if (!user) throw new AppError('NOT_FOUND');
    if (user.status === 'deleting') throw new AppError('STATE');
    const next = takeWindow((await tx.get(ref)).data(), now, { limit, windowMs });
    if (!next) return false;
    tx.set(ref, next);
    return true;
  });
  if (!ok) throw new AppError('RATE_LIMITED');
}

export async function registerPushToken(deps: AppDeps, call: CallContext, input: CallableInput<'registerPushToken'>): Promise<CallableOutput<'registerPushToken'>> {
  await take(deps, call.uid, PUSH_TOKEN_BUCKET, PUSH_TOKEN_CALLS_PER_HOUR, HOUR_MS, call.now);
  await upsertToken(deps, call.uid, input.token, input.platform, call.now);
  return { ok: true };
}

/** Outgoing photo grants are `photoGrants/{uid}_{viewer}`: a document-id prefix range finds them all. */
export async function outgoingGrants(deps: Pick<AppDeps, 'db'>, uid: string) {
  return (
    await deps.db
      .collection('photoGrants')
      .orderBy(FieldPath.documentId())
      .startAt(`${uid}_`)
      .endAt(`${uid}_`)
      .get()
  ).docs;
}

/**
 * deletePhoto (§9, §10.1): every `photos/{uid}/*` version and any pending upload, `users.photo` and every roster
 * `photoV`, the caller's outgoing grants, and an erasure-ledger entry (`photo`, the deleted version). Idempotent.
 */
export async function erasePhoto(deps: AppDeps, uid: string, now: number, o: { readonly ledger: { readonly uidH: string; readonly id?: string } | null; readonly storage?: boolean }): Promise<number | null> {
  const refs = docs(deps.db);
  if (o.storage !== false) {
    await deletePrefix(deps.objects, OBJECT_PATHS.uploadsPrefix(uid));
    await deletePrefix(deps.objects, OBJECT_PATHS.photosPrefix(uid));
  }
  const v = await deps.db.runTransaction(async (tx) => {
    const user = (await tx.get(refs.user(uid))).data();
    const had = user?.photo?.v ?? null;
    if (user && user.photo !== null) tx.set(refs.user(uid), { ...user, photo: null });
    if (o.ledger && (had !== null || o.ledger.id)) {
      const ref = o.ledger.id ? erasureLedger(deps.db).doc(o.ledger.id) : erasureLedger(deps.db).doc();
      tx.set(ref, { uidH: o.ledger.uidH, kind: 'photo', ...(had !== null ? { ref: String(had) } : {}), at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    }
    return had;
  });
  const pods = await deps.db.collection('pods').where('memberUids', 'array-contains', uid).get();
  for (const p of pods.docs) {
    await deps.db.runTransaction(async (tx) => {
      const pod = (await tx.get(refs.pod(p.id))).data();
      const card = (await tx.get(refs.podCard(uid, p.id))).data();
      const entry = pod?.roster[uid];
      if (pod && entry && entry.photoV !== null) tx.set(refs.pod(p.id), { ...pod, roster: { ...pod.roster, [uid]: { ...entry, photoV: null } } });
      if (card?.photoShared) tx.set(refs.podCard(uid, p.id), { ...card, photoShared: false });
    });
  }
  for (const g of await outgoingGrants(deps, uid)) await g.ref.delete();
  return v;
}

export async function deletePhoto(deps: AppDeps, call: CallContext): Promise<CallableOutput<'deletePhoto'>> {
  await erasePhoto(deps, call.uid, call.now, { ledger: { uidH: await call.uidH() } });
  return { ok: true };
}

/** exportData (§3.9): 1 per 24 h; `buildExport` assembles the file in the background and leaves a notice. */
export async function exportData(deps: AppDeps, call: CallContext): Promise<CallableOutput<'exportData'>> {
  await take(deps, call.uid, EXPORT_BUCKET, EXPORTS_PER_DAY, DAY_MS, call.now);
  const ref = docs(deps.db).export(call.uid, deps.db.collection('x').doc().id);
  await ref.set({ status: 'pending', expiresAt: ts(call.now + DAY_MS) });
  try {
    await deps.tasks.enqueue('buildExport', { uid: call.uid, exportId: ref.id }, { id: taskId('export', ref.id) });
  } catch (err) {
    await ref.set({ status: 'failed', expiresAt: ts(call.now + DAY_MS) });
    throw err;
  }
  return { exportId: ref.id };
}

/** The purge task id: deterministic per user, without the uid itself (task names show up in Cloud Tasks logs). */
export async function purgeTaskId(deps: Pick<AppDeps, 'uidHmac'>, uid: string, suffix?: string): Promise<string> {
  const h = await uidHash(deps.uidHmac(), uid);
  return suffix ? taskId('purge', h, suffix) : taskId('purge', h);
}

/**
 * deleteAccount (§3.10, PRIVACY.md §6 step 1): `status: deleting` on the account and its match profile (matching and
 * release revalidation drop it at once, and nothing recreates its subtree), the purge enqueued, then the Auth user
 * deleted. Apple token revocation has already happened on the device. A retry is safe.
 */
export async function startAccountDeletion(deps: AppDeps, uid: string, now: number, taskSuffix?: string): Promise<void> {
  const refs = docs(deps.db);
  await deps.db.runTransaction(async (tx) => {
    const [u, p] = await Promise.all([tx.get(refs.user(uid)), tx.get(refs.matchProfile(uid))]);
    const user = u.data();
    const profile = p.data();
    if (user && user.status !== 'deleting') tx.set(refs.user(uid), { ...user, status: 'deleting' });
    if (profile && profile.status !== 'deleting') tx.set(refs.matchProfile(uid), { ...profile, status: 'deleting', updatedAt: ts(now) });
  });
  await deps.tasks.enqueue('purgeUser', { uid }, { id: await purgeTaskId(deps, uid, taskSuffix) });
  await deleteAuthUser(deps, uid);
}

export async function deleteAuthUser(deps: Pick<AppDeps, 'auth'>, uid: string): Promise<boolean> {
  try {
    await deps.auth.deleteUser(uid);
    return true;
  } catch (err) {
    if ((err as { code?: unknown }).code === 'auth/user-not-found') return false;
    throw err;
  }
}

export async function deleteAccount(deps: AppDeps, call: CallContext): Promise<CallableOutput<'deleteAccount'>> {
  await startAccountDeletion(deps, call.uid, call.now);
  return { ok: true };
}

/**
 * `appOpened` (§8.1): the app calls it at start and when it returns to the foreground. The work is done by the
 * onboarded-callable wrapper (withActivity), which moves `lastActiveAt` at most once a day, so an app with
 * notifications off (no registerPushToken) still keeps its account out of the inactivity deletion.
 */
export async function appOpened(): Promise<CallableOutput<'appOpened'>> {
  return { ok: true };
}
