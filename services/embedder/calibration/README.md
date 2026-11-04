# Embedder calibration

The model gate and every threshold in [`src/config.ts`](../src/config.ts) come from the reproducible
calibration in [`/research/embedding-calibration`](../../../research/embedding-calibration/README.md)
(DESIGN.md [CAL]). That folder holds the labelled test set, the scripts and the results for EmbeddingGemma
v1 and v2; it is the reference until this directory takes over as the CI gate.

What lives here (DESIGN.md §13, `calibration.yml`):

- `run.ts`: the nightly gate. It loads the pinned model from the GCS mirror (`npm run fetch-model` with
  `GCS_MODEL_BUCKET`), embeds the labelled set with the service's own `TransformersEmbedder` and prompts, and
  fails when sensitive recall drops below 100%, merge precision at the configured threshold drops below
  0.93, or false flags rise by more than 5 points. **Stub until M0.**
- `labelled/` (to be added in M0): synthetic or founder-written tags only. **Never user tags** (DESIGN.md §5.3):
  everything here is on GitHub.

When a threshold changes, change it in `src/config.ts` (or the core constants it imports) and nowhere else,
then re-run the calibration and rebuild `prototypes.bin` (`npm run build-prototypes`).
