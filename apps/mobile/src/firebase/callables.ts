import { APP_ERRORS, CALLABLES, type AppErrorCode, type CallableName, type CallableOutput } from '@grouper/core';
import { httpsCallable } from '@react-native-firebase/functions';
import type { z } from 'zod';
import { functions } from './index';

/** What the caller passes: the schema's input type (before preprocess/transform). */
export type CallableRequest<N extends CallableName> = z.input<(typeof CALLABLES)[N]['input']>;

/** A callable failure, reduced to the app code the server put in `HttpsError.details.code` (§10). */
export class AppError extends Error {
  readonly code: AppErrorCode | 'NETWORK' | 'UNKNOWN';
  /** The callable's canonical gRPC-style code, e.g. `failed-precondition`. */
  readonly canonical: string | null;

  constructor(code: AppErrorCode | 'NETWORK' | 'UNKNOWN', canonical: string | null) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.canonical = canonical;
  }
}

const APP_CODES = new Set<string>(Object.keys(APP_ERRORS));

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (typeof error === 'object' && error !== null) {
    const { code, details } = error as { code?: unknown; details?: unknown };
    const detailCode = typeof details === 'object' && details !== null ? (details as { code?: unknown }).code : undefined;
    const canonical = typeof code === 'string' ? code.replace(/^functions\//, '') : null;
    if (typeof detailCode === 'string' && APP_CODES.has(detailCode)) return new AppError(detailCode as AppErrorCode, canonical);
    if (canonical === 'unavailable' || canonical === 'deadline-exceeded') return new AppError('NETWORK', canonical);
    return new AppError('UNKNOWN', canonical);
  }
  return new AppError('UNKNOWN', null);
}

/**
 * Calls a callable with the shared zod schemas (§10): the input is validated (strict) before it
 * leaves the device and the output is validated on arrival. Replay-protected callables (§9) get a
 * limited-use App Check token, as the server sets `consumeAppCheckToken`.
 */
export async function callFunction<N extends CallableName>(name: N, request: CallableRequest<N>): Promise<CallableOutput<N>> {
  const spec = CALLABLES[name];
  const input: unknown = spec.input.parse(request);
  const callable = httpsCallable(functions(), name, { limitedUseAppCheckTokens: spec.replayProtected });
  try {
    const result = await callable(input);
    return spec.output.parse(result.data) as CallableOutput<N>;
  } catch (error) {
    throw toAppError(error);
  }
}
