/**
 * Optional real-model smoke test: skipped unless ./model holds the pinned files (`npm run fetch-model`).
 * Proves that TransformersEmbedder loads EmbeddingGemma text-only from local files and that the
 * detector and assignment behave sensibly on a few da/en tags.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MODEL } from '../src/config';
import { computePrototypes, detectorMargin, PROTOTYPE_LISTS } from '../src/detect';
import { dot } from '../src/lib/vectors';
import { TransformersEmbedder } from '../src/model';

const MODEL_DIR = fileURLToPath(new URL('../model/', import.meta.url));
const present = MODEL.files.every((f) => existsSync(`${MODEL_DIR}${MODEL.hfRepo}/${f.path}`));

describe.skipIf(!present)('TransformersEmbedder (real model)', () => {
  it('embeds da/en tags into unit vectors with sensible neighbours and detector margins', async () => {
    let loadMs = -1;
    const embedder = new TransformersEmbedder(MODEL, { modelDir: MODEL_DIR, threads: 2, onLoaded: (ms) => (loadMs = ms) });
    const [madlavning, cooking, braetspil, gravid] = await embedder.embed(['madlavning', 'cooking', 'brætspil', 'gravid'], MODEL.tagPrompt);
    expect(loadMs).toBeGreaterThan(0);
    for (const v of [madlavning, cooking, braetspil, gravid]) {
      expect(v).toHaveLength(MODEL.dim);
      expect(dot(v!, v!)).toBeCloseTo(1, 4);
    }
    expect(dot(madlavning!, cooking!)).toBeGreaterThan(dot(madlavning!, braetspil!));

    const prototypes = await computePrototypes(embedder, MODEL, PROTOTYPE_LISTS);
    expect(detectorMargin(gravid!, prototypes).margin).toBeGreaterThanOrEqual(MODEL.detectorMargin);
    const [videoGames] = await embedder.embed(['video games'], MODEL.detectorPrompt);
    expect(detectorMargin(videoGames!, prototypes).margin).toBeLessThan(MODEL.detectorMargin);
  }, 120_000);
});
