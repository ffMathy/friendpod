/** Cloud Tasks payloads (DESIGN.md §10.2, §10.3). Task ids are deterministic, e.g. `${weekId}-${componentId}`. */
import { z } from 'zod';
import { docIdSchema, podIdSchema, uidSchema, weekIdSchema } from './common';

export const matchComponentTask = z.strictObject({ weekId: weekIdSchema, componentId: z.string().min(5).max(12) });
export const releaseDropTask = z.strictObject({ weekId: weekIdSchema });
export const backfillPodTask = z.strictObject({ weekId: weekIdSchema, podId: podIdSchema });
export const buildExportTask = z.strictObject({ uid: uidSchema, exportId: docIdSchema });
export const deleteExportTask = z.strictObject({ uid: uidSchema, exportId: docIdSchema });
export const purgeUserTask = z.strictObject({ uid: uidSchema });
export const embedderBatchTask = z.strictObject({
  op: z.enum(['rescan', 'reembed', 'maintenance', 'seed']),
  cursor: z.string().max(1500).optional(),
});
