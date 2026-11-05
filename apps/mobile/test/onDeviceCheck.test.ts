import { lexiconCheck, normalizeTag } from '@grouper/core';
import { checkInterestOnDevice } from '@/features/interests/onDeviceCheck';

describe('on-device interest check (DESIGN.md §5.2 (0))', () => {
  it('passes ordinary tags through with the shared normalization', () => {
    expect(checkInterestOnDevice('  Madlavning 🍳 ')).toEqual({
      kind: 'ok',
      display: 'Madlavning 🍳',
      norm: 'madlavning',
      lexiconHit: false,
      thirdParty: false,
    });
    expect(checkInterestOnDevice('C++')).toMatchObject({ kind: 'ok', norm: 'c++' });
  });

  it('marks a lexicon hit, in Danish and English', () => {
    for (const text of ['gravid', 'Pregnant with our first', 'AA møder', 'ufrivilligt barnløs', 'Type 1 diabetes']) {
      expect(checkInterestOnDevice(text)).toMatchObject({ kind: 'ok', lexiconHit: true });
    }
  });

  it("refuses a family member's sensitive data without sending it", () => {
    expect(checkInterestOnDevice('min søns autisme')).toEqual({ kind: 'refused', code: 'THIRD_PARTY_SENSITIVE' });
    expect(checkInterestOnDevice("my daughter's diabetes")).toEqual({ kind: 'refused', code: 'THIRD_PARTY_SENSITIVE' });
  });

  it('allows the reworded form about the user themself', () => {
    expect(checkInterestOnDevice('forælder til et barn med autisme')).toMatchObject({ kind: 'ok', lexiconHit: true });
  });

  it('only warns for an ordinary third-party tag', () => {
    expect(checkInterestOnDevice('min datters fodbold')).toMatchObject({ kind: 'ok', lexiconHit: false, thirdParty: true });
  });

  it('rejects contact details and invalid lengths before anything is sent', () => {
    expect(checkInterestOnDevice('ring 12 34 56 78')).toEqual({ kind: 'rejected', code: 'PII' });
    expect(checkInterestOnDevice('snap: hyggehans')).toEqual({ kind: 'rejected', code: 'PII' });
    expect(checkInterestOnDevice('x')).toEqual({ kind: 'invalid', code: 'TAG_TOO_SHORT' });
    expect(checkInterestOnDevice('🎲🎲')).toEqual({ kind: 'invalid', code: 'TAG_TOO_SHORT' });
    expect(checkInterestOnDevice('a'.repeat(41))).toEqual({ kind: 'invalid', code: 'TAG_TOO_LONG' });
  });

  it('cannot be bypassed with invisible characters', () => {
    const sneaky = 'gra​vid';
    expect(normalizeTag(sneaky)).toMatchObject({ ok: true, norm: 'gravid' });
    expect(checkInterestOnDevice(sneaky)).toMatchObject({ lexiconHit: true });
  });

  it('agrees with the server-side lexicon on the normalized text', () => {
    for (const text of ['Yoga', 'graviditetsyoga', 'kirkekor', 'Christiania', 'Pride parade volunteering']) {
      const n = normalizeTag(text);
      if (!n.ok) throw new Error('fixture must normalize');
      expect(checkInterestOnDevice(text)).toMatchObject({ lexiconHit: lexiconCheck(n.norm).hit });
    }
  });
});
