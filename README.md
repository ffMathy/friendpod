# Grouper

Grouper ("Pods") is friendship dating for groups in Denmark. People describe themselves with free-form interests in
their own words ("madlavning", "on paternity leave", "Fortnite"); every Thursday a weekly **drop** forms local pods of
4–6 strangers who share one of them, embedded with a self-hosted EmbeddingGemma model so different wordings meet.
Once at least 4 accept, first names and photos are revealed and the pod plans one in-person meetup by voting (no
chat). Sensitive interests (GDPR Art. 9) are allowed only with explicit consent and are only ever revealed inside a
pod formed around them. Everything runs on Firebase in `europe-west1`. The product and technical design is
[docs/DESIGN.md](docs/DESIGN.md); the GDPR design is [docs/PRIVACY.md](docs/PRIVACY.md). This repository is the M0
scaffold (DESIGN.md §15): structure, configuration, schemas, security-critical logic and tests, with later feature
logic as typed stubs ([What is stubbed](#what-is-stubbed)).

## Repository map

| Path | What | Kind |
|---|---|---|
| `packages/core/` | Shared domain logic consumed as TypeScript source: zod schemas, interest normalization and lexicon, geo, time, ids, consent texts, the pure matcher, app error codes. `@grouper/core/node` adds server-only helpers (HMAC, log-safe parsing) | workspace |
| `apps/mobile/` | Expo SDK 58 app with React Native Firebase 27 and expo-router (§11); development builds only | workspace |
| `functions/` | Functions codebase `default`: callables, scheduled, task and event functions (§10.1, §10.3) | standalone npm project |
| `services/embedder/` | Functions codebase `embedder`: `addInterests` and `embedderBatch` with EmbeddingGemma on CPU (§5, §10.2) | standalone npm project |
| `tests/rules/` | Firestore and Storage security-rules tests and the index validator (§9, §13) | standalone npm project |
| `tools/sim/` | Synthetic-city simulation harness, thin-market runs and matcher benchmarks (§6.9) | workspace |
| `tools/admin/` | Admin CLI skeleton (§9 Admin access, §13 Backups) | workspace |
| `scripts/` | Root CI helpers (`check-functions-discovery.ts`) | root |
| `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Firebase configuration, rules, indexes and TTL policies (§7–§9) | root |
| `hosting/public/` | Static privacy and account-deletion pages | root |
| `.github/` | CI (`ci.yml`), calibration and deploy workflows, shared setup action (§13) | root |
| `docs/`, `research/` | Design, privacy design and research reports | root |

The root is an npm workspace for `apps/*`, `packages/*` and `tools/*`. `functions/`, `services/embedder/` and
`tests/rules/` each have their own `package-lock.json` (DESIGN.md §14; `tests/rules` deliberately so, unlike the §14
sketch). The two functions projects import `@grouper/core` through a tsconfig `paths` alias and esbuild bundles it into
`dist/index.js`; core's own dependencies (zod) resolve from the root `node_modules`, so **install the root first**.

## Prerequisites

- Node.js **24.12 or newer** (`.nvmrc` says 24; `.npmrc` sets `engine-strict`, so older versions fail to install)
- Java **21** or newer for the Firestore and Storage emulators
- firebase-tools **15.34.2** (`npm install --global firebase-tools@15.34.2`; `npm run validate:indexes` checks it)
- For running the app: Xcode or the Android SDK for a local development build, or an EAS account for a cloud one

## Getting started

### Install (the CI sequence)

```sh
npm ci                                  # root workspace, also provides @grouper/core's dependencies
npm ci --prefix functions
npm ci --prefix services/embedder
npm ci --prefix tests/rules
```

### Run the emulators

Emulators always run as the demo project `demo-grouper`, which needs no credentials and cannot reach real services.
Ports come from `firebase.json`: auth 9099, firestore 8080, functions 5001, storage 9199, tasks 9499, hub 4400,
logging 4500, UI 4000.

```sh
npm run build:functions && npm run build:embedder   # the Functions emulator loads each codebase's dist/index.js
npm run emulators                                    # firebase emulators:start --project demo-grouper
```

- **Secrets.** The callables need `UID_HMAC_KEY` (both codebases) and `POD_ID_KEY` (`functions`), each base64 of at
  least 32 random bytes. For the emulator, put test values in `functions/.secret.local` and
  `services/embedder/.secret.local` (gitignored), for example the output of
  `node -e "console.log('UID_HMAC_KEY=' + require('crypto').randomBytes(32).toString('base64'))"`.
- **The embedder loads without model weights.** The model is read on the first request that needs it, so discovery
  works without `./model`; to actually embed in the emulator, fetch the model first (below).
- **Skipped locally:** no Pub/Sub emulator is configured, so `dropOrchestrator`, `hourlySweeper`, `dailyMaintenance`
  and `onBudgetAlert` are not loaded by `emulators:start`.
- **Behind an HTTPS proxy:** firebase-tools 15.34.2 sends its emulator-to-emulator calls through `HTTPS_PROXY` and
  ignores `NO_PROXY`. Storage-rules checks of `photoGrants` and task-queue registration then fail locally. CI is not
  affected.

### Run the app in a development build

React Native Firebase does not run in Expo Go. Build a development client once, then point it at the emulators:

```sh
cd apps/mobile
npx expo run:android            # or: npx expo run:ios, or eas build --profile development
EXPO_PUBLIC_USE_EMULATORS=1 npm start
```

`EXPO_PUBLIC_USE_EMULATORS=1` connects Auth, Firestore, Functions and Storage to the ports above and is refused
outside `APP_ENV=development`. On a physical device set `EXPO_PUBLIC_EMULATOR_HOST` to your machine's address. The
development build uses the committed `demo-grouper` placeholder Firebase files and the App Check debug provider; the
Auth emulator prints email sign-in links instead of sending them. See [apps/mobile/README.md](apps/mobile/README.md).

### Run the tests

These are the commands `.github/workflows/ci.yml` runs, in the same order:

```sh
npm run typecheck                 # core, sim, admin, mobile (expo customize + tsc), root scripts
npm run lint
npm test                          # vitest (core, sim, admin) and jest-expo (mobile)
(cd apps/mobile && npx expo config --type public)
npm --prefix functions run typecheck && npm --prefix functions run build
npm --prefix services/embedder run typecheck && npm --prefix services/embedder run build
npm --prefix tests/rules run typecheck

npm run validate:indexes          # firestore.indexes.json through firebase-tools' own parser
npm run test:rules                # emulators:exec --only firestore,storage
npm run test:functions            # emulators:exec --only auth,firestore (includes the log-scrubbing test)
npm run test:embedder             # emulators:exec --only firestore, stub model
npm run check:discovery           # emulators:exec --only functions: both codebases load from dist

npm run sim:smoke
npm run sim:thin-market -- --json /tmp/thin-market.json
```

Emulator-backed suites read `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` and
`FIREBASE_STORAGE_EMULATOR_HOST` from `firebase emulators:exec`, so no port is hard-coded. Run on their own, they are
skipped locally and fail when `CI` is set.

### The simulator

```sh
npm run sim -- --n 200 --weeks 12 --profile alpha --seed 1     # one synthetic city, metrics as JSON
npm run sim:smoke                                              # n = 2000, 4 weeks, launch profile, sanity asserts
npm run sim:thin-market -- --json out.json                     # n = 100/200/300 × launch/alpha, markdown table
npm run bench:match -- --n 20000 --concepts 30000 --history 30 # matcher runtime and peak RSS (§6.4)
```

### Fetch the model

```sh
npm --prefix services/embedder run fetch-model                        # Hugging Face at the pinned revision
GCS_MODEL_BUCKET=grouper-<env>-models npm --prefix services/embedder run fetch-model   # our EU mirror (CI, deploy)
npm --prefix services/embedder run build                              # now also writes dist/prototypes.bin
```

Files land in `services/embedder/model/` and are verified against the hashes in `services/embedder/src/config.ts`.
Model weights are gitignored and never committed. With the model present, the embedder's real-model smoke test runs
too.

## Firebase configuration

- **Projects.** `.firebaserc` has the aliases `staging` (`grouper-staging`) and `prod` (`grouper-prod`), and
  `default` points at staging, so a command without `--project` targets staging, not production. Deploys always
  name the alias (`firebase deploy -P staging …`, as `.github/workflows/deploy.yml` does).
- **Emulators** always run with `--project demo-grouper`; with `singleProjectMode` they warn about requests for any
  other project id.
- **Region.** `firebase.json` pins the `(default)` database to `europe-west1`, Standard edition: if the database
  does not exist yet, `firebase deploy --only firestore` creates it, in `nam5` (US) unless a location is set.
  The CLI creates it without PITR, which M0 turns on separately.
- **Indexes and TTL.** `firestore.indexes.json` holds the composite and vector indexes, the field exemptions and
  every TTL policy, and it is the source of truth: `firebase deploy --force` deletes indexes and overrides that are
  missing from it. `tests/rules` checks the invariants and validates the file with firebase-tools' own parser.
- **Hosting** serves the account-deletion and privacy pages. Firebase itself serves the email-link handler
  (`/__/auth/links`) on the same domain, and the App Links / Universal Links association comes from the Team ID
  and SHA-256 fingerprints registered in the console (DESIGN.md §11; verify in M0). The custom security headers
  apply to our pages only, not to `/__/` paths.

## What is stubbed

Stubs keep their final name, trigger, options and input validation, then fail loudly: callables and tasks with
`unimplemented` and `details: {code: 'NOT_IMPLEMENTED', design: '§…'}`, other code with
`not implemented (see DESIGN.md §…)`. Nothing pretends to succeed (a silent `purgeUser` would look like a completed
erasure).

**Implemented end to end:** `completeOnboarding`, `updateProfile`, `setParticipation`, the `matchComponent` task
body, `onBudgetAlert`, `addInterests` (pipeline steps 1–7, consent gate, self-flag, detector), the security rules,
the matcher and the app's onboarding, consent and interest flows.

**Sensitive interests are switched off** until withdrawal exists: `ART9_HOLDINGS_ENABLED` in
`services/embedder/src/config.ts` is `false`, so `addInterests` answers every sensitive holding with
`limit`/`SENSITIVE_UNAVAILABLE` before asking for consent (withdrawing must be as easy as consenting, Art. 7(3)).
Switch it on together with `withdrawSensitive` and `removeInterest` (M1); a config test fails if it is on while they
are stubs. The emulator tests cover the sensitive path with the gate open.

| Stub | Where | DESIGN.md |
|---|---|---|
| `removeInterest`, `updateInterest`, `withdrawSensitive`, `registerPushToken` | `functions/src/callables/index.ts` | §10.1 |
| `confirmSuggestion` | same | §5.2 (6) |
| `respondToPod` | same | §4.6 |
| `setPhotoSharing` | same | §6.1 (S6) |
| `leavePod` | same | §3.8 |
| `proposeOption`, `voteOption` | same | §3.5 |
| `confirmAttendance`, `submitFeedback` | same | §3.6 |
| `blockUser`, `unblockUser`, `report` | same | §3.7 |
| `deletePhoto` | same | §9 |
| `exportData` | same | §3.9 |
| `deleteAccount` | same | §3.10 |
| `dropOrchestrator`, `dailyMaintenance` | `functions/src/scheduled/index.ts` | §10.3 |
| `hourlySweeper` | same | §4.6 |
| `releaseDrop`, `backfillPod`, `purgeUser` | `functions/src/tasks/index.ts` | §10.3 |
| `buildExport`, `deleteExport` | same | §3.9 |
| `onPhotoUploaded` processing (the pending-upload filter is implemented) | `functions/src/triggers/index.ts` | §9 |
| `embedderBatch` (rescan, re-embed, maintenance, seed) | `services/embedder/src/batch.ts` | §5.2 (8), §10.2 |
| "Keep this private" while the user is in an active pod (`podInterests` recompute) | `services/embedder/src/persist.ts` | §10.2 |
| Concept shortlist above 20k concepts (stage 1 index only) | `services/embedder/src/assign.ts` | §5.2 (6) |
| Interest-add limits (30 adds per hour, 100 per day per user; only the 30-calls-per-hour limit exists) | `services/embedder/src/callable.ts` | §4.3 |
| Nightly calibration gate | `services/embedder/calibration/run.ts`, `.github/workflows/calibration.yml` | §13 |
| "Treat as ordinary" after a review (no callable in §10 yet) | `apps/mobile/src/features/interests/treatAsOrdinary.ts` | §5.2 (5) |
| Every admin command (review queue, sanctions, launch areas, restore runbook) | `tools/admin/src/commands.ts` | §9, §13 |
| Staging and production deploys (WIF, secrets, model mirror) | `.github/workflows/deploy.yml` | §13 |
