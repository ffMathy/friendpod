/**
 * onPhotoUploaded (DESIGN.md §9 Photos, §10.3): the app uploads `uploads/{uid}/pending.jpg` and `pending_256.jpg`
 * (fixed names, ≤ 2 MB, owner only). Each finalize event tries to process the pair; the event that finds both does it:
 *   1. the `uploads` kill switch (`config/app.features.uploads`, §9) — off: the upload is deleted unprocessed;
 *   2. both objects are read and sanitised (APP1–APP15 and COM dropped, sizes checked); invalid → both deleted;
 *   3. the pair is claimed by deleting it with a generation precondition, so a concurrent event stops here;
 *   4. the per-uid daily limit (5 processed uploads per day, §4.3) — over it nothing is written;
 *   5. `photos/{uid}/{v+1}.jpg` and `{v+1}_256.jpg` (`cacheControl: private, max-age=3600`, no download token), then
 *      `users.photo.v`, every roster `photoV` where the photo is shared and the grants of the user's current pods
 *      (sensitive-themed pods only after the S6 opt-in), then every earlier version is deleted.
 */
import { podDocSchema } from '@friendpod/core';
import { blockedPairs, pairOf } from '../lib/blocks';
import { AppError } from '../lib/errors';
import { DAY_MS, PATHS, docs, ts } from '../lib/firestore';
import { OBJECT_PATHS } from '../lib/objects';
import { rateLimitKey, takeWindow } from '../lib/rateLimits';
import type { AppDeps } from '../lib/runtime';
import { sizeOk, stripJpeg } from './jpeg';

export const PHOTO_UPLOADS_PER_DAY = 5;
export const PHOTO_BUCKET = 'photoUploads';
export const PHOTO_CACHE_CONTROL = 'private, max-age=3600';

export type PhotoOutcome = 'disabled' | 'waiting' | 'invalid' | 'duplicate' | 'limited' | 'gone' | 'processed';

const UPLOAD = /^uploads\/([^/]+)\/pending(?:_256)?\.jpg$/;
const ACTIVE_STATES = new Set(['planning', 'scheduled', 'happened']);

export async function uploadsEnabled(deps: Pick<AppDeps, 'db'>, path = PATHS.configApp()): Promise<boolean> {
  return (await deps.db.doc(path).get()).get('features.uploads') !== false;
}

