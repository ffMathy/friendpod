import { APP_ERRORS, MODERATION_REASONS, UNMATCHED_REASONS } from '@grouper/core';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import da from '@/i18n/da.json';
import en from '@/i18n/en.json';

type Tree = { [key: string]: string | Tree };

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
