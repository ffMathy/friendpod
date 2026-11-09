import { createHash } from 'node:crypto';
import { bucketOf, colorOnPodScreen, fnv1a32, POD_COLORS, podColorFor, podColorIndex, podColorOfTheme } from '@/lib/podColor';

describe('pod colour from the concept id (blend spec §3)', () => {
  it('FNV-1a 32 known answers', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('hashes UTF-8 bytes, not UTF-16 code units', () => {
    // "æ" is U+00E6: two UTF-8 bytes C3 A6. "😀" is one code point, four bytes F0 9F 98 80.
    const manual = (bytes: number[]) => bytes.reduce((h, b) => Math.imul(h ^ b, 0x01000193) >>> 0, 0x811c9dc5);
    expect(fnv1a32('æ')).toBe(manual([0xc3, 0xa6]));
    expect(fnv1a32('😀')).toBe(manual([0xf0, 0x9f, 0x98, 0x80]));
    expect(fnv1a32('brætspil')).toBe(manual([...Buffer.from('brætspil', 'utf8')]));
  });

  it.each([
    ['seed_board_games', 0x0806ba99, 0, 'solsikke'],
    ['seed_parental_leave', 0x3b3d8ede, 1, 'blad'],
    ['seed_sourdough', 0x5df1f605, 2, 'baer'],
    ['seed_trail_running', 0x961c7371, 3, 'tomat'],
    ['seed_cooking', 0xb16e8dc1, 4, 'fjord'],
    ['seed_coffee', 0xe56267af, 5, 'blomme'],
    ['c_00000000000000000001', 0x3f69a15a, 1, 'blad'],
  ] as const)('%s → h %i, index %i, %s', (conceptId, h, index, colour) => {
    expect(fnv1a32(`grouper:${conceptId}`)).toBe(h);
    expect(podColorIndex(conceptId)).toBe(index);
    expect(podColorFor({ conceptId })).toBe(colour);
  });

  it('buckets with floor(h * 6 / 2^32), not h % 6', () => {
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(715827882)).toBe(0);
    expect(bucketOf(715827883)).toBe(1);
    expect(bucketOf(4294967295)).toBe(5);
    // The BigInt form of the spec agrees on every vector and edge.
    for (const h of [0, 1, 715827882, 715827883, 1431655765, 1431655766, 2147483648, 3848431535, 4294967295]) {
      expect(bucketOf(h)).toBe(Number((BigInt(h) * 6n) >> 32n));
    }
  });

  it('order of the six colours is the index', () => {
    expect(POD_COLORS).toEqual(['solsikke', 'blad', 'baer', 'tomat', 'fjord', 'blomme']);
  });

  it('spreads concept ids evenly over the six colours', () => {
    // Real concept ids are `c_` + 20 hex digits of an HMAC (core `newConceptId`); a SHA-256 stands in for it here.
    const counts = [0, 0, 0, 0, 0, 0];
    const n = 60000;
    for (let i = 0; i < n; i++) counts[podColorIndex(`c_${createHash('sha256').update(`concept ${i}`).digest('hex').slice(0, 20)}`)]! += 1;
    for (const c of counts) {
      expect(c).toBeGreaterThan((n / 6) * 0.95);
      expect(c).toBeLessThan((n / 6) * 1.05);
    }
  });

  it('private stays quiet; open-to-anyone pods take the pod id; nothing to hash gives no colour', () => {
    expect(podColorFor({ conceptId: 'seed_sourdough', sensitive: true })).toBeNull();
    expect(podColorFor({})).toBeNull();
    expect(podColorFor({ conceptId: null })).toBeNull();
    expect(podColorFor({ podId: 'seed_coffee' })).toBe('blomme');
    expect(podColorOfTheme({ kind: 'concept', conceptId: 'seed_cooking', sensitive: false }, 'pod1')).toBe('fjord');
    expect(podColorOfTheme({ kind: 'concept', conceptId: 'seed_cooking', sensitive: true }, 'pod1')).toBeNull();
    expect(podColorOfTheme({ kind: 'openToAnyone' }, 'seed_cooking')).toBe('fjord');
  });

  it("a different interest in the pod's colour is plain on the pod's screens", () => {
    expect(colorOnPodScreen('tomat', 'tomat')).toBe('clash');
    expect(colorOnPodScreen('tomat', 'tomat', true)).toBe('tomat');
    expect(colorOnPodScreen('baer', 'tomat')).toBe('baer');
    expect(colorOnPodScreen(null, 'tomat')).toBeNull();
    expect(colorOnPodScreen('baer', null)).toBe('baer');
  });
});
