import { lexiconCheck, normalizeTag } from '@grouper/core';
import { checkInterestOnDevice } from '@/features/interests/onDeviceCheck';

describe('on-device interest check (DESIGN.md §5.2 (0))', () => {
  it('passes ordinary tags through with the shared normalization', () => {
    expect(checkInterestOnDevice('  Madlavning 🍳 ')).toEqual({
      kind: 'ok',
      display: 'Madlavning 🍳',
      norm: 'madlavning',
      thirdPartyWarning: false,
    });
    expect(checkInterestOnDevice('C++')).toMatchObject({ kind: 'ok', norm: 'c++' });
  });

  it('asks for consent before sending a lexicon hit, in Danish and English', () => {
    for (const text of ['gravid', 'Pregnant with our first', 'AA møder', 'ufrivilligt barnløs', 'Type 1 diabetes']) {
      const result = checkInterestOnDevice(text);
      expect(result.kind).toBe('needsConsent');
    }
    expect(checkInterestOnDevice('gravid')).toMatchObject({ kind: 'needsConsent', categories: ['health'] });
  });

  it('asks for consent for "Keep this private" on an ordinary tag', () => {
    expect(checkInterestOnDevice('brætspil', { selfFlag: true })).toMatchObject({ kind: 'needsConsent', norm: 'brætspil', categories: [] });
  });

  it("refuses a family member's sensitive data without sending it", () => {
    expect(checkInterestOnDevice('min søns autisme')).toEqual({ kind: 'refused', code: 'THIRD_PARTY_SENSITIVE' });
    expect(checkInterestOnDevice("my daughter's diabetes")).toEqual({ kind: 'refused', code: 'THIRD_PARTY_SENSITIVE' });
  });

  it('allows the reworded form about the user themself', () => {
    expect(checkInterestOnDevice('forælder til et barn med autisme').kind).toBe('needsConsent');
  });

  it('only warns for an ordinary third-party tag', () => {
    expect(checkInterestOnDevice('min datters fodbold')).toMatchObject({ kind: 'ok', thirdPartyWarning: true });
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
    expect(checkInterestOnDevice(sneaky).kind).toBe('needsConsent');
  });

  it('agrees with the server-side lexicon on the normalized text', () => {
    for (const text of ['Yoga', 'graviditetsyoga', 'kirkekor', 'Christiania', 'Pride parade volunteering']) {
      const n = normalizeTag(text);
      if (!n.ok) throw new Error('fixture must normalize');
      expect(checkInterestOnDevice(text).kind === 'needsConsent').toBe(lexiconCheck(n.norm).hit);
    }
  });
});
