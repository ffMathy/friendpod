/**
 * Run under `firebase emulators:exec --only functions --project demo-grouper` after both builds (CI, DESIGN.md §13).
 * Fails unless both codebases load from their dist bundles, the embedder without model weights (the model loads on
 * the first request, §5.1), and every callable in core's registry is served by the codebase it names.
 */
import { CALLABLES } from '@grouper/core';

const CODEBASE_DIRS = { default: 'functions', embedder: 'services/embedder' } as const;

interface Backend {
  readonly directory: string;
  readonly functionTriggers: readonly { readonly name: string }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url}: ${res.status}`);
  return (await res.json()) as T;
}

const hub = process.env.FIREBASE_EMULATOR_HUB;
if (!hub) throw new Error('FIREBASE_EMULATOR_HUB is not set: run under `firebase emulators:exec --only functions`');
const { functions } = await getJson<{ functions?: { host: string; port: number } }>(`http://${hub}/emulators`);
if (!functions) throw new Error('the functions emulator is not running');
const { backends } = await getJson<{ backends: readonly Backend[] }>(`http://${functions.host}:${functions.port}/backends`);

const failures: string[] = [];
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
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
