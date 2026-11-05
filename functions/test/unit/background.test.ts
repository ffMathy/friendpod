import { purgeUserTask } from '@grouper/core';
import type { Messaging } from 'firebase-admin/messaging';
import { HttpsError } from 'firebase-functions/https';
import { onSchedule } from 'firebase-functions/scheduler';
import { onTaskDispatched } from 'firebase-functions/tasks';
import { describe, expect, it } from 'vitest';
import { runBackground, runTask } from '../../src/lib/background';
import { notImplemented } from '../../src/lib/errors';
import { log } from '../../src/lib/log';
import { PUSH_BATCH, PUSH_KINDS, genericMessages, sendGenericPush } from '../../src/lib/push';
import { exceedsKillThreshold } from '../../src/triggers/budget';
import { isPendingUpload } from '../../src/triggers';
import { capturedEntries, forbidInLogs } from '../helpers/logCapture';

const deps = { now: () => 0, log };

describe('background wrappers', () => {
  it('drops an invalid task payload without a retry and without logging it', async () => {
    forbidInLogs('NotAValidUid/../../x', 'extra-secret');
    let ran = false;
    await runTask('purgeUser', purgeUserTask, { uid: 'NotAValidUid/../../x', extra: 'extra-secret' }, deps, async () => {
      ran = true;
    });
    expect(ran).toBe(false);
    expect(capturedEntries().find((e) => e.event === 'task.invalidPayload')).toMatchObject({ fn: 'purgeUser', severity: 'ERROR' });
  });

  it('fails the task so the queue retries, logging the code and design section of a stub', async () => {
    const uid = 'PurgeMe00000000000000001';
    forbidInLogs(uid);
    await expect(runTask('purgeUser', purgeUserTask, { uid }, deps, async () => Promise.reject(notImplemented('§10.3')))).rejects.toMatchObject({ code: 'internal', message: 'NOT_IMPLEMENTED' });
    expect(capturedEntries().find((e) => e.event === 'task.failed')).toMatchObject({ fn: 'purgeUser', code: 'NOT_IMPLEMENTED', design: '§10.3' });
  });

  it('throws only the code, never the original error, for schedules and events', async () => {
    const thrown = runBackground('event', 'onPhotoUploaded', deps, async () => Promise.reject(new Error('users/abc failed')));
    await expect(thrown).rejects.not.toBeInstanceOf(HttpsError);
    await expect(thrown).rejects.toMatchObject({ message: 'INTERNAL' });
    await expect(thrown.catch((e: Error) => e.stack)).resolves.not.toContain('users/abc');
  });
});

/**
 * The platform logs what a background function throws (§13). These go through the SDK's own HTTP handlers, as
 * Cloud Tasks and Cloud Scheduler call them, with the error a Firestore update() of a missing document throws.
 */
describe('background failures through the firebase-functions handlers', () => {
  const uid = 'RawUid0000000000000000000042';
  const firestoreError = (): Error =>
    Object.assign(new Error(`5 NOT_FOUND: No document to update: projects/demo-grouper/databases/(default)/documents/users/${uid}`), { code: 5 });

  interface FakeResponse {
    statusCode: number;
    body: unknown;
  }
  type HttpHandler = (req: unknown, res: unknown) => Promise<void>;

  async function post(fn: HttpHandler, body: unknown, headers: Record<string, string> = {}): Promise<FakeResponse> {
    const all: Record<string, string> = { 'content-type': 'application/json', ...headers };
    const req = { method: 'POST', body, headers: all, header: (name: string) => all[name.toLowerCase()] };
    const out: FakeResponse = { statusCode: 0, body: undefined };
    const res = {
      status(code: number) {
        out.statusCode = code;
        return res;
      },
      send(b?: unknown) {
        out.body = b;
        return res;
      },
      end() {
        return res;
      },
    };
    await fn(req, res);
    return out;
  }

  // Cloud Tasks' OIDC token; the SDK decodes it without verifying (the platform has already checked it).
  const unsignedJwt = (sub: string): string => ['{"alg":"none"}', JSON.stringify({ sub })].map((p) => Buffer.from(p).toString('base64url')).join('.') + '.sig';

  it('task: answers 500 so Cloud Tasks retries, and no log line carries the uid', async () => {
    forbidInLogs(uid);
    const fn = onTaskDispatched({}, (req) => runTask('purgeUser', purgeUserTask, req.data, deps, async () => Promise.reject(firestoreError())));
    const res = await post(fn as unknown as HttpHandler, { data: { uid } }, { authorization: `Bearer ${unsignedJwt('cloud-tasks')}` });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain(uid);
    expect(capturedEntries().find((e) => e.event === 'task.failed')).toMatchObject({ fn: 'purgeUser', code: 'INTERNAL', errorName: 'Error', grpcCode: 5 });
    expect(capturedEntries().some((e) => e.message === 'Unhandled error')).toBe(false);
  });

  it('schedule: answers 500 and the scheduler logs only the code', async () => {
    forbidInLogs(uid);
    const fn = onSchedule('5 * * * *', () => runBackground('schedule', 'hourlySweeper', deps, async () => Promise.reject(firestoreError())));
    const res = await post(fn as unknown as HttpHandler, {});
    expect(res.statusCode).toBe(500);
    // The SDK's logger.error appends its own call-site stack to the message; the first line is what was thrown.
    expect(capturedEntries().filter((e) => e.severity === 'ERROR').map((e) => String(e.message).split('\n')[0])).toEqual(['schedule.failed', 'Error: INTERNAL']);
  });
});

