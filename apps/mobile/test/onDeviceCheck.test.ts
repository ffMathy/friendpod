import { normalizeTag } from '@grouper/core';
import { checkInterestOnDevice } from '@/features/interests/onDeviceCheck';

describe('on-device interest check (DESIGN.md §5.2 (0))', () => {
  it('passes tags through with the shared normalization', () => {
    expect(checkInterestOnDevice('  Madlavning 🍳 ')).toEqual({
      kind: 'ok',
      display: 'Madlavning 🍳',
      norm: 'madlavning',
      thirdParty: false,
    });
    expect(checkInterestOnDevice('C++')).toMatchObject({ kind: 'ok', norm: 'c++' });
  });

  it('decides nothing about sensitivity: that is the on-device model alone (F35)', () => {
    for (const text of ['gravid', 'Pregnant with our first', 'AA møder', 'Type 1 diabetes']) {
      const r = checkInterestOnDevice(text);
      expect(r).toMatchObject({ kind: 'ok', thirdParty: false });
      expect(Object.keys(r).sort()).toEqual(['display', 'kind', 'norm', 'thirdParty']);
    }
  });

  it('marks the kinship pattern for the later third-party rule, in Danish and English', () => {
    expect(checkInterestOnDevice('min søns autisme')).toMatchObject({ kind: 'ok', thirdParty: true });
    expect(checkInterestOnDevice("my daughter's diabetes")).toMatchObject({ kind: 'ok', thirdParty: true });
    expect(checkInterestOnDevice('min datters fodbold')).toMatchObject({ kind: 'ok', thirdParty: true });
    expect(checkInterestOnDevice('forælder til et barn med autisme')).toMatchObject({ kind: 'ok', thirdParty: false });
  });

  it('rejects contact details and invalid lengths before anything is sent', () => {
    expect(checkInterestOnDevice('ring 12 34 56 78')).toEqual({ kind: 'rejected', code: 'PII' });
    expect(checkInterestOnDevice('snap: hyggehans')).toEqual({ kind: 'rejected', code: 'PII' });
    expect(checkInterestOnDevice('x')).toEqual({ kind: 'invalid', code: 'TAG_TOO_SHORT' });
    expect(checkInterestOnDevice('🎲🎲')).toEqual({ kind: 'invalid', code: 'TAG_TOO_SHORT' });
    expect(checkInterestOnDevice('a'.repeat(41))).toEqual({ kind: 'invalid', code: 'TAG_TOO_LONG' });
  });

  it('strips invisible characters, so the model sees the same text as the server', () => {
    const sneaky = 'gra​vid';
    expect(normalizeTag(sneaky)).toMatchObject({ ok: true, norm: 'gravid' });
    expect(checkInterestOnDevice(sneaky)).toMatchObject({ kind: 'ok', norm: 'gravid' });
  });
});
