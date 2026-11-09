import { APP_ERRORS, MODERATION_REASONS, UNMATCHED_REASONS } from '@friendpod/core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS, areaFiles, da, en } from '@/i18n/resources';

type Tree = { readonly [key: string]: string | Tree };

function leafKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : leafKeys(v, `${prefix}${k}.`)));
}

const strip = (key: string) => key.replace(/_(one|other)$/, '');
const enKeys = new Set(leafKeys(en as Tree));
const enBase = new Set([...enKeys].map(strip));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('translations', () => {
  it('Danish and English have exactly the same keys', () => {
    expect(new Set(leafKeys(da as Tree))).toEqual(enKeys);
  });

  it.each(AREAS)('%s: Danish and English have the same keys', (area) => {
    expect(new Set(leafKeys(areaFiles.da[area]))).toEqual(new Set(leafKeys(areaFiles.en[area])));
  });

  it.each(['en', 'da'] as const)('%s: no key is defined in two area files', (lang) => {
    const owner = new Map<string, string>();
    const duplicates: string[] = [];
    for (const area of AREAS) {
      for (const key of leafKeys(areaFiles[lang][area])) {
        const first = owner.get(key);
        if (first) duplicates.push(`${key} (${first}, ${area})`);
        else owner.set(key, area);
      }
    }
    expect(duplicates).toEqual([]);
    // A key path is either a string or a group, never both across files (it would be lost in the merge).
    const groups = new Set([...owner.keys()].flatMap((k) => k.split('.').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('.'))));
    expect([...owner.keys()].filter((k) => groups.has(k))).toEqual([]);
    expect(leafKeys((lang === 'en' ? en : da) as Tree).length).toBe(owner.size);
  });

  it('the area files cover exactly the eight areas', () => {
    const dir = join(__dirname, '..', 'src', 'i18n');
    for (const lang of ['en', 'da']) {
      expect(readdirSync(join(dir, lang)).sort()).toEqual(AREAS.map((a) => `${a}.json`).sort());
    }
  });

  it('cover every app error code, moderation reason and unmatched reason', () => {
    for (const code of [...Object.keys(APP_ERRORS), 'NETWORK', 'UNKNOWN']) expect(enBase).toContain(`errors.${code}`);
    for (const code of MODERATION_REASONS) expect(enBase).toContain(`moderation.${code}`);
    for (const code of UNMATCHED_REASONS) expect(enBase).toContain(`unmatched.${code}`);
  });

  it('every literal key used in the source exists', () => {
    const root = join(__dirname, '..');
    const files = [...sourceFiles(join(root, 'app')), ...sourceFiles(join(root, 'src'))];
    const used = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\bt\('([^'$]+)'/g)].map((m) => m[1] as string));
    expect(used.length).toBeGreaterThan(100);
    expect(used.filter((k) => !enBase.has(k))).toEqual([]);
  });
});
