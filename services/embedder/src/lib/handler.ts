/**
 * Log-scrubbing wrapper (DESIGN.md §13). Every error is turned into an HttpsError that carries only an
 * app code. Logged: the code, zod issue paths and codes, the error class and stack frames, never an error
 * message (a Firestore message can contain a document path with a uid), the request data or an IP.
 *
 * DESIGN-DEVIATION: §13 names one `functions/src/lib/handler.ts` shared by both codebases. Both are standalone
 * npm projects, so the scrubbing itself (issue paths, stack frames) is shared from `@grouper/core/node`, and
 * each codebase keeps only its thin HttpsError wrapper.
 */
import { canonicalCodeFor } from '@grouper/core';
import { stackFrames } from '@grouper/core/node';
import { HttpsError } from 'firebase-functions/https';
import { logger } from 'firebase-functions/logger';
import { AppError, NotImplementedError, ValidationError } from './errors';
import type { Metrics } from './metrics';

function failureFields(err: unknown): Record<string, unknown> {
  const grpc = (err as { code?: unknown } | null)?.code;
  return {
    error: err instanceof Error ? err.name : typeof err,
    ...(typeof grpc === 'number' ? { grpcCode: grpc } : {}),
    stack: stackFrames(err),
  };
}

/** The only error a client or Cloud Tasks sees for an unexpected failure; deliberately without a `cause`. */
function internalError(): HttpsError {
  return new HttpsError('internal', 'INTERNAL', { code: 'INTERNAL' });
}

export function toHttpsError(fn: string, metrics: Metrics, err: unknown): HttpsError {
  if (err instanceof AppError) {
    return new HttpsError(canonicalCodeFor(err.code), err.code, { code: err.code });
  }
  if (err instanceof NotImplementedError) {
    // Same shape as the default codebase's typed stubs: `unimplemented`, details {code, design}.
    return new HttpsError(canonicalCodeFor('NOT_IMPLEMENTED'), `not implemented (see DESIGN.md ${err.section})`, { code: 'NOT_IMPLEMENTED', design: err.section });
  }
  if (err instanceof ValidationError) {
    logger.warn('callable rejected', { fn, code: 'VALIDATION', issues: err.issues });
    return new HttpsError('invalid-argument', 'VALIDATION', { code: 'VALIDATION' });
  }
  metrics.inc('errors');
  logger.error('callable failed', { fn, code: 'INTERNAL', ...failureFields(err) });
  return internalError();
}

export function scrubbed<Req, Res>(fn: string, metrics: Metrics, handler: (req: Req) => Promise<Res>): (req: Req) => Promise<Res> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      throw toHttpsError(fn, metrics, err);
    }
  };
}

/**
 * Task functions: log the scrubbed failure and throw a data-free HttpsError, so Cloud Tasks retries and
 * firebase-functions does not log the original error again as "Unhandled error".
 */
export function scrubbedTask<Req>(fn: string, metrics: Metrics, handler: (req: Req) => Promise<void>): (req: Req) => Promise<void> {
  return async (req) => {
    try {
      await handler(req);
    } catch (err) {
      metrics.inc('errors');
      logger.error('task failed', { fn, ...failureFields(err) });
      throw internalError();
    }
  };
}
