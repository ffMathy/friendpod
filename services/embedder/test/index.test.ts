/** Deployment wiring of the two functions (DESIGN.md §7 Embedder, §9 App Check). */
import { describe, expect, it } from 'vitest';
import { addInterests, embedderBatch } from '../src/index';
import { captureOutput } from './helpers/capture';

interface FakeResponse {
  statusCode: number;
  body: unknown;
}

async function post(fn: (req: unknown, res: unknown) => unknown, body: unknown): Promise<FakeResponse> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const req = { method: 'POST', headers, body, header: (n: string) => headers[n.toLowerCase()], get: (n: string) => headers[n.toLowerCase()] };
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    send(b: unknown) {
      this.body = b;
      return this;
    },
    json(b: unknown) {
      this.body = b;
      return this;
    },
    setHeader() {},
    getHeader() {},
    end() {
      return this;
    },
    on() {},
  };
  const out = captureOutput();
  try {
    await fn(req, res);
  } finally {
    out.restore();
  }
  return res;
}

describe('embedder codebase', () => {
  it('exports exactly addInterests and embedderBatch with the §7 sizing', () => {
    for (const fn of [addInterests, embedderBatch]) {
      expect(fn.__endpoint).toMatchObject({
        region: ['europe-west1'],
        availableMemoryMb: 1024,
        cpu: 1,
        concurrency: 4,
        minInstances: 0,
        maxInstances: 5,
        serviceAccountEmail: 'sa-embedder@',
      });
    }
    expect(addInterests.__endpoint.callableTrigger).toEqual({});
    expect(addInterests.__endpoint.secretEnvironmentVariables).toEqual([{ key: 'UID_HMAC_KEY' }]);
    expect(embedderBatch.__endpoint).toMatchObject({ timeoutSeconds: 1800, taskQueueTrigger: { rateLimits: { maxConcurrentDispatches: 1 } } });
  });

  it('rejects a call without an App Check token before the handler runs', async () => {
    const res = await post(addInterests as unknown as (req: unknown, res: unknown) => unknown, { data: { items: [] } });
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { message: 'Unauthenticated', status: 'UNAUTHENTICATED' } });
  });

  it('embedderBatch is a stub that fails loudly with a scrubbed error', async () => {
    const run = embedderBatch.run.bind(embedderBatch) as (req: { data: unknown }) => Promise<void>;
    const out = captureOutput();
    try {
      await expect(run({ data: { op: 'rescan' } })).rejects.toMatchObject({ code: 'internal', message: 'INTERNAL' });
    } finally {
      out.restore();
    }
    expect(out.text()).toContain('NotImplementedError');
    expect(out.text()).not.toContain('not implemented');
  });
});