describe('triggers', () => {
  it('processes only the fixed pending upload names', () => {
    expect(isPendingUpload('uploads/u1/pending.jpg')).toBe(true);
    expect(isPendingUpload('uploads/u1/pending_256.jpg')).toBe(true);
    expect(isPendingUpload('photos/u1/3.jpg')).toBe(false);
    expect(isPendingUpload('uploads/u1/other.jpg')).toBe(false);
    expect(isPendingUpload('uploads/u1/x/pending.jpg')).toBe(false);
  });

  it('trips the kill switches only on actual spend at the budget', () => {
    expect(exceedsKillThreshold({ alertThresholdExceeded: 1, costAmount: 101, budgetAmount: 100 })).toBe(true);
    expect(exceedsKillThreshold({ alertThresholdExceeded: 0.9 })).toBe(false);
    expect(exceedsKillThreshold({ forecastThresholdExceeded: 1.2 })).toBe(false);
    expect(exceedsKillThreshold({ costAmount: 500 })).toBe(false);
    expect(exceedsKillThreshold(null)).toBe(false);
  });
});

describe('push', () => {
  it('sends only fixed generic copy and the kind (S4)', () => {
    for (const kind of PUSH_KINDS) {
      const params = kind === 'areaOpen' ? { city: { da: 'København', en: 'Copenhagen' } } : {};
      const [en, da] = genericMessages(kind, [{ locale: 'en', tokens: ['t1'] }, { locale: 'da', tokens: ['t2'] }], params);
      expect(Object.keys(en!).sort()).toEqual(['android', 'apns', 'data', 'notification', 'token']);
      expect(en!.data).toEqual({ kind });
      expect(en!.notification?.body).not.toEqual(da!.notification?.body);
    }
  });

  it('names only the city in the area-open push (founder decision 2026-11-05)', () => {
    const city = { da: 'København', en: 'Copenhagen' };
    const [en, da] = genericMessages('areaOpen', [{ locale: 'en', tokens: ['t1'] }, { locale: 'da', tokens: ['t2'] }], { city });
    expect(en!.notification?.body).toBe('Copenhagen is open — your first drop is Thursday 18:00');
    expect(da!.notification?.body).toBe('København er åben — dit første drop er torsdag kl. 18:00');
    expect(() => genericMessages('areaOpen', [{ locale: 'en', tokens: ['t1'] }])).toThrow();
  });

  it('batches by 500 and reports stale tokens for pruning', async () => {
    const tokens = Array.from({ length: PUSH_BATCH + 3 }, (_, i) => `tok${i}`);
    const batches: number[] = [];
    const messaging = {
      async sendEach(messages: { token: string }[]) {
        batches.push(messages.length);
        return {
          successCount: messages.filter((m) => m.token !== 'tok1').length,
          failureCount: 1,
          responses: messages.map((m) =>
            m.token === 'tok1' ? { success: false, error: { code: 'messaging/registration-token-not-registered' } } : { success: true, messageId: 'id' },
          ),
        };
      },
    } as unknown as Messaging;
    const result = await sendGenericPush(messaging, 'dropReady', [{ locale: 'da', tokens }]);
    expect(batches).toEqual([PUSH_BATCH, 3]);
    expect(result).toEqual({ sent: PUSH_BATCH + 2, staleTokens: ['tok1'] });
  });
});
