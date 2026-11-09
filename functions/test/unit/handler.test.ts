import { uidHash } from '@friendpod/core';
import { HttpsError } from 'firebase-functions/https';
import { describe, expect, it } from 'vitest';
import { AppError, notImplemented } from '../../src/lib/errors';
import { RECENT_LOGIN_MS, assertRecentLogin, runCallable, type CallableImpl, type HandlerDeps } from '../../src/lib/handler';
import { log } from '../../src/lib/log';
import { declaredKeys } from '@friendpod/core/node';
import { capturedEntries, forbidInLogs } from '../helpers/logCapture';
import { testUidHmac } from '../helpers/keys';
import { appCheck, request } from '../helpers/requests';

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const deps: HandlerDeps = { now: () => NOW, uidHmac: () => testUidHmac, log };

const okProfile: CallableImpl<'updateProfile'> = async () => ({ ok: true });
const stub = (design: string): CallableImpl<'report'> => async () => {
  throw notImplemented(design);
};

async function rejection(p: Promise<unknown>): Promise<HttpsError> {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(HttpsError);
  return err as HttpsError;
}

const detailsCode = (e: HttpsError): unknown => (e.details as { code?: unknown } | undefined)?.code;

describe('runCallable: access checks', () => {
  it('requires auth', async () => {
    const e = await rejection(runCallable('updateProfile', okProfile, request({ locale: 'da' }, { nowMs: NOW, uid: null }), deps));
    expect(e.code).toBe('unauthenticated');
    expect(detailsCode(e)).toBe('UNAUTHENTICATED');
  });

  it('requires an App Check token even if enforcement were misconfigured', async () => {
    const e = await rejection(runCallable('updateProfile', okProfile, request({ locale: 'da' }, { nowMs: NOW, app: null }), deps));
    expect(e.code).toBe('unauthenticated');
    expect(detailsCode(e)).toBe('APP_CHECK');
  });

  it('requires the onb claim, except for completeOnboarding', async () => {
    const e = await rejection(runCallable('updateProfile', okProfile, request({ locale: 'da' }, { nowMs: NOW, claims: { onb: undefined } }), deps));
    expect(e.code).toBe('failed-precondition');
    expect(detailsCode(e)).toBe('NOT_ONBOARDED');

    const onboarding: CallableImpl<'completeOnboarding'> = async () => ({ areaStatus: 'outside' });
    const input = { firstName: 'Ada', dob: '1990-01-01', locale: 'en', area: { gh5: 'u1zr2' }, legal: { terms: 'v1', privacy: 'v1' } };
    await expect(runCallable('completeOnboarding', onboarding, request(input, { nowMs: NOW, claims: { onb: undefined } }), deps)).resolves.toEqual({ areaStatus: 'outside' });
  });

  it('rejects a consumed or unconsumed App Check token on replay-protected callables', async () => {
    const data = { target: { type: 'user', podId: 'a'.repeat(20), uid: 'other' }, category: 'harassment' };
    for (const consumed of [true, undefined]) {
      const e = await rejection(runCallable('report', stub('§3.7'), request(data, { nowMs: NOW, app: appCheck(NOW, consumed) }), deps));
      expect(e.code).toBe('failed-precondition');
      expect(detailsCode(e)).toBe('APP_CHECK_REPLAY');
    }
    const fresh = await rejection(runCallable('report', stub('§3.7'), request(data, { nowMs: NOW, app: appCheck(NOW, false) }), deps));
    expect(fresh.code).toBe('unimplemented');
    expect(fresh.details).toEqual({ code: 'NOT_IMPLEMENTED', design: '§3.7' });
    expect(fresh.message).toBe('not implemented (see DESIGN.md §3.7)');
  });

  it('requires a sign-in within 5 minutes for exportData and deleteAccount', async () => {
    const impl: CallableImpl<'exportData'> = async () => ({ exportId: 'exp1' });
    const stale = Math.floor((NOW - RECENT_LOGIN_MS - 1000) / 1000);
    const e = await rejection(runCallable('exportData', impl, request({}, { nowMs: NOW, app: appCheck(NOW, false), claims: { auth_time: stale } }), deps));
    expect(detailsCode(e)).toBe('RECENT_LOGIN');
    // RNFirebase sends null for a callable invoked without data.
    await expect(runCallable('exportData', impl, request(null, { nowMs: NOW, app: appCheck(NOW, false) }), deps)).resolves.toEqual({ exportId: 'exp1' });
  });

  it('checks auth_time against the clock in both directions', () => {
    const s = (ms: number) => ({ auth_time: Math.floor(ms / 1000) });
    expect(() => assertRecentLogin(s(NOW - 60_000), NOW)).not.toThrow();
    expect(() => assertRecentLogin(s(NOW - RECENT_LOGIN_MS - 1000), NOW)).toThrow(AppError);
    expect(() => assertRecentLogin(s(NOW + 10 * 60_000), NOW)).toThrow(AppError);
    expect(() => assertRecentLogin({ auth_time: undefined as unknown as number }, NOW)).toThrow(AppError);
  });
});

