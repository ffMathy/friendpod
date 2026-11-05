/** Cloud Tasks payloads (DESIGN.md §10.2, §10.3). Task ids are deterministic, e.g. `${weekId}-${componentId}`. */
import { z } from 'zod';
import { docIdSchema, podIdSchema, uidSchema, weekIdSchema } from './common';

export const matchComponentTask = z.strictObject({ weekId: weekIdSchema, componentId: z.string().min(5).max(12) });
export const releaseDropTask = z.strictObject({ weekId: weekIdSchema });
export const backfillPodTask = z.strictObject({ weekId: weekIdSchema, podId: podIdSchema });
export const buildExportTask = z.strictObject({ uid: uidSchema, exportId: docIdSchema });
export const deleteExportTask = z.strictObject({ uid: uidSchema, exportId: docIdSchema });
export const purgeUserTask = z.strictObject({ uid: uidSchema });
/**
 * Interest batch work in the default codebase (D1). Only what stored vectors allow: re-classify tags after a lexicon,
 * prototype or known-ordinary change, and weekly maintenance. Embedding (seeds, a model upgrade) happens offline with
 * the pinned model, never in a Function.
 */
export const interestsBatchTask = z.strictObject({
  op: z.enum(['rescan', 'maintenance']),
  cursor: z.string().max(1500).optional(),
});
/**
 * An area went live (admin CLI `areas set-status <areaId> live`): mark every user in it `firstDropEligible` (once per
 * user) and send the "<city> is open" push to those newly marked. Idempotent; enqueued with task id `open-{areaId}`.
 */
export const openAreaTask = z.strictObject({ areaId: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/) });
