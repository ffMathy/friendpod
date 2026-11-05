/**
 * Deployment constants shared by codebase "default" (functions/) and the admin CLI (tools/admin), so the two cannot
 * drift (DESIGN.md §7, §10.3).
 */

/** Region of every function, Firestore and the default bucket (§7). */
export const FUNCTIONS_REGION = 'europe-west1';

/** `dispatchDeadlineSeconds` of the long tasks: matchComponent, releaseDrop, interestsBatch, openArea (§10.3). */
export const LONG_TASK_DISPATCH_DEADLINE_SECONDS = 1800;

/** `openArea` runs for at most 1,800 s (functions TASK_OPTIONS.openArea; the admin CLI enqueues it). */
export const OPEN_AREA_DISPATCH_DEADLINE_SECONDS = LONG_TASK_DISPATCH_DEADLINE_SECONDS;

/** The deterministic task id of an area's `openArea` task (§10.3). */
export function openAreaTaskId(areaId: string): string {
  return `open-${areaId}`;
}
