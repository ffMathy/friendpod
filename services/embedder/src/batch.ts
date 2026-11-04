/**
 * embedderBatch (DESIGN.md §10.2): rescan, reembed, maintenance and seed runs. Enqueuers pass
 * `dispatchDeadlineSeconds: 1800` and a deterministic task id; each run is meant to stop after about
 * 20 minutes of work and re-enqueue itself with a cursor, so no dispatch reaches the 30-minute limit.
 */
import { embedderBatchTask } from '@grouper/core';
import { parseSafely } from '@grouper/core/node';
import { NotImplementedError, ValidationError } from './lib/errors';

export async function runEmbedderBatch(request: { readonly data: unknown }): Promise<void> {
  const parsed = parseSafely(embedderBatchTask, request.data);
  if (!parsed.ok) throw new ValidationError(parsed.issues);
  // TODO(M1): rescan and maintenance (§5.2 (8)); reembed and seed at the model gate and the seed review.
  throw new NotImplementedError(`embedderBatch op ${parsed.data.op}`, '§5.2 (8), §10.2');
}
