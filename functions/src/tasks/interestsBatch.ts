/**
 * interestsBatch (DESIGN.md §5.2 (8), §10.2), enqueued by dailyMaintenance on Wednesdays. `maintenance` walks every
 * concept: recomputes `sum`, `n`, centroid and `c128` from its member tags (removing any drift of the incremental
 * updates), deletes empty non-seed concepts, and for non-sensitive concepts recomputes `holderCount` (ordinary
 * holdings) and each locale's label (the most common wording among ordinary holders of that language). Sensitive
 * concepts get no label and no count. Each run stops after about 20 minutes and re-enqueues itself with a cursor.
 * Stored tags are never re-classified here (F38): their sensitivity was the first writer's on-device result.
 */
import { EMBEDDING_MODEL } from '@grouper/core';
import { FieldPath, FieldValue, type DocumentSnapshot, type Query, type QuerySnapshot } from 'firebase-admin/firestore';
import { ts } from '../lib/firestore';
import type { AppDeps } from '../lib/runtime';
import { taskId } from '../lib/tasks';
import { C128_DIM } from '../interests/config';
import { vectorFromField } from '../interests/assign';
import { addInto, fromF32Bytes, normalized, toF32Bytes, truncateNormalize } from '../interests/vectors';

export const BATCH_BUDGET_MS = 20 * 60_000;
const PAGE = 100;
/** Wednesday maintenance alerts engineering once active concepts approach the stage-2 shortlist (§5.2 (6)). */
export const CONCEPT_COUNT_ALERT = 15_000;

interface Member {
  readonly vec: Float32Array;
  readonly own: boolean;
  readonly norm: string;
  readonly langHints: { da: number; en: number };
  readonly ordinaryTag: boolean;
}

type QueryReader = (q: Query) => Promise<QuerySnapshot>;

async function membersOf(deps: Pick<AppDeps, 'db'>, conceptId: string, read: QueryReader = (q) => q.get()): Promise<Member[]> {
  const tags = deps.db.collection('tags');
  const [own, priv, ord] = await Promise.all([
    read(tags.where('conceptId', '==', conceptId)),
    read(tags.where('privateAssign.conceptId', '==', conceptId)),
    read(tags.where('ordinaryAssign.conceptId', '==', conceptId)),
  ]);
  const out = new Map<string, Member>();
  const add = (d: DocumentSnapshot, own: boolean, count: number) => {
    if (count <= 0 || out.has(d.id)) return;
    out.set(d.id, {
      vec: vectorFromField(d.get('vec'), EMBEDDING_MODEL.dim),
      own,
      norm: String(d.get('norm')),
      langHints: { da: Number(d.get('langHints.da') ?? 0), en: Number(d.get('langHints.en') ?? 0) },
      ordinaryTag: d.get('sens.sensitive') !== true,
    });
  };
  for (const d of own.docs) add(d, true, Number(d.get('refCount') ?? 0));
  for (const d of priv.docs) add(d, false, Number(d.get('privateAssign.refCount') ?? 0));
  for (const d of ord.docs) add(d, false, Number(d.get('ordinaryAssign.refCount') ?? 0));
  return [...out.values()];
}

export async function maintainConcept(deps: Pick<AppDeps, 'db'>, snap: DocumentSnapshot, now: number): Promise<'deleted' | 'updated' | 'unchanged'> {
  const dim = EMBEDDING_MODEL.dim;
  const members = await membersOf(deps, snap.id);
  const sensitive = snap.get('sensitive') === true;
  if (members.length === 0) {
    if (snap.get('seed') === true) return 'unchanged';
    // addInterests may assign a tag to this concept between the scan and the delete: the transaction reads the member
    // tags and the concept again (any change to either makes it retry) and deletes only a concept that is still empty
    // and unchanged since the scan.
    const deleted = await deps.db.runTransaction(async (tx) => {
      const fresh = await tx.get(snap.ref);
      if (!fresh.exists || fresh.get('seed') === true || fresh.get('n') !== snap.get('n')) return false;
      if ((await membersOf(deps, snap.id, (q) => tx.get(q))).length > 0) return false;
      tx.delete(snap.ref);
      return true;
    });
    return deleted ? 'deleted' : 'unchanged';
  }
  const sum = new Float32Array(dim);
  for (const m of members) addInto(sum, m.vec, 1);
  const data: Record<string, unknown> = {};
  const stored = snap.get('sum') as Uint8Array | undefined;
  const old = stored ? fromF32Bytes(stored, dim) : null;
  const drift = old ? sum.reduce((mx, x, i) => Math.max(mx, Math.abs(x - old[i]!)), 0) : Infinity;
  if (drift > 1e-4 || snap.get('n') !== members.length) {
    const centroid = normalized(sum);
    Object.assign(data, { sum: toF32Bytes(sum), n: members.length, centroid: FieldValue.vector(Array.from(centroid)), c128: toF32Bytes(truncateNormalize(centroid, C128_DIM)) });
  }
  if (!sensitive) {
    const holders = (await deps.db.collectionGroup('interests').where('conceptId', '==', snap.id).count().get()).data().count;
    const labels: { da?: string; en?: string } = {};
    for (const locale of ['da', 'en'] as const) {
      const best = members.filter((m) => m.own && m.ordinaryTag && m.langHints[locale] > 0).sort((a, b) => b.langHints[locale] - a.langHints[locale] || (a.norm < b.norm ? -1 : 1))[0];
      if (best) labels[locale] = best.norm;
    }
    if (holders !== snap.get('holderCount')) data.holderCount = holders;
    if (JSON.stringify(labels) !== JSON.stringify(snap.get('labels') ?? {})) data.labels = labels;
  }
  if (Object.keys(data).length === 0) return 'unchanged';
  await snap.ref.update({ ...data, updatedAt: ts(now) });
  return 'updated';
}

export async function interestsMaintenance(deps: AppDeps, cursor: string | undefined): Promise<{ outcome: 'done' | 'continued'; concepts: number; updated: number; deleted: number }> {
  const started = deps.now();
  let after = cursor ?? null;
  let concepts = 0;
  let updated = 0;
  let deleted = 0;
  let active = 0;
  for (;;) {
    let q = deps.db.collection('concepts').orderBy(FieldPath.documentId()).limit(PAGE);
    if (after) q = q.startAfter(after);
    const page = await q.get();
    for (const c of page.docs) {
      concepts++;
      if (c.get('status') === 'active') active++;
      const r = await maintainConcept(deps, c, deps.now());
      if (r === 'updated') updated++;
      if (r === 'deleted') deleted++;
    }
    if (page.size < PAGE) break;
    after = page.docs[page.docs.length - 1]!.id;
    if (deps.now() - started > BATCH_BUDGET_MS) {
      await deps.tasks.enqueue('interestsBatch', { op: 'maintenance', cursor: after }, { id: taskId('interests-maintenance', after), dispatchDeadlineSeconds: 1800 });
      return { outcome: 'continued', concepts, updated, deleted };
    }
  }
  // Uid-free metric: the count only covers this run's part when it continued from a cursor.
  deps.log.info('interests.maintenance', { concepts, active, updated, deleted, fromCursor: cursor !== undefined });
  if (active >= CONCEPT_COUNT_ALERT) deps.log.warn('interests.conceptCountHigh', { active });
  return { outcome: 'done', concepts, updated, deleted };
}
