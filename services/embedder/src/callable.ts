/**
 * The addInterests callable (DESIGN.md §10.2), independent of how it is deployed so tests can drive it.
 * Order matters: Auth → App Check → onboarding → kill switch → in-memory pre-checks → input schema → per-uid window
 * in Firestore → only then the model (warm-up) or the pipeline. Nothing about the request body is logged.
 */
import { CALLABLES, type CallableOutput } from '@grouper/core';
import { parseSafely } from '@grouper/core/node';
import type { CallableRequest } from 'firebase-functions/https';
import { AppError, ValidationError } from './lib/errors';
import { scrubbed } from './lib/handler';
import { clientIp, type MemoryWindow } from './lib/limits';
import type { Metrics } from './lib/metrics';
import { addInterests, type PipelineDeps } from './pipeline';

export interface CallableDeps extends PipelineDeps {
  readonly embedderEnabled: (nowMs: number) => Promise<boolean>;
  /** Firestore-backed per-uid window (`rateLimits/{uid}_addInterests`). */
  readonly takeUidCall: (uid: string, now: Date) => Promise<boolean>;
  /** Per-instance pre-checks; never stored or logged. */
  readonly uidWindow: MemoryWindow;
  readonly ipWindow: MemoryWindow;
  readonly clock: () => Date;
}

type Output = CallableOutput<'addInterests'>;

export function createAddInterestsHandler(metrics: Metrics, getDeps: () => CallableDeps): (request: CallableRequest<unknown>) => Promise<Output> {
  return scrubbed('addInterests', metrics, async (request: CallableRequest<unknown>): Promise<Output> => {
    const t0 = performance.now();
    metrics.inc('calls');
    const uid = request.auth?.uid;
    if (!uid) throw new AppError('UNAUTHENTICATED');
    // enforceAppCheck already rejects a missing token; this guards against a misconfigured deploy.
    if (!request.app) throw new AppError('APP_CHECK');
    if (request.auth?.token.onb !== true) throw new AppError('NOT_ONBOARDED');
    const deps = getDeps();
    const now = deps.clock();
    if (!(await deps.embedderEnabled(now.getTime()))) throw new AppError('FEATURE_DISABLED');

    const ip = clientIp(request.rawRequest);
    if (!deps.uidWindow.take(uid, now.getTime()) || (ip !== undefined && !deps.ipWindow.take(ip, now.getTime()))) {
      metrics.inc('rateLimited');
      throw new AppError('RATE_LIMITED');
    }
    const parsed = parseSafely(CALLABLES.addInterests.input, request.data);
    if (!parsed.ok) throw new ValidationError(parsed.issues);
    if (!(await deps.takeUidCall(uid, now))) {
      metrics.inc('rateLimited');
      throw new AppError('RATE_LIMITED');
    }

    if (parsed.data.items.length === 0) {
      // Warm-up (§10.2): the same service that will embed loads the model, after every check above.
      metrics.inc('warmups');
      await deps.runtime();
      metrics.observe('callMs', performance.now() - t0);
      return { results: [] };
    }

    const results = await addInterests(deps, { uid, items: parsed.data.items, now });
    // Parsing strips anything outside the schema: statuses only, never a vector (§9).
    const out = CALLABLES.addInterests.output.parse({ results });
    metrics.observe('callMs', performance.now() - t0);
    return out;
  });
}
