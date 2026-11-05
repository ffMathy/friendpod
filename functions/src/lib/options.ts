/**
 * Deployment options for codebase "default" (DESIGN.md §7, §9, §10). Every function spreads one of these
 * explicitly instead of relying on setGlobalOptions(), so a function's options do not depend on import order.
 */
import { CALLABLES, FUNCTIONS_REGION, LONG_TASK_DISPATCH_DEADLINE_SECONDS, type CallableName } from '@grouper/core';
import type { CallableOptions } from 'firebase-functions/https';
import type { GlobalOptions } from 'firebase-functions/options';
import { UID_HMAC_KEY } from './secrets';

export const REGION = FUNCTIONS_REGION;
/** `sa-api@<project>.iam.gserviceaccount.com`; the CLI expands the trailing `@` (§9 IAM). */
export const SERVICE_ACCOUNT = 'sa-api@';

/** Main codebase defaults: gcf_gen1 is the cost lever for rare callables (§7, §12). */
export const BASE_OPTIONS = {
  region: REGION,
  memory: '256MiB',
  cpu: 'gcf_gen1',
  concurrency: 1,
  maxInstances: 10,
  minInstances: 0,
  serviceAccount: SERVICE_ACCOUNT,
} as const satisfies GlobalOptions;

/** Absorbs the Thursday 18:00 burst on one instance; Cloud Run allows concurrency > 1 only with ≥ 1 vCPU (§7). */
export const HOT_OPTIONS = { cpu: 1, memory: '512MiB', concurrency: 40, maxInstances: 20 } as const satisfies GlobalOptions;

/** Drop compute and release: 1 vCPU / 1 GiB, 1,800 s (§10.3). */
export const HEAVY_OPTIONS = { cpu: 1, memory: '1GiB', concurrency: 1, timeoutSeconds: LONG_TASK_DISPATCH_DEADLINE_SECONDS } as const satisfies GlobalOptions;

export const HOT_CALLABLES: ReadonlySet<CallableName> = new Set<CallableName>(['respondToPod', 'voteOption', 'registerPushToken', 'confirmAttendance']);

export function callableOptions(name: CallableName): CallableOptions {
  const spec = CALLABLES[name];
  return {
    ...BASE_OPTIONS,
    ...(HOT_CALLABLES.has(name) ? HOT_OPTIONS : {}),
    enforceAppCheck: true,
    // Replay protection needs a limited-use token from the client and the alreadyConsumed check in handler.ts (§9).
    ...(spec.replayProtected ? { consumeAppCheckToken: true } : {}),
    // Every callable logs uidH on unexpected errors; completeOnboarding also hashes the email (§3.1).
    secrets: [UID_HMAC_KEY],
  };
}
