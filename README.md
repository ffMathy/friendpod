# Grouper

Grouper ("Pods") is friendship dating for groups in Denmark. People describe themselves with free-form interests in
their own words ("madlavning", "on paternity leave", "Fortnite"); every Thursday a weekly **drop** forms local pods of
4–6 strangers who share one of them, embedded on the phone with a pinned EmbeddingGemma model so different wordings
meet.
Once at least 4 accept, first names and photos are revealed and the pod plans one in-person meetup by voting; a
short meetup chat opens 24 hours before it and closes 24 hours after. Sensitive interests (GDPR Art. 9) are allowed
only with a one-time explicit consent and are only ever revealed inside a pod formed around them. Everything runs on Firebase in
`europe-west1`. The product and technical design is [docs/DESIGN.md](docs/DESIGN.md); the GDPR design is
[docs/PRIVACY.md](docs/PRIVACY.md). This repository is the M0 scaffold (DESIGN.md §15): structure, configuration,
schemas, security-critical logic and tests, with later feature logic as typed stubs
([What is stubbed](#what-is-stubbed)).

## Repository map

| Path | What | Kind |
|---|---|---|
| `packages/core/` | Shared domain logic consumed as TypeScript source: zod schemas, interest normalization and lexicon, geo, time, ids, consent texts, the pure matcher, app error codes. `@grouper/core/node` adds server-only helpers (HMAC, log-safe parsing) | workspace |
| `apps/mobile/` | Expo SDK 58 app with React Native Firebase 27 and expo-router (§11); development builds only | workspace |
| `functions/` | The one Functions codebase, `default`: callables (`addInterests` included), scheduled, task and event functions (§10.1, §10.3) | standalone npm project |
| `tests/rules/` | Firestore and Storage security-rules tests and the index validator (§9, §13) | standalone npm project |
| `tools/sim/` | Synthetic-city simulation harness, thin-market runs and matcher benchmarks (§6.9) | workspace |
| `tools/admin/` | Admin CLI skeleton (§9 Admin access, §13 Backups); `funnel show` prints the day-1 funnel with cells under 10 suppressed (§6.8) | workspace |
| `scripts/` | Root CI helpers (`check-functions-discovery.ts`) | root |
| `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Firebase configuration, rules, indexes and TTL policies (§7–§9) | root |
| `hosting/public/` | Static privacy and account-deletion pages, and the shared city page `/c/{areaId}` (`c/index.html`, rewritten for `/c/**`; city name from the path, store links, no tracking) | root |
| `.github/` | CI (`ci.yml`), calibration and deploy workflows, shared setup action (§13) | root |
| `docs/`, `research/` | Founder overview, design, privacy design, cost overview (`COSTS.md`) and research reports | root |

The root is an npm workspace for `apps/*`, `packages/*` and `tools/*`. `functions/` and `tests/rules/` each have their
own `package-lock.json` (DESIGN.md §14; `tests/rules` deliberately so, unlike the §14 sketch). `functions/` imports
`@grouper/core` through a tsconfig `paths` alias and esbuild bundles it into `dist/index.js`; core's own dependencies
(zod) resolve from the root `node_modules`, so **install the root first**.

**Embedding happens on the phone (D1).** The app runs the pinned EmbeddingGemma 2 q4 (onnxruntime-react-native, CPU)
for every tag and sends `{text, vector, detector}` with the model key; `addInterests` trusts the vector (an accepted
manipulation risk) and repeats normalisation, moderation, the lexicon and, with `prototypes.bin`, the detector margin.
The model id, pinned files with their sha256, prompt and thresholds live in `packages/core/src/interests/model.ts`,
shared by app and server. The former `services/embedder` codebase is retired.

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
npm ci --prefix tests/rules
```

### Run the emulators

Emulators always run as the demo project `demo-grouper`, which needs no credentials and cannot reach real services.
Ports come from `firebase.json`: auth 9099, firestore 8080, functions 5001, storage 9199, tasks 9499, hub 4400,
logging 4500, UI 4000.

```sh
npm run build:functions   # the Functions emulator loads functions/dist/index.js
npm run emulators         # firebase emulators:start --project demo-grouper
```

- **Secrets.** The callables need `UID_HMAC_KEY` and `POD_ID_KEY`, each base64 of at least 32 random bytes. For the
  emulator, put test values in `functions/.secret.local` (gitignored), for example the output of
  `node -e "console.log('UID_HMAC_KEY=' + require('crypto').randomBytes(32).toString('base64'))"`.
- **Detector prototypes.** `addInterests` reads `prototypes.bin` from `gs://<projectId>-models/models/eg2-q4-daa72c5/`.
  Without it (the emulator, or before the file is built) the server decides with the client's margin alone and logs
  `addInterests.prototypesUnavailable`; the lexicon still runs on the server.
- **Skipped locally:** no Pub/Sub emulator is configured, so `dropOrchestrator`, `hourlySweeper`, `dailyMaintenance`
  and `onBudgetAlert` are not loaded by `emulators:start`.
- **Behind an HTTPS proxy:** firebase-tools 15.34.2 sends its emulator-to-emulator calls through `HTTPS_PROXY` and
  ignores `NO_PROXY`. Storage-rules checks of `photoGrants` and task-queue registration then fail locally. CI is not
  affected.

### Run the app in a development build

React Native Firebase does not run in Expo Go. Fetch the on-device model, build a development client once, then point
it at the emulators:

```sh
cd apps/mobile
npm run fetch-model             # pinned model files (~210 MB), sha256-checked; again after every model change
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
npm --prefix tests/rules run typecheck

npm run validate:indexes          # firestore.indexes.json through firebase-tools' own parser
npm run test:rules                # emulators:exec --only firestore,storage
npm run test:functions            # emulators:exec --only auth,firestore (log scrubbing, addInterests with stand-in vectors)
npm run check:discovery           # emulators:exec --only functions: every callable loads from dist

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

### The model

Nothing in this repository runs the model on a server any more (D1), and the app never downloads it: the device
files listed by `deviceModelFiles()` in `packages/core` ship inside the app (DESIGN.md §5.1, F32). The fetch-model
script downloads them at the pinned revision and checks each sha256 before a native build; the build then bundles them
in the iOS app and as uncompressed Android assets, which the app copies once into its storage on first launch. Run it
before every native build (local or EAS); see [apps/mobile/README.md](apps/mobile/README.md). Building
`prototypes.bin` and the nightly calibration gate need an offline tool with the pinned model that does not exist yet
(`.github/workflows/calibration.yml`). Model weights are never committed.

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

**Implemented end to end:** `completeOnboarding`, `updateProfile` (with "about me", D4, copied to the roster of the
user's confirmed pods), `setParticipation`, `sendMessage` (the text-only meetup chat: membership, window, moderation
with the contact-info warning, rate limit, throttled generic pushes), `addInterests` (pipeline steps 1–7 on the
client's vector, the blanket-consent gate, "Keep this private", "This isn't sensitive for me", the known-ordinary list,
the server-side lexicon and margin), `setArt9Consent`, `withdrawArt9Consent` for a user without sensitive holdings,
`onBudgetAlert`, the security rules, the matcher (with first-timers first, F35) and the app's main flows. Since the
2026-11-05 launch decisions also: the five launch cities, the exact per-city `waitlistCount` (onboarding, area change,
and `eraseMatchProfileAndAreaCount` for erasure), the in-app waitlist screen with share and copy, the `/c/{areaId}`
Hosting page, the `openArea` task and its "<city> is open" push, and the day-1 funnel (`funnel/{areaId}_{weekId}`,
once per user through `matchProfiles.milestones`) for every stage except the abandoned-sign-up `signup` (counted by
the stubbed `dailyMaintenance`).

**The pod lifecycle** (DESIGN.md §4.6) is built: `dropOrchestrator` (frozen per-component input snapshots, beta areas
as dry runs, `matchComponent` tasks and the 18:00 `releaseDrop`), the `matchComponent` task, `releaseDrop` (release
revalidation, `create()` of podState and cards, `lastUpdateTime` preconditions on `matchProfiles`, staggered generic
pushes, snapshot cleanup), `respondToPod` (confirmation at the area profile's `confirmationMin`, roster, photo grants
with the S6 opt-in, late joins, auto-pause), `backfillPod` (only before the plan first locks, D6), `proposeOption`,
`voteOption`, `confirmAttendance` (late cancels), `submitFeedback` (majority no-shows at feedback close, HMAC-keyed
meet-again pair signals, D9), `leavePod`, `setPhotoSharing` and the `hourlySweeper` pod timers (accept and backfill
deadlines, the planning deadline with its one extension round, "Still coming?" at T−3 d and T−24 h with "Your pod chat
is open", the T−6 h nudge, the T−3 h check and reschedule round, T+2 h → `happened`, the feedback push at 10:00 the
next morning and its day-3 reminder, feedback close with the Keep loop). Every transition is one podState transaction
with a `version` bump, and every callable first processes the timers that are already due, so a late sweep changes no
outcome. Code: `functions/src/pods/` and `functions/src/callables/pods.ts`.

**Sensitive interests are switched off** until their withdrawal exists: `ART9_HOLDINGS_ENABLED` in
`functions/src/interests/config.ts` is `false`, so `addInterests` answers every sensitive holding with
`limit`/`SENSITIVE_UNAVAILABLE`, with or without the blanket consent, and keeps nothing about it (withdrawing must be
as easy as consenting, Art. 7(3)). Users can give and withdraw the blanket consent itself. Switch the gate on together
with `removeInterest` and the holding steps of `withdrawArt9Consent` (`WITHDRAWAL_REMOVES_HOLDINGS`, M1); a unit test
fails if it is on before then. The emulator tests cover the sensitive path with the gate open.

| Stub | Where | DESIGN.md |
|---|---|---|
| `removeInterest`, `updateInterest`, `registerPushToken` | `functions/src/callables/index.ts` | §10.1 |
| `withdrawArt9Consent` for a user who holds sensitive interests (PRIVACY.md §3.5 steps 1–8) | `functions/src/callables/art9Consent.ts` | §10.1 |
| `confirmSuggestion` | same | §5.2 (6) |
| `blockUser`, `unblockUser`, `report` (including message reports, whose input is already validated) | same | §3.7 |
| `deletePhoto` | same | §9 |
| `exportData` | same | §3.9 |
| `deleteAccount` | same | §3.10 |
| `dailyMaintenance` (deletion of archived and dissolved pods, inactive accounts, Auth reconciliation) | `functions/src/scheduled/index.ts` | §10.3 |
| `hourlySweeper`: the Monday 10:00 "In this week?" nudge and lifting expired sanctions and sensitive holds (the pod timers are built) | same | §4.1, §10.3 |
| Automated no-show pause and suspension (2 / 3 no-show weight in 8 weeks); the counters and `noShowEvents` are kept | `functions/src/pods/transitions.ts` | §4.4 |
| `areas/*` chips at the drop (`dropOrchestrator` freezes inputs but writes no chips) | `functions/src/pods/orchestrator.ts` | §10.3 |
| `purgeUser` | `functions/src/tasks/index.ts` | §10.3 |
| `buildExport`, `deleteExport` | same | §3.9 |
| `onPhotoUploaded` processing (the pending-upload filter is implemented) | `functions/src/triggers/index.ts` | §9 |
| `interestsBatch` (rescan of stored tags, maintenance) | `functions/src/tasks/index.ts` | §5.2 (8) |
| Moving a holding between partitions ("Keep this private", "This isn't sensitive for me") while the user is in an active pod (`podInterests` recompute) | `functions/src/interests/persist.ts` | §10.2 |
| Concept shortlist above 20k concepts (stage 1 index only) | `functions/src/interests/assign.ts` | §5.2 (6) |
| Interest-add limits (30 adds per hour, 100 per day per user; only the 30-calls-per-hour limit exists) | `functions/src/callables/addInterests.ts` | §4.3 |
| `prototypes.bin` build and the nightly calibration gate (offline model tooling, not built) | `.github/workflows/calibration.yml` | §13 |
| `prototypes.bin` pin in `EMBEDDING_MODEL.files` (until it exists the device embedder refuses to load, so interests cannot be added on a device) | `packages/core/src/interests/model.ts` | §5.1 |
| Device golden test reference vectors (the comparison logic exists) | `apps/mobile/src/features/interests/embedder/golden.ts` | §5.1 |
| Every admin command (launch areas, restore runbook; no review or sanction commands, F17) | `tools/admin/src/commands.ts` | §9, §13 |
| Staging and production deploys (WIF, secrets, model bucket) | `.github/workflows/deploy.yml` | §13 |
