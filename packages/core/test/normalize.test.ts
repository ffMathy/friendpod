import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalizeTag, tagLength } from '../src/interests/normalize';

const norm = (s: string): string | null => {
  const r = normalizeTag(s);
  return r.ok ? r.norm : null;
};

describe('normalizeTag (§5.2 (1))', () => {
  it.each([
    ['Madlavning', 'madlavning'],
    ['  Brætspil   og   kaffe ', 'brætspil og kaffe'],
    ['C++', 'c++'],
    ['D&D', 'd&d'],
    ['#MeToo', '#metoo'],
    ['C#', 'c#'],
    ['"Fortnite"!!', 'fortnite'],
    ['…vandring…', 'vandring'],
    ['«Surdejsbrød»', 'surdejsbrød'],
    ['Rock’n’roll', 'rock’n’roll'],
    ['ＦＵＬＬＷＩＤＴＨ', 'fullwidth'],
    ['ﬁskeri', 'fiskeri'],
  ])('%j → %j', (input, expected) => {
    expect(norm(input)).toBe(expected);
  });

  it('keeps diacritics: "får" and "far" stay different', () => {
    expect(norm('Får')).toBe('får');
    expect(norm('far')).toBe('far');
    expect(norm('Åben')).toBe('åben');
    expect(norm('Øl')).toBe('øl');
  });

  it('removes emoji, including ZWJ sequences, flags, skin tones and keycaps', () => {
    expect(norm('🎲 Board games 🎲')).toBe('board games');
    expect(norm('Løb 🏃🏽‍♀️')).toBe('løb');
    expect(norm('Danmark 🇩🇰')).toBe('danmark');
    expect(norm('kaffe ☕️ og 🍰 kage')).toBe('kaffe og kage');
    expect(norm('Top 3️⃣')).toBe('top 3');
    expect(norm('🎉🎉')).toBeNull();
  });

  it('removes invisible format characters that would dodge the blocklist', () => {
    expect(norm('mad\u200blavning')).toBe('madlavning');
    expect(norm('gra\u00advid')).toBe('gravid');
    expect(norm('\u202eevil')).toBe('evil');
  });

  it('enforces 2–40 code points after normalization, never truncating', () => {
    expect(normalizeTag('a')).toEqual({ ok: false, code: 'TAG_TOO_SHORT' });
    expect(normalizeTag('  !! ')).toEqual({ ok: false, code: 'TAG_TOO_SHORT' });
    expect(norm('ab')).toBe('ab');
    expect(norm('x'.repeat(40))).toBe('x'.repeat(40));
    expect(normalizeTag('x'.repeat(41))).toEqual({ ok: false, code: 'TAG_TOO_LONG' });
    expect(norm('ø'.repeat(40))).toBe('ø'.repeat(40));
    // Emoji do not count towards the limit once removed.
    expect(norm(`${'y'.repeat(40)} 🎉`)).toBe('y'.repeat(40));
  });

  it('keeps the typed wording (case, emoji) as display', () => {
    const r = normalizeTag('  Brætspil  🎲 ');
    expect(r).toEqual({ ok: true, norm: 'brætspil', display: 'Brætspil 🎲' });
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 60 }), (s) => {
        const once = normalizeTag(s);
        if (!once.ok) return;
        const twice = normalizeTag(once.norm);
        expect(twice.ok && twice.norm).toBe(once.norm);
      }),
      { numRuns: 2000 },
    );
  });

  it('never returns a result outside the length bounds', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 80 }), (s) => {
        const r = normalizeTag(s);
        if (r.ok) {
          expect(tagLength(r.norm)).toBeGreaterThanOrEqual(2);
          expect(tagLength(r.norm)).toBeLessThanOrEqual(40);
          expect(r.norm).toBe(r.norm.trim());
          expect(r.norm).not.toMatch(/\s{2}/);
        }
      }),
      { numRuns: 2000 },
    );
  });
});
