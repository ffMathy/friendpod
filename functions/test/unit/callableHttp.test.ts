/**
 * The exported callables end to end through firebase-functions' HTTP handler (token checks, CORS, error
 * encoding), with every log line captured: framework logs must not carry request data either (§13).
 * Token verification is skipped the way the Functions emulator does it, so unsigned JWTs work.
 */
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { capturedLogs, forbidInLogs } from '../helpers/logCapture';

vi.hoisted(() => {
  process.env.FIREBASE_DEBUG_MODE = 'true';
  process.env.FIREBASE_DEBUG_FEATURES = JSON.stringify({ skipTokenVerification: true });
  process.env.UID_HMAC_KEY = Buffer.alloc(32, 7).toString('base64');
});

const fns = await import('../../src/index');

const b64url = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: object): string => `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(payload)}.sig`;

class MockResponse extends EventEmitter {
  statusCode = 200;
  body: unknown;
  readonly headers: Record<string, unknown> = {};
  status(code: number): this {
    this.statusCode = code;
    return this;
  }
  setHeader(k: string, v: unknown): void {
    this.headers[k.toLowerCase()] = v;
  }
  getHeader(k: string): unknown {
    return this.headers[k.toLowerCase()];
  }
  send(body: unknown): this {
    this.body = body;
    this.emit('finish');
    return this;
  }
  write(): boolean {
    return true;
  }
  end(): this {
    this.emit('finish');
    return this;
  }
}

type HttpFn = (req: unknown, res: unknown) => Promise<void> | void;

async function call(fn: HttpFn, data: unknown, o: { uid?: string; onb?: boolean; appCheck?: boolean } = {}): Promise<MockResponse> {
  const nowS = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (o.uid) headers.authorization = `Bearer ${jwt({ sub: o.uid, user_id: o.uid, onb: o.onb ?? true, auth_time: nowS, iat: nowS, exp: nowS + 3600 })}`;
  if (o.appCheck !== false) headers['x-firebase-appcheck'] = jwt({ sub: '1:1:ios:1', iat: nowS, exp: nowS + 3600 });
  const req = { method: 'POST', url: '/', headers, body: { data }, header: (name: string) => headers[name.toLowerCase()], get: (name: string) => headers[name.toLowerCase()] };
  const res = new MockResponse();
  await fn(req, res);
  return res;
}

const errorOf = (res: MockResponse) => (res.body as { error: { status: string; message: string; details?: unknown } }).error;

describe('callables over HTTP', () => {
  it('rejects a missing App Check token before the handler runs', async () => {
    const res = await call(fns.updateProfile as unknown as HttpFn, { locale: 'da' }, { uid: 'HttpUser0001', appCheck: false });
    expect(res.statusCode).toBe(401);
    expect(errorOf(res).status).toBe('UNAUTHENTICATED');
  });

  it('returns invalid-argument with only the app code, and logs no request data', async () => {
    const tag = 'graviditet uge 12';
    forbidInLogs(tag, 'HttpUser0002', 'Zelda');
    const res = await call(fns.updateProfile as unknown as HttpFn, { firstName: 'Zelda', note: tag }, { uid: 'HttpUser0002' });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toEqual({ status: 'INVALID_ARGUMENT', message: 'VALIDATION', details: { code: 'VALIDATION' } });
    expect(capturedLogs().some((l) => l.includes('callable.invalidInput'))).toBe(true);
  });

  it('refuses an invalid report on the replay-protected callable with only the app code, logging no report text', async () => {
    const text = `he said something about my faith ${'x'.repeat(500)}`;
    forbidInLogs('he said something about my faith', 'HttpUser0003', 'HttpTarget01');
    const data = { target: { type: 'user', podId: 'b'.repeat(20), uid: 'HttpTarget01' }, category: 'harassment', text };
    const res = await call(fns.report as unknown as HttpFn, data, { uid: 'HttpUser0003' });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toEqual({ status: 'INVALID_ARGUMENT', message: 'VALIDATION', details: { code: 'VALIDATION' } });
  });

  it('logs no meetup-chat text when a message fails validation', async () => {
    const text = 'ring 20 30 40 50, jeg er gravid og sidder ved vinduet';
    forbidInLogs(text, '20 30 40 50', 'gravid', 'HttpUser0005');
    const res = await call(fns.sendMessage as unknown as HttpFn, { podId: 'c'.repeat(20), text, kind: 'text' }, { uid: 'HttpUser0005' });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toEqual({ status: 'INVALID_ARGUMENT', message: 'VALIDATION', details: { code: 'VALIDATION' } });
    expect(capturedLogs().some((l) => l.includes('callable.invalidInput') && l.includes('sendMessage'))).toBe(true);
  });

  it('checks a proposed place against the Places shape before proposeOption runs (D8)', async () => {
    const { googleMapsPlaceUrl } = await import('@friendpod/core');
    const placeId = 'ChIJ0000aarhusLibrary';
    const place = { placeId, name: 'Dokk1', address: 'Hack Kampmanns Plads 2, Aarhus', lat: 56.1532, lng: 10.214, type: 'library', mapUrl: googleMapsPlaceUrl(placeId, 'Dokk1') };
    const data = { podId: 'e'.repeat(20), startsAt: Date.UTC(2026, 10, 20, 17), place };
    // A valid shape reaches the implementation, which reads Firestore and refuses a pod the caller is not in.
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      const valid = await call(fns.proposeOption as unknown as HttpFn, data, { uid: 'HttpUser0007' });
      expect(errorOf(valid).details).toEqual({ code: 'NOT_MEMBER' });
    }
    for (const bad of [
      { ...place, mapUrl: 'https://maps.app.goo.gl/Xy12AbCd' },
      { ...place, type: 'night_club' },
      { ...place, lat: 56.15321 },
      { ...place, placeText: 'my place' },
    ]) {
      const res = await call(fns.proposeOption as unknown as HttpFn, { ...data, place: bad }, { uid: 'HttpUser0007' });
      expect(errorOf(res).details).toEqual({ code: 'VALIDATION' });
    }
    const freeText = await call(fns.proposeOption as unknown as HttpFn, { podId: data.podId, startsAt: data.startsAt, placeText: 'Dokk1', publicPlace: true }, { uid: 'HttpUser0007' });
    expect(errorOf(freeText).details).toEqual({ code: 'VALIDATION' });
  });

  // A valid message report reaches the handler (emulator test: safety.test.ts); here only the input check runs.
  it('requires the message id of a chat-message report', async () => {
    forbidInLogs('HttpUser0006');
    const target = { type: 'message', podId: 'd'.repeat(20), messageId: 'msg0001' };
    const { messageId: _omitted, ...withoutId } = target;
    const missing = await call(fns.report as unknown as HttpFn, { target: withoutId, category: 'harassment' }, { uid: 'HttpUser0006' });
    expect(errorOf(missing).details).toEqual({ code: 'VALIDATION' });
  });

  it('refuses callers without the onb claim', async () => {
    const res = await call(fns.setParticipation as unknown as HttpFn, { mode: 'pause' }, { uid: 'HttpUser0004', onb: false });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res).details).toEqual({ code: 'NOT_ONBOARDED' });
  });
});