describe('runCallable: validation and error mapping', () => {
  it('maps zod failures to invalid-argument/VALIDATION and logs only paths and codes', async () => {
    const secret = 'graviditetsyoga hemmelig';
    forbidInLogs(secret, 'Zeynep');
    let called = false;
    const impl: CallableImpl<'updateProfile'> = async () => {
      called = true;
      return { ok: true };
    };
    const e = await rejection(runCallable('updateProfile', impl, request({ firstName: 'Zeynep', bogus: secret, locale: 'xx' }, { nowMs: NOW }), deps));
    expect(called).toBe(false);
    expect(e.code).toBe('invalid-argument');
    expect(e.details).toEqual({ code: 'VALIDATION' });
    expect(e.message).toBe('VALIDATION');

    const entry = capturedEntries().find((x) => x.event === 'callable.invalidInput');
    expect(entry?.fn).toBe('updateProfile');
    expect(entry?.issues).toEqual(expect.arrayContaining([{ path: 'locale', code: 'invalid_value' }, { path: '', code: 'unrecognized_keys' }]));
    expect(JSON.stringify(entry)).not.toMatch(/received|expected/i);
  });

  it('never logs record keys taken from the request', async () => {
    const leakyKey = 'my private diagnosis';
    forbidInLogs(leakyKey);
    const data = { podId: 'a'.repeat(20), met: true, notThere: [], meetAgain: { [leakyKey]: true }, keep: true };
    await rejection(runCallable('submitFeedback', async () => ({ ok: true }), request(data, { nowMs: NOW }), deps));
    const entry = capturedEntries().find((x) => x.event === 'callable.invalidInput');
    expect(JSON.stringify(entry?.issues)).toContain('meetAgain.*');
  });

  it('maps unexpected errors to internal and logs class, stack frames and uidH, never the message or uid', async () => {
    const uid = 'RawUid1234567890abcdef';
    forbidInLogs(uid, 'users/RawUid', 'secret message');
    const impl: CallableImpl<'updateProfile'> = async () => {
      throw new TypeError(`secret message about users/${uid}`);
    };
    const e = await rejection(runCallable('updateProfile', impl, request({ locale: 'da' }, { nowMs: NOW, uid }), deps));
    expect(e.code).toBe('internal');
    expect(e.details).toEqual({ code: 'INTERNAL' });
    expect(e.message).toBe('INTERNAL');

    const entry = capturedEntries().find((x) => x.event === 'callable.unexpectedError');
    expect(entry).toMatchObject({ fn: 'updateProfile', errorName: 'TypeError', uidH: await uidHash(testUidHmac, uid) });
    expect(Array.isArray(entry?.stack) && (entry.stack as string[]).every((f) => f.startsWith('at '))).toBe(true);
  });

  it('writes one uid-free entry per call with outcome, code and latency', async () => {
    const uid = 'CallerUid0000000000001';
    forbidInLogs(uid, await uidHash(testUidHmac, uid));
    await runCallable('updateProfile', okProfile, request({ locale: 'da' }, { nowMs: NOW, uid }), deps);
    await rejection(runCallable('updateProfile', async () => Promise.reject(new AppError('GENDER_CONSENT')), request({ locale: 'da' }, { nowMs: NOW, uid }), deps));
    const calls = capturedEntries().filter((x) => x.event === 'callable');
    expect(calls).toEqual([
      expect.objectContaining({ fn: 'updateProfile', outcome: 'ok', ms: 0, severity: 'INFO' }),
      expect.objectContaining({ fn: 'updateProfile', outcome: 'error', code: 'GENDER_CONSENT' }),
    ]);
  });

  it('passes app errors through with their canonical code', async () => {
    const e = await rejection(runCallable('updateProfile', async () => Promise.reject(new AppError('GENDER_CONSENT')), request({ locale: 'da' }, { nowMs: NOW }), deps));
    expect(e.code).toBe('failed-precondition');
    expect(e.details).toEqual({ code: 'GENDER_CONSENT' });
  });

  it('validates outputs: unknown fields are stripped, invalid outputs become internal', async () => {
    const extra = (async () => ({ ok: true, leaked: 'x' })) as unknown as CallableImpl<'updateProfile'>;
    await expect(runCallable('updateProfile', extra, request({ locale: 'da' }, { nowMs: NOW }), deps)).resolves.toEqual({ ok: true });
    const bad = (async () => ({ ok: false })) as unknown as CallableImpl<'updateProfile'>;
    const e = await rejection(runCallable('updateProfile', bad, request({ locale: 'da' }, { nowMs: NOW }), deps));
    expect(e.details).toEqual({ code: 'INTERNAL' });
    expect(capturedEntries().some((x) => x.event === 'callable.invalidOutput')).toBe(true);
  });
});

describe('declaredKeys', () => {
  it('collects property names through optional, refined, piped and nested schemas', async () => {
    const { CALLABLES } = await import('@friendpod/core');
    const keys = declaredKeys(CALLABLES.submitFeedback.input);
    for (const k of ['podId', 'notThere', 'meetAgain', 'keep']) expect(keys.has(k)).toBe(true);
    const profile = declaredKeys(CALLABLES.updateProfile.input);
    for (const k of ['prefs', 'ageMin', 'genderConsent', 'textSha256', 'area', 'gh5']) expect(profile.has(k)).toBe(true);
    const interests = declaredKeys(CALLABLES.addInterests.input);
    for (const k of ['modelKey', 'items', 'vector', 'detector', 'margin', 'notSensitiveForMe']) expect(interests.has(k)).toBe(true);
  });
});
