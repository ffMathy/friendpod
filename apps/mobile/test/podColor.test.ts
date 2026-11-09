import { createHash } from 'node:crypto';
import { bucketOf, colorKeyOfWord, colorOnPodScreen, fnv1a32, interestColor, POD_COLORS, podColorFor, podColorIndex, wordColorIndex } from '@/lib/podColor';

describe('pod colour from the word shown (blend spec §3, founder decision)', () => {
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
    // The storyboards' colours, reproduced by the "grouper:3410:" salt.
    ['brætspil', 3, 'tomat'],
    ['sourdough', 0, 'solsikke'],
    ['far på barsel', 4, 'fjord'],
    ['trail running', 1, 'blad'],
    ['coffee', 2, 'baer'],
    ['hiking', 5, 'blomme'],
  ] as const)('%s → index %i, %s', (word, index, colour) => {
    expect(bucketOf(fnv1a32(`grouper:3410:${word}`))).toBe(index);
    expect(wordColorIndex(word)).toBe(index);
    expect(podColorFor({ word })).toBe(colour);
  });

  it('colours the normalized word: the same word is the same colour however it is typed', () => {
    expect(colorKeyOfWord('  Brætspil! ')).toBe('brætspil');
    expect(podColorFor({ word: '  Brætspil! ' })).toBe('tomat');
    expect(podColorFor({ word: 'SOURDOUGH 🍞' })).toBe('solsikke');
    expect(podColorFor({ word: 'Far  på   barsel' })).toBe('fjord');
    // Diacritics are kept (normalizeTag): "far" and "får" are different words.
    expect(colorKeyOfWord('får')).toBe('får');
    // A word that does not normalize (too short) still has a key: NFKC, trimmed, lower case.
    expect(colorKeyOfWord(' X ')).toBe('x');
    expect(podColorFor({ word: ' X ' })).toBe(POD_COLORS[bucketOf(fnv1a32('grouper:3410:x'))]);
    expect(podColorFor({ word: 'ＢＲÆＴＳＰＩＬ' })).toBe('tomat');
  });

  it("an interest takes its own word's colour: its norm, else its display", () => {
    expect(interestColor({ norm: 'brætspil', display: 'Brætspil 🎲' })).toBe('tomat');
    expect(interestColor({ display: 'Coffee' })).toBe('baer');
  });

  it('pod ids (open-to-anyone pods) keep the unsalted hash', () => {
    expect(fnv1a32('grouper:seed_coffee')).toBe(0xe56267af);
    expect(podColorIndex('seed_coffee')).toBe(5);
    expect(podColorFor({ podId: 'seed_coffee' })).toBe('blomme');
    expect(podColorFor({ podId: 'c_00000000000000000001' })).toBe('blad');
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

  it('spreads words evenly over the six colours', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    const n = 60000;
    for (let i = 0; i < n; i++) counts[wordColorIndex(`word ${createHash('sha256').update(`w${i}`).digest('hex').slice(0, 8)}`)]! += 1;
    for (const c of counts) {
      expect(c).toBeGreaterThan((n / 6) * 0.95);
      expect(c).toBeLessThan((n / 6) * 1.05);
    }
  });

  it('private stays quiet; open-to-anyone pods take the pod id; nothing to hash gives no colour', () => {
    expect(podColorFor({ word: 'sourdough', sensitive: true })).toBeNull();
    expect(podColorFor({ podId: 'seed_coffee', sensitive: true })).toBeNull();
    expect(podColorFor({})).toBeNull();
    expect(podColorFor({ word: null })).toBeNull();
    expect(podColorFor({ word: '   ' })).toBeNull();
    // A word wins over the pod id; without one the pod id gives the colour.
    expect(podColorFor({ word: 'brætspil', podId: 'seed_coffee' })).toBe('tomat');
    expect(podColorFor({ word: null, podId: 'seed_coffee' })).toBe('blomme');
  });

  it("a different interest in the pod's colour is plain on the pod's screens", () => {
    expect(colorOnPodScreen('tomat', 'tomat')).toBe('clash');
    expect(colorOnPodScreen('tomat', 'tomat', true)).toBe('tomat');
    expect(colorOnPodScreen('baer', 'tomat')).toBe('baer');
    expect(colorOnPodScreen(null, 'tomat')).toBeNull();
    expect(colorOnPodScreen('baer', null)).toBe('baer');
  });
});
