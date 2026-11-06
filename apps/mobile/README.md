# @grouper/mobile

The Grouper app: Expo SDK 58 (expo 58.0.23, React Native 0.88.1, New Architecture) with React Native
Firebase 27.1.0, expo-router and TanStack Query. Design: [DESIGN.md §11](../../docs/DESIGN.md), privacy:
[PRIVACY.md §3, §5, §6](../../docs/PRIVACY.md).

RNFirebase does not run in Expo Go, so the app needs a **development build** (`expo-dev-client`).

## Commands

Run `npm ci` at the repo root first (this is a root workspace; `@grouper/core` is consumed as source).

| Command (from `apps/mobile`) | What it does |
|---|---|
| `npm run typecheck` | Generates typed routes (`expo customize tsconfig.json`), then `tsc` for the app and for the tests |
| `npm test` | jest-expo + React Native Testing Library |
| `npm run config` | Prints the resolved public config (`APP_ENV=staging` etc. to check other environments) |
| `npm run build` | `expo export` of the Android and iOS JS bundles into `dist/` (no device needed) |
| `npm run fetch-model` | Fetches the pinned on-device model into `assets/model/` and verifies it ([below](#on-device-embedding-d1)) |
| `npm start` | Metro for a development build |
| `npm run android` / `npm run ios` | Local native build (`expo run:*`; needs Android SDK / Xcode); runs `fetch-model` first |

Lint runs from the root (`npm run lint`).

## Environments

`app.config.ts` reads `APP_ENV` (`development` default, `staging`, `production`) and sets the app name,
bundle id / package (`dk.grouper.app[.dev|.staging]`, placeholders until the company domain is fixed),
the email-link domain (`<projectId>.firebaseapp.com`, §11) in `ios.associatedDomains` and the Android
App Link intent filter, the APNs and App Attest entitlement environments, and blocks unused Android
permissions.

| Variable | Where | Purpose |
|---|---|---|
| `APP_ENV` | `eas.json` per profile | Environment |
| `GOOGLE_SERVICES_PLIST`, `GOOGLE_SERVICES_JSON` | EAS **file** env vars (`preview` and `production` environments) | Firebase app config; required outside development ([config/firebase/README.md](config/firebase/README.md)) |
| `GOOGLE_WEB_CLIENT_ID` | EAS env var | OAuth web client id, needed for Google ID tokens |
| `EAS_PROJECT_ID` | EAS env var | Set once `eas init` has linked the project |
| `EXPO_PUBLIC_USE_EMULATORS=1` | `eas.json` development profile, or your shell | Connects Auth, Firestore, Functions and Storage to the Emulator Suite; refused outside development |
| `EXPO_PUBLIC_EMULATOR_HOST` | your shell | Emulator host for a physical device (default `localhost`; Android emulators are remapped to 10.0.2.2) |
| `EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN` | your shell | Optional pre-registered App Check debug token (development only) |
| `MODEL_MIRROR_URL` | EAS env var or your shell (optional) | Build-time source for `npm run fetch-model` instead of Hugging Face, laid out like the model repo (`https://storage.googleapis.com/grouper-<env>-models/models/eg2-q4-daa72c5/`); required once a `mirror`-only file such as `prototypes.bin` is pinned |
| `MODEL_MIRROR_TOKEN` | EAS **secret** env var, set right before each build, or your shell | OAuth access token for the private models bucket (DESIGN.md §8, §9), sent by `fetch-model` as `Authorization: Bearer` to the `MODEL_MIRROR_URL` origin only (no redirects followed). Mint it as the build service account, which has object read on that bucket only: `gcloud auth print-access-token --impersonate-service-account=sa-build@grouper-<env>.iam.gserviceaccount.com`. It expires after 1 hour, so set it with `eas env:create --name MODEL_MIRROR_TOKEN --visibility secret --force --environment <preview\|production> --value "$(…)"` immediately before `eas build` (or pass it in the shell to `eas build --local`). A 401/403 from the mirror fails the build and says whether the token was missing or refused |
| `HF_TOKEN` | EAS secret or your shell (optional) | Sent to huggingface.co by `fetch-model` (the repo is public; only for rate limits) |
| `EXPO_PUBLIC_EMBEDDER=stub` | your shell | Deterministic fake vectors instead of the bundled model; lets a development prebuild go without `assets/model/` and makes `fetch-model` a no-op; refused outside development, always on in jest |
| `EXPO_PUBLIC_PLACES_KEY` | EAS env var | Google Places (New) API key, restricted to the app ids and the Places API |
| `EXPO_PUBLIC_ANDROID_CERT_SHA1` | EAS env var | SHA-1 of the Android signing certificate, sent as `X-Android-Cert` so the app-restricted key works over REST |
| `EXPO_PUBLIC_PLACES=stub` | your shell | A fixed list of Aarhus places instead of Google; refused outside development, always on in jest |

App Check uses the debug provider in development and Play Integrity / App Attest (DeviceCheck fallback)
otherwise. `firebase.json` in this folder is React Native Firebase's native config (not the Firebase
CLI's, which is at the repo root; run the Firebase CLI from the root): no automatic data collection and
no FCM auto-init, so no push token exists before the user grants notifications.

### Emulators

```
# repo root
firebase emulators:start --project demo-grouper
# apps/mobile
EXPO_PUBLIC_USE_EMULATORS=1 npm start
```

The Auth emulator prints email links instead of sending them; in emulator builds `auth/complete`
accepts a pasted link.

## Layout

```
app/                 expo-router routes, exactly the §11 screens table
  (auth)/            welcome (§3.1 step 1), sign-in, email link
  auth/complete      email-link completion (+native-intent.tsx rewrites /__/auth/links here)
  (onboarding)/      §3.1 steps 3–11
  (tabs)/            this week, interests, and two tab stacks that keep the tab bar:
    (pods)/          pods (/pods), pod/[podId] (the pod page, /pod/<id>)
    (me)/            me (/me), settings/privacy (/settings/privacy)
  pod/[podId]/       plan, chat (meetup chat, §3.6), feedback, member/[uid]: over the tabs
  sheets/            why-this-pod (fitted form sheet), report (modal)
  settings/, info/   settings, privacy's sub-pages, blocked, notifications, notices, preferences; transparency pages
src/
  firebase/          RNFirebase init, App Check, emulators, typed callables (core zod schemas)
  data/              TanStack Query client, callable mutations, onSnapshot bridges, typed doc hooks
  features/          auth, session, onboarding, interests (+ embedder/), consent, profile, pods, places, chat, photos, notifications, notices, account
  components/        small UI kit
  i18n/              da.json, en.json (+ native/ for iOS permission prompts)
test/                jest tests
```

Consent copy (the blanket Art. 9 consent, gender, standing notice, withdrawal) is rendered verbatim from
`@grouper/core` legal texts; the client sends `{textVersion, textSha256, appVersion, checked: true}` (`appVersion` from `app.config.ts`, recorded on the consent event).
The blanket Art. 9 consent (D3) is its own onboarding step after `completeOnboarding` (`(onboarding)/sensitive-consent`)
and can be given or withdrawn in Settings → Privacy. Without it, a tag that is sensitive for the holding is refused on
the phone and never sent.

## On-device embedding (D1)

Every interest is embedded on the phone with the pinned EmbeddingGemma 2 q4 graph (`EMBEDDING_MODEL` in core) and
scored by the core detector against `prototypes.bin`; `addInterests` receives `{text, vector, detector}`.

- Runtime: `onnxruntime-react-native` 1.24.3 (CPU execution provider only), its native core pinned to ORT 1.30.0 on
  both platforms by `plugins/withOrtPinned.js`; `react-native.config.js` registers `OnnxruntimePackage` on Android.
  The package's own config plugin is not used (it assumes an unhoisted `node_modules`).
- Tokenizer: `@huggingface/tokenizers` 0.2.0 in JS.
- Files: **bundled inside the app** (founder decision 2026-11-04): `onnx/model_q4.onnx`, `onnx/model_q4.onnx_data`,
  `tokenizer.json` and `tokenizer_config.json` (the `device` files pinned with size and SHA-256 in
  `packages/core/src/interests/data/eg2-q4.model.json`, read by `EMBEDDING_MODEL`), about 207 MB. There is no runtime
  download, no URL and no Wi-Fi/cellular prompt.
  - **Build time:** `npm run fetch-model` (`scripts/fetch-model.mjs`, Node built-ins only) downloads them from Hugging
    Face at the pinned revision, or from `MODEL_MIRROR_URL` (the private models bucket, with `MODEL_MIRROR_TOKEN`), into `assets/model/eg2-q4-daa72c5/` (gitignored),
    verifies every SHA-256, skips files already verified and removes anything else in `assets/model/`.
  - **Prebuild:** `plugins/withBundledModel.js` verifies the folder again and copies exactly the pinned files to
    `ios/<Project>/models/` (a folder reference in Copy Bundle Resources) and `android/app/src/main/assets/models/`
    (with `.onnx`/`.onnx_data` in `androidResources.noCompress`). A missing or mismatching file fails the prebuild with
    what to run, unless `EXPO_PUBLIC_EMBEDDER=stub` with `APP_ENV=development`. `expo config` never needs the files.
  - **EAS:** `package.json` runs `fetch-model` in the `eas-build-pre-install` hook (before `npm install`; the uploaded
    archive never contains the gitignored model), so every store build fetches, verifies and bundles it. Locally,
    `npm run ios` / `npm run android` run it first (`preios`/`preandroid`); before a bare `npx expo prebuild`, run
    `npm run fetch-model` yourself. CI never runs it: it only evaluates `expo config` and runs jest with the stub.
  - **Runtime** (`src/features/interests/embedder/modelFiles.ts`): on iOS the session opens
    `<App>.app/models/eg2-q4-daa72c5/onnx/model_q4.onnx` in place (code-signed, size check only). Android assets are
    not file paths, so the first load copies the files to `<files>/models/eg2-q4-daa72c5/` (internal storage; the app
    has `allowBackup: false`). It first deletes older model folders and any partial `.part` copy (they free the
    space this copy needs, so after a model update the old model is gone before the new one is verified), then checks
    free space (the copied bytes plus 50 MB), verifies each copy's SHA-256 natively and writes a marker last; later
    launches trust the marker and file sizes. On Android the model therefore takes about twice its size on the
    device: ~207 MB in the APK plus ~207 MB copied (~415 MB), and the first launch needs ~260 MB free. iOS deletes any
    `Documents/models/` an older download-on-first-use build left behind (Android re-verifies and reuses it). The UI
    shows only "preparing" meanwhile.
- The model is loaded while an interests screen is focused and released when it loses focus.
- If the device cannot run it, adding interests is blocked with a message and a retry; there is no server fallback.
- `src/features/interests/embedder/stub.ts` is the deterministic stand-in for jest and `EXPO_PUBLIC_EMBEDDER=stub`.

## Wiring to the backend

Every screen reads Firestore through the typed live hooks in `src/data/docs.ts` (core schemas) and writes only
through the typed callables (`src/firebase/callables.ts`, `useCallable`); nothing in the app is mocked outside jest.

| Journey | Where | Callables / reads |
|---|---|---|
| Proposal, accept/decline, "Why this pod" | `(tabs)/index`, `ProposalCard`, `sheets/why-this-pod` | `respondToPod`; `users/{uid}/pods` |
| Confirmed pod: next step, plan, chat, members (with "about me") | `(tabs)/(pods)/pod/[podId]`, `LockedPlan` | `pods/{podId}`, `options`; `setPhotoSharing` |
| Propose and vote, extension round, report an option | `pod/[podId]/plan`, `PlacePicker` | `proposeOption`, `voteOption` |
| Attendance ("Still coming?", "Can't make it", "hasn't confirmed") | `AttendanceCard` | `confirmAttendance` |
| Add to calendar, open in Maps | `LockedPlan` | system sheet (`expo-calendar/legacy`), `place.mapUrl` |
| Feedback | `pod/[podId]/feedback` | `submitFeedback` |
| Leave pod | pod screen | `leavePod` |
| Block (remove them / leave instead / re-plan when scheduled), unblock, report a member, option or message | `pod/[podId]/member/[uid]`, `sheets/report`, `settings/blocked` | `blockUser`, `unblockUser`, `report`; `users/{uid}/blocks` |
| Interests (remove, star, did-you-mean, keep private, not sensitive for me, rescan holds) | `InterestManager` | `addInterests`, `removeInterest`, `updateInterest`, `confirmSuggestion` |
| Privacy: Art. 9 and gender consent, pause / skip, photo, export, blocked, notices, delete | `(tabs)/(me)/settings/privacy`, `settings/photo`, `settings/delete-account` | `setArt9Consent`, `withdrawArt9Consent`, `updateProfile`, `setParticipation`, `deletePhoto`, `exportData`, `deleteAccount`; `users/{uid}/exports` |
| Photo upload, change and delete | `(onboarding)/photo`, Me → `PhotoCard` | Storage `uploads/{uid}/pending*.jpg` (`onPhotoUploaded`), `deletePhoto` |
| Messages from Grouper (statements of reasons, report receipts, export ready) | `settings/notices`, `NoticeCard` | `users/{uid}/notices` |
| Push token and taps | `usePushTokenSync`, `useNotificationRouting` | `registerPushToken` |
| Activity on app open | `useAppOpened` (start and foreground, at most every 6 h) | `appOpened` |

- **Authenticated downloads** (`src/firebase/storageRest.ts`): photos and the data export are fetched over the Storage
  REST API with `Authorization: Firebase <ID token>` and `X-Firebase-AppCheck`, never `getDownloadURL()`. The export
  is saved to `<cache>/exports/` (only the latest; removed with the other device data at sign-out and deletion) and
  handed to the system viewer (`File.preview`), from which the user saves or shares it.
- **Push.** The token is registered at every start of a signed-in session that has notification permission, and again
  on each `onTokenRefresh`. Sign-out first deletes the FCM token (the server keeps tokens until FCM reports them gone,
  so the next account on the phone would otherwise get this one's pushes). A tapped push carries only `data.kind`
  (S4): `routing.ts` maps it to Home, the notices list, or the one pod (its chat for chat pushes) the kind can be about,
  else the Pods tab. The kind list mirrors `functions/src/lib/push.ts`.
- **Caches** (§9): sign-out and deletion clear Firestore (`terminate()` + `clearPersistence()`), expo-image, the
  downloaded export and the query cache; a block and a photo deletion clear the image caches at once; a pod leaving
  the active list clears them at the next open (`useDeviceCacheHygiene`).
- Statements of reasons point to `SUPPORT_EMAIL` in `src/lib/support.ts`, the same placeholder address as the hosted
  privacy pages until the company domain is fixed.

Places (D8) come from Google Places (New) over REST with session tokens, filtered to core's `PUBLIC_PLACE_TYPES`
(`src/features/places`); `stub.ts` stands in for tests. Add-to-calendar uses the system sheet
(`expo-calendar/legacy` `createEventInCalendarAsync`) and needs no calendar permission.

## Needs a device or the Firebase console

See the M0 checklist in DESIGN.md §11/§15. In short:
- per project: Apple Team ID + bundle id, SHA-256 of the EAS upload key and the Play app-signing key,
  the Hosting domain in Auth authorized domains, the Apple provider's code-flow fields (for `revokeToken`);
- App Check: register the debug token of each dev device, enable App Attest and Play Integrity;
- APNs key in FCM; a white Android notification icon (prebuild warns until one exists);
- on-device embedding: `prebuild --clean` then check that ORT 1.30.0 is what Gradle/CocoaPods resolve and that
  `OnnxruntimePackage` is registered; run the golden test (`DEVICE_GOLDEN_TOLERANCE`) on 2 low-end Android phones and
  an older and a newer iPhone, measuring Hermes tokenizer heap, cold/warm latency and peak RSS; confirm Hermes
  `BigInt64Array`; check 16 KB page alignment (`zipalign -c -P 16`); `prototypes.bin` must be pinned in core (as a
  `mirror` device file, fetched via `MODEL_MIRROR_URL` and bundled like the model) before adding interests works at all;
- bundled model: on an EAS build, that the IPA contains `models/eg2-q4-daa72c5/` and that `Paths.bundle` resolves to it
  (the bundle name has a space); that the AAB stores `model_q4.onnx_data` uncompressed (`unzip -v`) and the Play base
  module stays under its limit; first-launch copy time and peak storage on a low-end Android phone; that
  onnxruntime opens the graph from the bundle and the copied path with `model_q4.onnx_data` next to it;
- Places: the app-restricted key over REST (`X-Ios-Bundle-Identifier`, `X-Android-Package` + `X-Android-Cert`);
- add-to-calendar on iOS 16 (needs calendar permission there, which the app does not request) and on Android;
- on devices: Sign in with Apple on iOS only, Google and email link on both (iOS SPM build of GoogleSignIn), Universal/App Links for
  email links, Hermes behaviour of core's Unicode regexes and `Intl.DateTimeFormat` with `timeZone`,
  photo download with auth headers, and Firestore `terminate()`/`clearPersistence()` with emulators;
- push: notification taps from the background and from a cold start (`getInitialNotification`) on both platforms,
  and that `deleteToken` at sign-out makes FCM report the old token as unregistered;
- export: the authenticated download from the Storage emulator and production, and `File.preview` of a `.json` file
  (iOS Quick Look share sheet; Android needs an app that opens `application/json`);
- the golden embedding test (`src/features/interests/embedder/golden.ts` throws `NOT_IMPLEMENTED` until core packages
  the reference vectors).
