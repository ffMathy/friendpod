import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { base64Decode, base64Encode } from '../src/util/base64';
import { utf8Encode } from '../src/util/utf8';
import { xxhash32 } from '../src/util/xxhash32';

describe('xxhash32', () => {
  it('matches reference vectors', () => {
    expect(xxhash32('')).toBe(0x02cc5d05);
    expect(xxhash32('a')).toBe(0x550d7456);
    expect(xxhash32('abc')).toBe(0x32d153ff);
    expect(xxhash32('Nobody inspects the spammish repetition')).toBe(0xe2293b2f);
    expect(xxhash32('abc', 1)).not.toBe(xxhash32('abc'));
  });
});

describe('utf8 and base64', () => {
  it('encodes UTF-8 like TextEncoder', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 50 }), (s) => {
        expect(Array.from(utf8Encode(s))).toEqual(Array.from(new TextEncoder().encode(s)));
      }),
    );
  });

  it('round-trips base64 and agrees with Buffer', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 100 }), (bytes) => {
        const text = base64Encode(bytes);
        expect(text).toBe(Buffer.from(bytes).toString('base64'));
        expect(Array.from(base64Decode(text))).toEqual(Array.from(bytes));
      }),
    );
    expect(() => base64Decode('abc')).toThrow();
    expect(() => base64Decode('ab!=')).toThrow();
  });
});
