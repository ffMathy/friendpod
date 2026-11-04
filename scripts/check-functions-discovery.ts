/**
 * Run under `firebase emulators:exec --only functions --project demo-grouper` after the build (CI, DESIGN.md §13).
 * Fails unless the one functions codebase loads from its dist bundle and serves every callable in core's registry
 * (addInterests included since the app embeds tags itself, D1), and unless firebase.json names no other codebase.
 */
import { readFileSync } from 'node:fs';
import { CALLABLES } from '@grouper/core';

const CODEBASE_DIRS = { default: 'functions' } as const;

interface Backend {
  readonly directory: string;
  readonly functionTriggers: readonly { readonly name: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return (await res.json()) as T;
}

const failures: string[] = [];
const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')) as { functions: { source: string; codebase: string }[] };
const configured = config.functions.map((f) => `${f.codebase}:${f.source}`).sort();
const expectedCodebases = Object.entries(CODEBASE_DIRS).map(([codebase, dir]) => `${codebase}:${dir}`).sort();
if (JSON.stringify(configured) !== JSON.stringify(expectedCodebases)) failures.push(`firebase.json functions: ${configured.join(', ')}, expected ${expectedCodebases.join(', ')}`);

const hub = process.env.FIREBASE_EMULATOR_HUB;
if (!hub) throw new Error('FIREBASE_EMULATOR_HUB is not set: run under `firebase emulators:exec --only functions`');
const { functions } = await getJson<{ functions?: { host: string; port: number } }>(`http://${hub}/emulators`);
if (!functions) throw new Error('the functions emulator is not running');
const { backends } = await getJson<{ backends: readonly Backend[] }>(`http://${functions.host}:${functions.port}/backends`);

for (const [codebase, dir] of Object.entries(CODEBASE_DIRS)) {
  const backend = backends.find((b) => b.directory.replace(/\/+$/, '').endsWith(`/${dir}`));
  const loaded = new Set(backend?.functionTriggers.map((t) => t.name) ?? []);
  const expected = Object.entries(CALLABLES)
    .filter(([, spec]) => spec.codebase === codebase)
    .map(([name]) => name);
  if (loaded.size === 0) failures.push(`${codebase} (${dir}): no functions loaded`);
  for (const name of expected) if (!loaded.has(name)) failures.push(`${codebase}: callable ${name} not loaded`);
  console.log(`${codebase} (${dir}): ${loaded.size} functions loaded: ${[...loaded].sort().join(', ')}`);
}
if (backends.length !== Object.keys(CODEBASE_DIRS).length) failures.push(`${backends.length} backends loaded, expected ${Object.keys(CODEBASE_DIRS).length}`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
