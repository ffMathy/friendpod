import { canonicalCodeFor, type AppErrorCode } from '@friendpod/core';
import { HttpsError } from 'firebase-functions/https';

/**
 * The only error a handler may throw on purpose. Its code comes from core's APP_ERRORS, the one table both
 * codebases and the app's i18n share. It carries a code and fixed, data-free extras; the message is
 * the code itself, so nothing derived from input can reach the client or the logs through it.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly extra: Readonly<Record<string, string>>;

  constructor(code: AppErrorCode, extra: Readonly<Record<string, string>> = {}) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.extra = extra;
  }
}

/** A typed stub's error: `unimplemented`, `details: {code: 'NOT_IMPLEMENTED', design}`. */
export function notImplemented(design: string): AppError {
  return new AppError('NOT_IMPLEMENTED', { design });
}

export function toHttpsError(err: AppError): HttpsError {
  const message = err.code === 'NOT_IMPLEMENTED' ? `not implemented (see DESIGN.md ${err.extra.design ?? ''})`.trim() : err.code;
  return new HttpsError(canonicalCodeFor(err.code), message, { ...err.extra, code: err.code });
}

/** Firestore/gRPC status of an SDK error, if any (6 = ALREADY_EXISTS, 9 = FAILED_PRECONDITION, 10 = ABORTED). */
export function grpcCode(err: unknown): number | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : undefined;
}
