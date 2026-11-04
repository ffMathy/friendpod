import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { base32 } from '../src/ids/base32';
import { webCryptoHmacSha256 } from '../src/ids/hmac';
import { emailHash, identityHash, interestId, podId, uidHash } from '../src/ids/podId';
import { nodeHmacSha256, sha256Hex } from '../src/node';
import type { WeekId } from '../src/types/ids';

const KEY = new Uint8Array(32).map((_, i) => i + 1);
const W = '2026-W46' as WeekId;

describe('base32', () => {
  it('matches RFC 4648 test vectors (lowercase, unpadded)', () => {
    const enc = (s: string) => base32(new TextEncoder().encode(s));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('my');
    expect(enc('fo')).toBe('mzxq');
    expect(enc('foo')).toBe('mzxw6');
    expect(enc('foob')).toBe('mzxw6yq');
    expect(enc('fooba')).toBe('mzxw6ytb');
    expect(enc('foobar')).toBe('mzxw6ytboi');
  });
});

describe('pod ids and pseudonyms (§6.5, §8)', () => {
  const hmac = nodeHmacSha256(KEY);

  it('is stable and independent of member order', async () => {
    const a = await podId(hmac, W, ['uidC', 'uidA', 'uidB', 'uidD']);
    const b = await podId(hmac, W, ['uidA', 'uidB', 'uidC', 'uidD']);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-z2-7]{20}$/);
    // Locked value: changing the message format would orphan retried releases.
    expect(a).toBe('sztfzyxfiz3pskduy6qc');
  });

  it('changes with the week, the member set and the key', async () => {
    const base = await podId(hmac, W, ['uidA', 'uidB', 'uidC', 'uidD']);
    expect(await podId(hmac, '2026-W47' as WeekId, ['uidA', 'uidB', 'uidC', 'uidD'])).not.toBe(base);
    expect(await podId(hmac, W, ['uidA', 'uidB', 'uidC', 'uidE'])).not.toBe(base);
    expect(await podId(nodeHmacSha256(new Uint8Array(32).fill(9)), W, ['uidA', 'uidB', 'uidC', 'uidD'])).not.toBe(base);
  });

  it('gives the same ids with Web Crypto (React Native path) and node:crypto', async () => {
    const web = webCryptoHmacSha256(webcrypto.subtle, KEY);
    const uids = ['x1', 'x2', 'x3', 'x4', 'x5'];
    expect(await podId(web, W, uids)).toBe(await podId(hmac, W, uids));
    expect(await uidHash(web, 'abc')).toBe(await uidHash(hmac, 'abc'));
  });

  it('rejects malformed input instead of producing an ambiguous message', async () => {
    await expect(podId(hmac, W, [])).rejects.toThrow();
    await expect(podId(hmac, W, ['a', 'a', 'b', 'c'])).rejects.toThrow(/duplicate/);
    await expect(podId(hmac, W, ['a|b', 'c', 'd', 'e'])).rejects.toThrow();
    await expect(podId(hmac, '2026-46' as WeekId, ['a', 'b', 'c', 'd'])).rejects.toThrow();
    expect(() => nodeHmacSha256(new Uint8Array(16))).toThrow();
  });

  it('domain-separates uidH, interestId and email hashes', async () => {
    const uidH = await uidHash(hmac, 'abc');
    expect(uidH).toMatch(/^[a-z2-7]{20}$/);
    const iid = await interestId(hmac, 'abc', 'madlavning');
    expect(iid).toMatch(/^[a-z2-7]{16}$/);
    expect(await interestId(hmac, 'abd', 'madlavning')).not.toBe(iid);
    expect(await emailHash(hmac, 'ban', ' Anna@Example.dk ')).toBe(await emailHash(hmac, 'ban', 'anna@example.dk'));
    expect(await emailHash(hmac, 'ban', 'anna@example.dk')).not.toBe(await emailHash(hmac, 'underage', 'anna@example.dk'));
    const apple = await identityHash(hmac, 'underage', 'apple.com', '001234.abcdef.0001');
    expect(apple).toMatch(/^[a-z2-7]{32}$/);
    expect(await identityHash(hmac, 'underage', 'google.com', '001234.abcdef.0001')).not.toBe(apple);
    await expect(identityHash(hmac, 'underage', 'apple.com', '')).rejects.toThrow();
  });

  it('exposes sha256 for the Node side', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