export async function processUpload(deps: AppDeps, objectName: string, o: { readonly configPath?: string } = {}): Promise<{ outcome: PhotoOutcome; v?: number }> {
  const m = UPLOAD.exec(objectName);
  if (!m) return { outcome: 'gone' };
  const uid = m[1]!;
  const store = deps.objects;
  const mainPath = OBJECT_PATHS.pendingUpload(uid);
  const thumbPath = OBJECT_PATHS.pendingThumb(uid);
  const [main, thumb] = await Promise.all([store.stat(mainPath), store.stat(thumbPath)]);

  if (!(await uploadsEnabled(deps, o.configPath))) {
    if (main) await store.deleteGeneration(mainPath, main.generation);
    if (thumb) await store.deleteGeneration(thumbPath, thumb.generation);
    return { outcome: 'disabled' };
  }
  if (!main || !thumb) return { outcome: 'waiting' };

  const [full, small] = await Promise.all([store.read(mainPath), store.read(thumbPath)]);
  const a = stripJpeg(full);
  const b = stripJpeg(small);
  const claimed = await store.deleteGeneration(mainPath, main.generation);
  if (!claimed) return { outcome: 'duplicate' };
  await store.deleteGeneration(thumbPath, thumb.generation);
  if (!a || !b || !sizeOk(a, 'full') || !sizeOk(b, 'thumb')) return { outcome: 'invalid' };

  const refs = docs(deps.db);
  const now = deps.now();
  const bucketRef = refs.rateLimit(rateLimitKey(uid, PHOTO_BUCKET));
  let previous: number;
  try {
    previous = await deps.db.runTransaction(async (tx) => {
      const [user, bucket] = await Promise.all([tx.get(refs.user(uid)), tx.get(bucketRef)]);
      const u = user.data();
      if (!u || u.status === 'deleting') throw new AppError('NOT_FOUND');
      const next = takeWindow(bucket.data(), now, { limit: PHOTO_UPLOADS_PER_DAY, windowMs: DAY_MS });
      if (!next) throw new AppError('RATE_LIMITED');
      tx.set(bucketRef, next);
      return u.photo?.v ?? 0;
    });
  } catch (err) {
    if (err instanceof AppError) return { outcome: err.code === 'RATE_LIMITED' ? 'limited' : 'gone' };
    throw err;
  }

  const v = previous + 1;
  await store.write(OBJECT_PATHS.photo(uid, v), a.bytes, { contentType: 'image/jpeg', cacheControl: PHOTO_CACHE_CONTROL });
  await store.write(OBJECT_PATHS.photoThumb(uid, v), b.bytes, { contentType: 'image/jpeg', cacheControl: PHOTO_CACHE_CONTROL });
  const bumped = await deps.db.runTransaction(async (tx) => {
    const u = (await tx.get(refs.user(uid))).data();
    if (!u || u.status === 'deleting' || (u.photo?.v ?? 0) !== previous) return false;
    tx.set(refs.user(uid), { ...u, photo: { v } });
    return true;
  });
  if (!bumped) {
    await store.delete(OBJECT_PATHS.photo(uid, v));
    await store.delete(OBJECT_PATHS.photoThumb(uid, v));
    return { outcome: 'duplicate' };
  }

  await shareInPods(deps, uid, v, now);
  for (const name of await store.list(OBJECT_PATHS.photosPrefix(uid))) {
    if (name !== OBJECT_PATHS.photo(uid, v) && name !== OBJECT_PATHS.photoThumb(uid, v)) await store.delete(name);
  }
  return { outcome: 'processed', v };
}

/** Roster `photoV` and the user's outgoing grants in every pod they are a current member of (S6 for sensitive themes). */
async function shareInPods(deps: AppDeps, uid: string, v: number, now: number): Promise<void> {
  const refs = docs(deps.db);
  const pods = await deps.db.collection('pods').where('memberUids', 'array-contains', uid).get();
  for (const p of pods.docs) {
    await deps.db.runTransaction(async (tx) => {
      const pod = (await tx.get(refs.pod(p.id))).data();
      const entry = pod?.roster[uid];
      if (!pod || !entry) return;
      const sensitive = pod.theme.kind === 'concept' && pod.theme.sensitive;
      const card = (await tx.get(refs.podCard(uid, p.id))).data();
      const shared = sensitive ? card?.photoShared === true : true;
      const active = ACTIVE_STATES.has(pod.state);
      // Never to someone blocked in either direction (§3.7), even if they still share the pod.
      const members = pod.memberUids.filter((x) => x !== uid);
      const blocked = active && shared ? await blockedPairs(tx, deps.db, members.map((x) => [uid, x] as const)) : new Set<string>();
      const viewers = members.filter((x) => !blocked.has(pairOf(uid, x)));
      const grants = active && shared && viewers.length > 0 ? await tx.getAll(...viewers.map((x) => refs.photoGrant(uid, x))) : [];
      if (shared && (active || entry.photoV !== null)) tx.set(refs.pod(p.id), podDocSchema.parse({ ...pod, roster: { ...pod.roster, [uid]: { ...entry, photoV: v } } }));
      grants.forEach((g, i) => {
        const d = g.data();
        if (d?.pods.includes(p.id)) return;
        tx.set(refs.photoGrant(uid, viewers[i]!), { pods: [...(d?.pods ?? []), p.id].sort(), createdAt: d?.createdAt ?? ts(now) });
      });
    });
  }
}
