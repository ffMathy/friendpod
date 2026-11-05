import { describe, expect, it } from 'vitest';
import { buildCardReasons } from '../src/reasons';
import { matchProfileInterests, ordinaryHoldingFromDoc, sensitiveHoldingFromDoc } from '../src/types/holdings';

const ts = { toMillis: () => 0 };

describe('card reasons (§6.7)', () => {
  const base = { openToAnyone: false, yourThemeWording: 'brætspil', alsoShareWordings: ['løb', 'kaffe', 'skak', 'film'], areaLabel: 'Aarhus C', nearKm: 10, ageSpan: { min: 27, max: 34 }, priorityWeeks: 2 };

  it('ordinary themes carry ALSO_SHARE (≤ 3) and AGE_SPAN', () => {
    expect(buildCardReasons({ ...base, themeSensitive: false })).toEqual([
      { code: 'THEME', yourWording: 'brætspil' },
      { code: 'ALSO_SHARE', yourWordings: ['løb', 'kaffe', 'skak'] },
      { code: 'AREA', label: 'Aarhus C' },
      { code: 'NEAR_YOU', km: 10 },
      { code: 'AGE_SPAN', min: 27, max: 34 },
      { code: 'PRIORITY', weeks: 2 },
    ]);
  });

  it('sensitive themes never carry ALSO_SHARE or AGE_SPAN', () => {
    const codes = buildCardReasons({ ...base, themeSensitive: true, yourThemeWording: 'gravid' }).map((r) => r.code);
    expect(codes).toEqual(['THEME', 'AREA', 'NEAR_YOU', 'PRIORITY']);
  });

  it('open-to-anyone pods have no theme wording', () => {
    expect(buildCardReasons({ ...base, themeSensitive: false, openToAnyone: true, yourThemeWording: null, priorityWeeks: null })[0]).toEqual({ code: 'OPEN_TO_ANYONE' });
    expect(() => buildCardReasons({ ...base, themeSensitive: false, yourThemeWording: null })).toThrow();
  });
});

describe('holdings (§5.2 (5))', () => {
  const ordinary = ordinaryHoldingFromDoc('aaaaaaaaaaaaaaaa', { display: 'Brætspil', norm: 'brætspil', conceptId: 'c_00000000000000000001', starred: true, state: 'active', createdAt: ts })!;
  const sensitive = sensitiveHoldingFromDoc('bbbbbbbbbbbbbbbb', {
    display: 'Brætspil',
    norm: 'brætspil',
    conceptId: 'c_00000000000000000001_p',
    selfFlagged: true,
    source: 'self',
    consentEventId: 'ce1',
    consentTextVersion: 'art9-blanket-da-v1',
    consentedAt: ts,
    starred: false,
  });

  it('builds secondary only from ordinary holdings and themes from both, with consent refs', () => {
    expect(matchProfileInterests([ordinary], [sensitive])).toEqual({
      themes: [
        { c: 'c_00000000000000000001', starred: true, sens: false },
        { c: 'c_00000000000000000001_p', starred: false, sens: true, consentRef: 'ce1' },
      ],
      themeIds: ['c_00000000000000000001', 'c_00000000000000000001_p'],
      secondary: ['c_00000000000000000001'],
    });
  });

  it('keeps a star when another wording of the same concept comes first', () => {
    const doc = (display: string, starred: boolean) => ({ display, norm: display, conceptId: 'c_00000000000000000002', starred, state: 'active' as const, createdAt: ts });
    const lob = ordinaryHoldingFromDoc('aaaaaaaaaaaaaaab', doc('løb', false))!;
    const running = ordinaryHoldingFromDoc('aaaaaaaaaaaaaaac', doc('running', true))!;
    for (const order of [[lob, running], [running, lob]]) {
      expect(matchProfileInterests(order, []).themes).toEqual([{ c: 'c_00000000000000000002', starred: true, sens: false }]);
    }
  });

  it('excludes pending holdings and rejects sensitive holdings without consent', () => {
    expect(ordinaryHoldingFromDoc('cccccccccccccccc', { display: 'x', norm: 'xx', conceptId: null, starred: false, state: 'pendingConsent', createdAt: ts })).toBeNull();
    expect(() => sensitiveHoldingFromDoc('dddddddddddddddd', { ...sensitiveDoc(), consentEventId: '' })).toThrow();
  });
});

function sensitiveDoc() {
  return { display: 'x', norm: 'xx', conceptId: 'c_00000000000000000009_p', selfFlagged: true, source: 'self' as const, consentEventId: 'ce', consentTextVersion: 'v', consentedAt: ts, starred: false };
}
