import { describe, expect, it } from 'vitest';
import { isBlocklisted } from '../src/interests/blocklist';
import { isKnownOrdinary, KNOWN_ORDINARY_VERSION, KNOWN_ORDINARY_WORDS } from '../src/interests/knownOrdinary';
import { lexiconCheck } from '../src/interests/lexicon';
import { normalizeTag } from '../src/interests/normalize';
import { findPii } from '../src/interests/pii';
import { detectThirdParty } from '../src/interests/thirdParty';
import listJson from '../src/interests/data/known-ordinary.da-en.json';

describe('known-ordinary hobby words (D2)', () => {
  it('has 300–500 unique da/en entries under a version', () => {
    expect(KNOWN_ORDINARY_VERSION).toMatch(/^known-ordinary-\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(KNOWN_ORDINARY_WORDS.length).toBeGreaterThanOrEqual(300);
    expect(KNOWN_ORDINARY_WORDS.length).toBeLessThanOrEqual(500);
    expect(new Set(KNOWN_ORDINARY_WORDS).size).toBe(KNOWN_ORDINARY_WORDS.length);
    expect(listJson.da.length).toBeGreaterThan(150);
    expect(listJson.en.length).toBeGreaterThan(150);
  });

  it.each(KNOWN_ORDINARY_WORDS.map((w) => [w]))('%s is normalised and has no Art. 9, blocklist, PII or third-party signal', (w) => {
    const n = normalizeTag(w);
    expect(n.ok && n.norm).toBe(w);
    expect(lexiconCheck(w).hit).toBe(false);
    expect(isBlocklisted(w)).toBe(false);
    expect(findPii(w)).toEqual([]);
    expect(detectThirdParty(w).hit).toBe(false);
  });

  it('matches whole normalised tags only', () => {
    expect(isKnownOrdinary('madlavning')).toBe(true);
    expect(isKnownOrdinary('board games')).toBe(true);
    expect(isKnownOrdinary('Madlavning')).toBe(false);
    expect(isKnownOrdinary('madlavning for gravide')).toBe(false);
    expect(isKnownOrdinary('kirkekor')).toBe(false);
  });
});
