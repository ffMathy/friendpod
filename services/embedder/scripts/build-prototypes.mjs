// Embeds the prototype phrases (prototypes/*.json) with the real model into dist/prototypes.bin
// (DESIGN.md §5.2 (4)). The file header fingerprints model, prompts and phrase lists; the service refuses a
// stale file at load.
//
//   npm run build-prototypes               # fails without ./model (run fetch-model first)
//   node scripts/build-prototypes.mjs --if-model   # used by `npm run build`: skips when ./model is absent (CI)
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importTs, SERVICE_ROOT } from './ts.mjs';

const root = fileURLToPath(SERVICE_ROOT);
const { MODEL } = await importTs('src/config.ts');
const modelDir = join(root, 'model');
const missing = MODEL.files.map((f) => join(modelDir, MODEL.hfRepo, f.path)).filter((p) => !existsSync(p));
if (missing.length > 0) {
  const msg = `prototypes.bin: model files missing under ${modelDir} (run \`npm run fetch-model\`)`;
  if (process.argv.includes('--if-model')) {
    console.log(`skipped ${msg}`);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

const { TransformersEmbedder } = await importTs('src/model.ts');
const { computePrototypes, encodePrototypes, PROTOTYPE_LISTS } = await importTs('src/detect.ts');
const embedder = new TransformersEmbedder(MODEL, { modelDir, threads: availableParallelism() });
const prototypes = await computePrototypes(embedder, MODEL, PROTOTYPE_LISTS);
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', 'prototypes.bin');
writeFileSync(out, encodePrototypes(prototypes, MODEL));
console.log(
  `wrote ${out}: ${prototypes.art9.length} Art. 9, ${prototypes.anchors.length} anchors, ${prototypes.abuse.length} abuse; fingerprint ${prototypes.fingerprint.slice(0, 12)}`,
);
