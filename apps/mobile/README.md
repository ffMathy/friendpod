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
| `npm start` | Metro for a development build |
| `npm run android` / `npm run ios` | Local native build (`expo run:*`; needs Android SDK / Xcode) |

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
| `MODEL_BASE_URL` | EAS env var (optional) | Where the pinned on-device model files are served; default `https://storage.googleapis.com/<project>-models/models/eg2-q4-daa72c5/` (DESIGN.md §8) |
| `EXPO_PUBLIC_EMBEDDER=stub` | your shell | Deterministic fake vectors instead of the ~180 MB model; refused outside development, always on in jest |
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
  (tabs)/            this week, pods, interests, me
  pod/[podId]/       pod, plan, chat (meetup chat, §3.6), feedback, member/[uid]
  sheets/            why-this-pod, report
  settings/, info/   privacy, blocked, notifications, preferences; transparency pages
src/
  firebase/          RNFirebase init, App Check, emulators, typed callables (core zod schemas)
  data/              TanStack Query client, callable mutations, onSnapshot bridges, typed doc hooks
  features/          auth, session, onboarding, interests (+ embedder/), consent, profile, pods, places, chat, photos, notifications, account
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
- Files: downloaded on first use from `MODEL_BASE_URL` into `Documents/models/eg2-q4-daa72c5/` (excluded from iCloud
  backup), Wi-Fi by default, mobile data only after asking. Each file must match the size and SHA-256 pinned in core
  before it is used; a mismatch is deleted.
- The model is loaded while an interests screen is focused and released when it loses focus.
- If the device cannot run it, adding interests is blocked with a message and a retry; there is no server fallback.
- `src/features/interests/embedder/stub.ts` is the deterministic stand-in for jest and `EXPO_PUBLIC_EMBEDDER=stub`.

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
  `BigInt64Array`; check 16 KB page alignment (`zipalign -c -P 16`); the model files and `prototypes.bin` must be
  hosted at `MODEL_BASE_URL` and `prototypes.bin` pinned in core before adding interests works at all;
- Places: the app-restricted key over REST (`X-Ios-Bundle-Identifier`, `X-Android-Package` + `X-Android-Cert`);
- add-to-calendar on iOS 16 (needs calendar permission there, which the app does not request) and on Android;
- on devices: Sign in with Apple on iOS only, Google and email link on both (iOS SPM build of GoogleSignIn), Universal/App Links for
  email links, Hermes behaviour of core's Unicode regexes and `Intl.DateTimeFormat` with `timeZone`,
  photo download with auth headers, and Firestore `terminate()`/`clearPersistence()` with emulators.
