import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { declaredKeys, parseSafely, stackFrames } from '../src/node';

describe('parseSafely (log-safe issue summaries, DESIGN.md §13)', () => {
  const schema = z.strictObject({
    podId: z.string().max(5),
    attendance: z.record(z.string(), z.enum(['came', 'noShow'])),
    items: z.array(z.strictObject({ text: z.string() })),
  });

  it('returns the parsed data when valid', () => {
    const data = { podId: 'p1', attendance: { someUid: 'came' }, items: [{ text: 'a' }] };
    expect(parseSafely(schema, data)).toEqual({ ok: true, data });
  });

  it('keeps declared keys and indices, masks record keys and never carries messages or received values', () => {
    const result = parseSafely(schema, { podId: 'too long', attendance: { aliceUid0000000000000000000a: 'gravid' }, items: [{ text: 5 }] });
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues).toEqual(
      expect.arrayContaining([
        { path: 'podId', code: 'too_big' },
        { path: 'attendance.*', code: 'invalid_value' },
        { path: 'items.0.text', code: 'invalid_type' },
      ]),
    );
    expect(JSON.stringify(issues)).not.toMatch(/aliceUid|gravid|too long/);
  });

  it('collects property names through wrappers such as optional, preprocess and arrays', () => {
    const keys = declaredKeys(z.preprocess((v) => v, z.strictObject({ a: z.strictObject({ b: z.string() }).optional(), c: z.array(z.strictObject({ d: z.number() })) })));
    expect([...keys].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('stackFrames', () => {
  it('keeps the frames and drops the message line', () => {
    const frames = stackFrames(new Error('No document to update: documents/matchProfiles/USER123'));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((f) => f.startsWith('at '))).toBe(true);
    expect(frames.join('\n')).not.toContain('USER123');
    expect(stackFrames('not an error')).toEqual([]);
  });
});
