/**
 * hourlySweeper's pod work (DESIGN.md §4.1, §4.6, §10.3): every podState whose `dueAt` has passed gets one
 * transaction that processes all of its due timers in order (`advance`). Pods are independent: one failure is logged
 * and the next hourly run picks it up again, because nothing marks a timer done until its transaction commits.
 */
import { FieldPath } from 'firebase-admin/firestore';
import { ts } from '../lib/firestore';
import { errorFields } from '../lib/log';
import type { AppDeps } from '../lib/runtime';
import { withPod } from './effects';
import { advance } from './transitions';

const PAGE = 200;

export async function sweepPods(deps: AppDeps, now: number): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  let after: { dueAt: unknown; id: string } | null = null;
  for (;;) {
    let q = deps.db.collection('podState').where('dueAt', '<=', ts(now)).orderBy('dueAt').orderBy(FieldPath.documentId()).select('dueAt').limit(PAGE);
    if (after) q = q.startAfter(after.dueAt, after.id);
    const page = await q.get();
    for (const doc of page.docs) {
      try {
        await withPod(deps, doc.id, now, (ctx) => advance(ctx));
        processed++;
      } catch (err) {
        failed++;
        deps.log.error('sweeper.podFailed', errorFields(err));
      }
    }
    if (page.size < PAGE) break;
    const last = page.docs[page.docs.length - 1]!;
    after = { dueAt: last.get('dueAt'), id: last.id };
  }
  return { processed, failed };
}
