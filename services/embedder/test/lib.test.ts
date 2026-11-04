import { CALLABLES } from '@grouper/core';
import { parseSafely, stackFrames } from '@grouper/core/node';
import type { HttpsError } from 'firebase-functions/https';
import { describe, expect, it } from 'vitest';
import { AppError, ValidationError } from '../src/lib/errors';
import { scrubbed, toHttpsError } from '../src/lib/handler';
import { clientIp, MemoryWindow } from '../src/lib/limits';
import { LruCache } from '../src/lib/lru';
import { Metrics, type MetricEntry } from '../src/lib/metrics';
import { captureOutput } from './helpers/capture';

describe('Metrics', () => {
  it('flushes everything since the last flush as one uid-free entry, and nothing when idle', () => {
    const entries: MetricEntry[] = [];
    const m = new Metrics((e) => entries.push(e));
    m.flush();
    expect(entries).toHaveLength(0);
    m.inc('needsConsent');
    m.inc('needsConsent');
    m.inc('flagged', 3);
    m.observe('embedMs', 10);
    m.observe('embedMs', 30);
    m.flush();
    expect(entries).toEqual([{ kind: 'embedder', values: { needsConsent: 2, flagged: 3, embedMs_n: 2, embedMs_avg: 20, embedMs_max: 30 } }]);
    m.flush();
    expect(entries).toHaveLength(1);
  });

  it('writes a structured `metric` log entry by default', () => {
    const out = captureOutput();
    try {
      const m = new Metrics();
      m.inc('added');
      m.flush();
    } finally {
      out.restore();
    }
    const line = JSON.parse(out.text().trim()) as Record<string, unknown>;
    expect(line).toMatchObject({ message: 'metric', kind: 'embedder', added: 1, severity: 'INFO' });
  });
});

describe('log scrubbing', () => {
  it('keeps schema keys and indices in issue paths, nothing that could echo input', () => {
    const parsed = parseSafely(CALLABLES.addInterests.input, { items: [{ text: 'x'.repeat(500) }, { text: 'ok', 'aliceUid0000000000000000000a': 'gravid' }], 'tag text': 1 });
    expect(parsed.ok).toBe(false);
    const issues = parsed.ok ? [] : parsed.issues;
    expect(issues).toContainEqual({ path: 'items.0.text', code: 'too_big' });
    expect(JSON.stringify(issues)).not.toMatch(/aliceUid|gravid|tag text|xxx/);
  });

  it('logs stack frames but never the error message', () => {
    const err = new Error('No document to update: projects/demo/databases/(default)/documents/matchProfiles/USER123');
    const frames = stackFrames(err);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.join('\n')).not.toContain('USER123');

    const out = captureOutput();
    let mapped: HttpsError;
    try {
      mapped = toHttpsError('addInterests', new Metrics(() => undefined), err);
    } finally {
      out.restore();
    }
    expect(mapped).toMatchObject({ code: 'internal', message: 'INTERNAL', details: { code: 'INTERNAL' } });
    expect(out.text()).toContain('"fn":"addInterests"');
    expect(out.text()).not.toContain('USER123');
  });

  it('maps app errors to their canonical code without logging', async () => {
    const out = captureOutput();
    const run = scrubbed('addInterests', new Metrics(() => undefined), async () => {
      throw new AppError('RATE_LIMITED');
    });
    try {
      await expect(run(undefined)).rejects.toMatchObject({ code: 'resource-exhausted', details: { code: 'RATE_LIMITED' } });
      await expect(
        scrubbed('x', new Metrics(() => undefined), async () => {
          throw new ValidationError([{ path: 'items', code: 'too_big' }]);
        })(undefined),
      ).rejects.toMatchObject({ code: 'invalid-argument', details: { code: 'VALIDATION' } });
    } finally {
      out.restore();
    }
    expect(out.text()).not.toContain('RATE_LIMITED');
  });
});

describe('clientIp (per-IP window key)', () => {
  it('uses the hop Google appended, not the left-most entry a client can write', () => {
    // functions-framework trusts the proxy, so Express's req.ip is the client-supplied left-most entry.
    const spoofed = (n: number) => ({ ip: `198.51.100.${n}`, headers: { 'x-forwarded-for': `198.51.100.${n}, 203.0.113.7` } });
    expect(clientIp(spoofed(1))).toBe('203.0.113.7');
    const window = new MemoryWindow(3, 3600_000);
    const allowed = Array.from({ length: 10 }, (_, n) => window.take(clientIp(spoofed(n))!, 0)).filter(Boolean);
    expect(allowed).toHaveLength(3);
  });

  it('handles a repeated header and falls back to the socket address without one', () => {
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-forwarded-for': ['1.1.1.1, 2.2.2.2', ' 203.0.113.9 '] } })).toBe('203.0.113.9');
    expect(clientIp({ ip: '10.0.0.1', headers: {} })).toBe('10.0.0.1');
    expect(clientIp({ ip: '10.0.0.1', headers: { 'x-forwarded-for': ' , ' } })).toBe('10.0.0.1');
    expect(clientIp(undefined)).toBeUndefined();
  });
});

describe('MemoryWindow and LruCache', () => {
  it('limits per key within a fixed window', () => {
    const w = new MemoryWindow(2, 1000);
    expect([w.take('a', 0), w.take('a', 10), w.take('a', 20), w.take('b', 20)]).toEqual([true, true, false, true]);
    expect(w.take('a', 1000)).toBe(true);
  });

  it('peek does not change recency; set evicts the least recently used', () => {
    const c = new LruCache<string, number>(2);
    c.set('a', 1);
    c.set('b', 2);
    expect(c.peek('a')).toBe(1);
    c.set('c', 3);
    expect(c.keys()).toEqual(['b', 'c']);
    c.set('b', 4);
    c.set('d', 5);
    expect(c.keys()).toEqual(['b', 'd']);
  });
});
