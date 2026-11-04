# functions: codebase "default"

Callables (DESIGN.md §10.1) and scheduled, task and event functions (§10.3). It is the only Functions codebase: the
app embeds every tag on the device (D1), so `addInterests` lives here and no function ever loads the model. This is
a standalone npm project with its own `package-lock.json`, not a workspace. `@grouper/core` is resolved through the
tsconfig `paths` alias and bundled into `dist/index.js` by esbuild. Core's own dependencies (zod) resolve from the
root `node_modules`, so install the root first:

```sh
npm ci                        # repo root
npm --prefix functions ci
npm --prefix functions run typecheck
npm --prefix functions run build
# Unit tests run anywhere. Emulator suites run under emulators:exec (skipped otherwise, and failing when CI is set):
firebase emulators:exec --only auth,firestore --project demo-grouper 'npm --prefix functions test'
```

Cloud Build only installs the uploaded `functions/` folder, so it must never rebuild there: the empty
`gcp-build` script stops the buildpack from running `build`, and `predeploy` builds `dist/` before upload.

## Layout

- `src/lib/handler.ts` wraps every callable: Auth, App Check (and the `alreadyConsumed` replay check on
  `report`, `exportData` and `deleteAccount`), the `onb` claim, `auth_time` within 5 minutes, zod validation
  with the core schemas, output validation, and errors as `HttpsError` with `details.code`. Logs carry no request
  data: one uid-free entry per call, zod issue paths and codes only (record keys from the request are masked),
  and, for unexpected errors only, the error class, stack frames and `uidH`.
- `src/lib/background.ts` applies the same logging rules to task, scheduled and event functions.
- `src/lib/firestore.ts`: typed paths and validating converters for every §8 document.
- `src/lib/options.ts`: the §7 defaults (europe-west1, gcf_gen1, 256 MiB, `sa-api@`) and the hot-callable profile.
- `src/lib/push.ts`: FCM with generic payloads only (S4).
- `src/lib/rateLimits.ts`: fixed-window counters in `rateLimits/{uid}_{bucket}` (§9), charged inside the
  caller's transaction.
- `src/interests/`: the `addInterests` pipeline (§5.2). `pipeline.ts` (normalise, moderate, read `tags` by tagKey,
  trust the client vector for a new text, sensitivity per holding with core's `decideSensitivity`, the consent gate,
  `findNearest` in the holding's partition) and `persist.ts` (one transaction, never across partitions). `tags.ts`
  explains the three assignment slots of a tag; `prototypes.ts` reads `prototypes.bin` from the models bucket;
  `config.ts` holds the limits and `ART9_HOLDINGS_ENABLED`. The model and thresholds are core's.

## Implemented and stubbed

Implemented: `completeOnboarding`, `updateProfile`, `setParticipation`, `sendMessage`, `addInterests`,
`setArt9Consent`, `withdrawArt9Consent` (for a user without sensitive holdings), the `matchComponent` task body,
`onBudgetAlert` and the upload-path filter in `onPhotoUploaded`. Every other function has its final name, trigger and
options, validates its input, and fails with `unimplemented` / `details: {code: 'NOT_IMPLEMENTED', design: '§…'}`.

## Runtime configuration

- Secrets (`firebase functions:secrets:set`): `UID_HMAC_KEY` and `POD_ID_KEY`, each base64 of ≥ 32 random bytes.
  For the Functions emulator, put test values in `functions/.secret.local` (not committed).
- The drops bucket is `gs://<projectId>-drops` (`grouper-staging-drops`, `grouper-prod-drops`).
  `drops/{weekId}/components/{componentId}.inputPath` is an object path inside that bucket.
- `addInterests` reads `models/eg2-q4-daa72c5/prototypes.bin` from `gs://<projectId>-models` (`sa-api@` needs object
  read there). Missing or unreadable, the server uses the client's detector margin alone and retries after 10 minutes.
- `config/app.features.interests: false` switches `addInterests` off (FEATURE_DISABLED); `onBudgetAlert` sets it.
- `onBudgetAlert` listens on the Pub/Sub topic `budget-alerts` and trips at 100 % of actual spend.
- After `completeOnboarding`, the app must refresh its ID token (`getIdToken(true)`) to receive the `onb` claim.
