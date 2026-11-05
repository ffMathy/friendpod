/**
 * Cloud Tasks enqueueing behind a small interface (DESIGN.md §10.3), so callables, tasks and the scheduler can be
 * tested without the Tasks emulator. Every task carries a deterministic id: a duplicate is reported as `exists`,
 * which makes every enqueue idempotent.
 */
import type { App } from 'firebase-admin/app';
import { getFunctions } from 'firebase-admin/functions';
import { REGION } from './options';

export type TaskQueueName = 'matchComponent' | 'releaseDrop' | 'backfillPod';

export interface TaskOptions {
  /** Deterministic task id (letters, digits, `-` and `_`). */
  readonly id: string;
  /** Epoch ms; absent → now. */
  readonly scheduleTime?: number;
  readonly dispatchDeadlineSeconds?: number;
}

export interface TaskEnqueuer {
  enqueue(queue: TaskQueueName, data: Record<string, unknown>, options: TaskOptions): Promise<'enqueued' | 'exists'>;
}

/** Cloud Task ids allow letters, digits, hyphens and underscores only. */
export function taskId(...parts: readonly string[]): string {
  return parts.join('-').replace(/[^A-Za-z0-9_-]/g, '_');
}

export function cloudTasks(app: () => App): TaskEnqueuer {
  return {
    async enqueue(queue, data, o) {
      const q = getFunctions(app()).taskQueue(`locations/${REGION}/functions/${queue}`);
      try {
        await q.enqueue(data, {
          id: o.id,
          ...(o.scheduleTime !== undefined && o.scheduleTime > Date.now() ? { scheduleTime: new Date(o.scheduleTime) } : {}),
          ...(o.dispatchDeadlineSeconds !== undefined ? { dispatchDeadlineSeconds: o.dispatchDeadlineSeconds } : {}),
        });
        return 'enqueued';
      } catch (err) {
        if ((err as { code?: unknown } | null)?.code === 'functions/task-already-exists') return 'exists';
        throw err;
      }
    },
  };
}
