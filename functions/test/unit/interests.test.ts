import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WITHDRAWAL_REMOVES_HOLDINGS } from '../../src/callables/art9Consent';
import { ART9_HOLDINGS_ENABLED } from '../../src/interests/config';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

describe('interest pipeline configuration', () => {
  it('accepts no sensitive holdings while their withdrawal is not built (Art. 7(3))', () => {
    const callables = readFileSync(join(SRC, 'callables/index.ts'), 'utf8');
    const removeIsStub = /export const removeInterest = stub\(/.test(callables);
    expect(ART9_HOLDINGS_ENABLED && (removeIsStub || !WITHDRAWAL_REMOVES_HOLDINGS)).toBe(false);
  });

  it("has no sensitivity source of its own: the phone's margin decides (F38)", () => {
    // No word list, no server-side prototypes and no margin recomputed from the stored or client vector.
    const forbidden = [/lexicon/i, /knownOrdinary/i, /\bdetectorMargin\(/, /decodePrototypes|Prototypes\b|prototypes\.bin/, /rescan/i, /pendingConsent/];
    const files = [
      ...readdirSync(join(SRC, 'interests')).map((f) => join(SRC, 'interests', f)),
      join(SRC, 'callables/addInterests.ts'),
      join(SRC, 'tasks/interestsBatch.ts'),
      join(SRC, 'scheduled/maintenance.ts'),
    ];
    const offenders = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      return forbidden.filter((re) => re.test(text)).map((re) => `${f}: ${re}`);
    });
    expect(offenders).toEqual([]);
  });

  it('leaves the model, prompts, dimension and thresholds to core', () => {
    const forbidden = [/\b0\.(?:78|8[26]|9[0135]|925)\b/, /-0\.03\b/, /embeddinggemma/i, /eg2-q4|eg300m-q4/, /task: (?:sentence similarity|classification)/, /\b768\b/];
    const files = [...readdirSync(join(SRC, 'interests')).map((f) => join(SRC, 'interests', f)), join(SRC, 'callables/addInterests.ts')];
    const offenders = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      return forbidden.filter((re) => re.test(text)).map((re) => `${f}: ${re}`);
    });
    expect(offenders).toEqual([]);
  });
});
