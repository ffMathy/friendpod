/**
 * The callable wrapper and log-scrubbing middleware (DESIGN.md §9, §10, §13). Every callable goes through
 * runCallable(): auth, App Check (incl. replay), the `onb` claim, `auth_time` recency, zod input validation with
 * the core schemas, output validation, and error mapping to HttpsError with `details.code`.
 *
 * Logging rules: request data, zod messages and received values are never logged. Each call writes one uid-free
 * entry (function, outcome, code, latency); unexpected errors add one entry with uidH, the error class and stack
 * frames. Nothing here depends on Firestore.
 */
import { CALLABLES, uidHash, type CallableInput, type CallableName, type CallableOutput, type HmacSha256 } from '@friendpod/core';
import { parseSafely, type Schema } from '@friendpod/core/node';
import { onCall, type CallableFunction, type CallableOptions, type CallableRequest } from 'firebase-functions/https';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { AppError, toHttpsError } from './errors';
import { errorFields, type Log } from './log';

/** `deleteAccount` and `exportData` need a sign-in within 5 minutes (§9 Auth hardening). */
export const RECENT_LOGIN_MS = 5 * 60_000;
/** Tolerated clock skew between Firebase Auth and this instance. */
const AUTH_TIME_SKEW_MS = 60_000;

export interface HandlerDeps {
  now(): number;
  /** HMAC keyed with UID_HMAC_KEY (secret in production, a fixed key in tests). */
  uidHmac(): HmacSha256;
  readonly log: Log;
}

export interface CallContext {
  readonly name: CallableName;
  readonly uid: string;
  readonly token: DecodedIdToken;
  /** Request time (epoch ms), read once so one call sees one instant. */
  readonly now: number;
  /** The caller's uidH (memoized). */
  uidH(): Promise<string>;
}

export type CallableImpl<N extends CallableName> = (call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

/** The parts of a CallableRequest the wrapper reads. */
export type CallableRequestLike = Pick<CallableRequest<unknown>, 'data' | 'auth' | 'app'>;

export function assertRecentLogin(token: Pick<DecodedIdToken, 'auth_time'>, nowMs: number): void {
  const authTimeMs = typeof token.auth_time === 'number' ? token.auth_time * 1000 : Number.NaN;
  const age = nowMs - authTimeMs;
  if (!(age <= RECENT_LOGIN_MS && age >= -AUTH_TIME_SKEW_MS)) throw new AppError('RECENT_LOGIN');
}

export async function runCallable<N extends CallableName>(
  name: N,
  impl: CallableImpl<N>,
  request: CallableRequestLike,
  deps: HandlerDeps,
): Promise<CallableOutput<N>> {
  const spec = CALLABLES[name];
  const started = deps.now();
  let uidHPromise: Promise<string> | undefined;
  const uidH = (uid: string): Promise<string> => (uidHPromise ??= uidHash(deps.uidHmac(), uid));

  try {
    const { auth, app } = request;
    if (!auth) throw new AppError('UNAUTHENTICATED');
    // enforceAppCheck already rejects a missing token; this guards against a misconfigured deploy.
    if (!app) throw new AppError('APP_CHECK');
    // A consumed token is not rejected by the SDK (§9). `undefined` means the token was not consumed at all.
    if (spec.replayProtected && app.alreadyConsumed !== false) throw new AppError('APP_CHECK_REPLAY');
    if (spec.requiresOnboarding && auth.token['onb'] !== true) throw new AppError('NOT_ONBOARDED');
    if (spec.requiresRecentLogin) assertRecentLogin(auth.token, started);

    const input = parseSafely(spec.input as Schema<CallableInput<N>>, request.data);
    if (!input.ok) {
      deps.log.warn('callable.invalidInput', { fn: name, issues: input.issues.map((i) => ({ path: i.path, code: i.code })) });
      throw new AppError('VALIDATION');
    }
    const call: CallContext = { name, uid: auth.uid, token: auth.token, now: started, uidH: () => uidH(auth.uid) };
    const result = await impl(call, input.data);
    const output = parseSafely(spec.output as Schema<CallableOutput<N>>, result);
    if (!output.ok) {
      deps.log.error('callable.invalidOutput', { fn: name, issues: output.issues.map((i) => ({ path: i.path, code: i.code })) });
      throw new AppError('INTERNAL');
    }
    deps.log.info('callable', { fn: name, outcome: 'ok', ms: deps.now() - started });
    return output.data;
  } catch (err) {
    const appError = err instanceof AppError ? err : new AppError('INTERNAL');
    if (!(err instanceof AppError)) {
      const callerH = request.auth ? await uidH(request.auth.uid).catch(() => null) : null;
      deps.log.error('callable.unexpectedError', { fn: name, uidH: callerH, ...errorFields(err) });
    }
    deps.log.info('callable', { fn: name, outcome: 'error', code: appError.code, ms: deps.now() - started });
    throw toHttpsError(appError);
  }
}

export function callable<N extends CallableName>(
  name: N,
  options: CallableOptions,
  impl: CallableImpl<N>,
  deps: () => HandlerDeps,
): CallableFunction<unknown, Promise<CallableOutput<N>>> {
  return onCall(options, (request) => runCallable(name, impl, request, deps()));
}
