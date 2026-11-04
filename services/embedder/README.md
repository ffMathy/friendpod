# services/embedder

Functions codebase `embedder` (DESIGN.md §5, §10.2): `addInterests` (callable) and `embedderBatch` (task
queue), with a self-hosted EmbeddingGemma 2 q4 on CPU. This is a standalone npm project with its own lockfile.
`@grouper/core` is bundled from source through the tsconfig `paths` alias, and its `zod` resolves from the
repo root, so **run `npm ci` at the repo root first**, then `npm ci` here.

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` over src, tests and calibration (core included through the alias) |
| `npm test` | vitest. The Firestore suites run only when `FIRESTORE_EMULATOR_HOST` is set; without it they are skipped locally and fail when `CI` is set |
| `npm run test:emulator` | the same tests under `firebase emulators:exec --only firestore` (uses the repo's firebase.json) |
| `npm run build` | esbuild → `dist/index.js`, then `dist/prototypes.bin` if `./model` is present |
| `npm run fetch-model` | pinned model files → `./model/<repo>/`, verified by hash (`GCS_MODEL_BUCKET` selects our EU mirror) |
| `npm run build-prototypes` | embeds `prototypes/*.json` with the real model into `dist/prototypes.bin` |

`./model`, `dist/` and `*.bin` are gitignored. Model weights are never committed.

## Where things are

- `src/config.ts`: the only place for model id, revision, file hashes, dtype, prompts, dimensions and
  thresholds (core's v2 constants; v1 kept as the fallback). A test fails if another source file names one.
- `src/pipeline.ts` (steps 1–6) and `src/persist.ts` (step 7, one transaction): the §5.2 pipeline,
  including the consent gate (`needsConsent` writes, caches and logs nothing).
- `src/detect.ts`: detector margin and shadow-mode abuse similarity over `prototypes.bin`.
- `src/assign.ts`: `findNearest` over `concepts` with the `sensitive` + `status` prefilter, then core's
  decision table.
- `src/model.ts`: `TransformersEmbedder` (lazy, local files only) and the deterministic `StubEmbedder`.
- `src/callable.ts`, `src/index.ts`: auth, onboarding, kill switch, rate limits, warm-up, deployment options.
- `src/lib/`: the log-scrubbing HttpsError wrapper (issue paths and stack frames come from `@grouper/core/node`,
  shared with `functions/`), uid-free metrics, limits, LRU, vector helpers.

## Not implemented yet

- `embedderBatch` validates its payload and throws `NotImplementedError` (rescan, re-embed, maintenance and
  seed runs, §5.2 (8)).
- "Keep this private" for a user who is in an active pod (the `podInterests` recompute, §10.2) throws
  `NotImplementedError`; without active pods the conversion works.
- `calibration/run.ts` (the nightly gate, §13).
- The concept shortlist above 20k concepts (§5.2 (6), stage 2). `FirestoreConceptIndex` is stage 1.
