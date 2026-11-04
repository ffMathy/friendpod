import { normalizeTag } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { leetFold, moderateTag } from '../src/moderation';

function moderate(text: string): ReturnType<typeof moderateTag> {
  const n = normalizeTag(text);
  if (!n.ok) throw new Error('fixture does not normalize');
  return moderateTag(n.norm, n.display);
}

describe('moderateTag', () => {
  it('rejects contact details, including ones normalization would strip', () => {
    expect(moderate('@lisa_k')).toEqual({ ok: false, reason: 'PII' });
    expect(moderate('ring 20 30 40 50')).toEqual({ ok: false, reason: 'PII' });
    expect(moderate('mig@example.dk')).toEqual({ ok: false, reason: 'PII' });
  });

  it('blocks starter-list terms on a leetspeak-folded copy', () => {
    expect(leetFold('3sc0rt')).toBe('escort');
    expect(moderate('3sc0rt')).toEqual({ ok: false, reason: 'BLOCKLIST' });
    expect(moderate('Sugar Daddy')).toEqual({ ok: false, reason: 'BLOCKLIST' });
    expect(moderate('køb hash')).toEqual({ ok: false, reason: 'BLOCKLIST' });
  });

  it('lets recovery and support interests through', () => {
    expect(moderate('recovering from cocaine addiction')).toEqual({ ok: true, thirdParty: false });
    expect(moderate('anonyme alkoholikere')).toEqual({ ok: true, thirdParty: false });
  });

  it('reports possessive kinship as a third-party signal', () => {
    expect(moderate('min datters fodbold')).toEqual({ ok: true, thirdParty: true });
    expect(moderate('forælder til et barn med autisme')).toEqual({ ok: true, thirdParty: false });
  });
});
