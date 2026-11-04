import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMBEDDING_MODEL, PROTOTYPE_LISTS, StalePrototypesError, encodePrototypes, prototypeTexts } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { WITHDRAWAL_REMOVES_HOLDINGS } from '../../src/callables/art9Consent';
import { ART9_HOLDINGS_ENABLED, PROTOTYPES_RETRY_MS } from '../../src/interests/config';
import { parsePrototypes, prototypeLoader } from '../../src/interests/prototypes';
import { SENSITIVITY_RULES_VERSION } from '../../src/interests/tags';
import { StubVectors } from '../helpers/vectors';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

describe('interest pipeline configuration', () => {
  it('accepts no sensitive holdings while their withdrawal is not built (Art. 7(3))', () => {
    const callables = readFileSync(join(SRC, 'callables/index.ts'), 'utf8');
    const removeIsStub = /export const removeInterest = stub\(/.test(callables);
    expect(ART9_HOLDINGS_ENABLED && (removeIsStub || !WITHDRAWAL_REMOVES_HOLDINGS)).toBe(false);
  });

  it('names the rules every tag-level decision was made with', () => {
    expect(SENSITIVITY_RULES_VERSION).toContain(PROTOTYPE_LISTS.versions.art9);
    expect(SENSITIVITY_RULES_VERSION).toMatch(/^lexicon-.+\+art9-.+\+anchors-.+\+ordinary-.+$/);
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

describe('prototypes.bin on the server', () => {
  const v = new StubVectors({});
  const bytes = encodePrototypes(prototypeTexts().map((t) => v.vector(t)));

  it('decodes the file core encodes, and refuses a stale one', () => {
    const p = parsePrototypes(bytes);
    expect(p.modelKey).toBe(EMBEDDING_MODEL.modelKey);
    expect(p.art9).toHaveLength(PROTOTYPE_LISTS.art9.length);
    expect(p.anchors).toHaveLength(PROTOTYPE_LISTS.anchors.length);
    const broken = bytes.slice();
    broken[0] = 0x58;
    expect(() => parsePrototypes(broken)).toThrow(StalePrototypesError);
  });

  it('caches a loaded file, retries a missing one later, and fails loudly on a stale one', async () => {
    let now = 0;
    let file: Uint8Array | null = null;
    let reads = 0;
    const unavailable: string[] = [];
    const load = prototypeLoader({
      read: async () => {
        reads += 1;
        return file;
      },
      now: () => now,
      onUnavailable: (r) => unavailable.push(r),
    });
    expect(await load()).toBeNull();
    expect(await load()).toBeNull();
    expect(reads).toBe(1);
    file = bytes;
    now = PROTOTYPES_RETRY_MS;
    expect((await load())?.modelKey).toBe(EMBEDDING_MODEL.modelKey);
    await load();
    expect(reads).toBe(2);
    expect(unavailable).toEqual(['missing']);

    const stale = prototypeLoader({ read: async () => new Uint8Array(16), now: () => 0, onUnavailable: () => {} });
    await expect(stale()).rejects.toThrow(StalePrototypesError);
    const failing = prototypeLoader({ read: async () => Promise.reject(new Error('403')), now: () => 0, onUnavailable: (r) => unavailable.push(r) });
    expect(await failing()).toBeNull();
    expect(unavailable).toEqual(['missing', 'unreadable']);
  });
});
