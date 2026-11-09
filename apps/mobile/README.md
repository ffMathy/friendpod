# @grouper/mobile

The Friendpod app: Expo SDK 58 (expo 58.0.23, React Native 0.88.1, New Architecture) with React Native
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
  (tabs)/            this week, pods, interests, me
  pod/[podId]/       pod, plan, chat (meetup chat, §3.6), feedback, member/[uid]
  sheets/            why-this-pod, report
  settings/, info/   privacy, blocked, notifications, notices, preferences; transparency pages
src/
  firebase/          RNFirebase init, App Check, emulators, typed callables (core zod schemas)
  data/              TanStack Query client, callable mutations, onSnapshot bridges, typed doc hooks
  features/          auth, session, onboarding, interests (+ embedder/), consent, profile, pods, places, chat, photos, notifications, notices, account
  components/        the design system: tokens (theme.ts), primitives (ui.tsx re-exports), icons, nav chrome
  i18n/              en/ and da/ per-area copy files (+ native/ for iOS permission prompts)
test/                jest tests
```

Consent copy (the blanket Art. 9 consent, gender, standing notice, withdrawal) is rendered verbatim from
`@grouper/core` legal texts; the client sends `{textVersion, textSha256, appVersion, checked: true}` (`appVersion` from `app.config.ts`, recorded on the consent event).
The blanket Art. 9 consent (D3) is its own onboarding step after `completeOnboarding` (`(onboarding)/sensitive-consent`)
and can be given or withdrawn in Settings → Privacy. Without it, a tag that is sensitive for the holding is refused on
the phone and never sent.

## Design system

Direction E "Blend" (founder-approved; spec `blend-spec.md`): **a pod colour for every group, a poster for every
ritual, a seat saved for you.** Storyboards are 390 × 844 artboards and React Native units equal CSS px at that width, so
the numbers are the spec's own. Everything lives in `src/components/` and is imported from one place:

```tsx
import { Screen, PageHeader, Button, Chip, HeroCard, SeatRow } from '@/components/ui';
import { usePalette, usePodColors, Type, font, fontDisplay } from '@/components/theme';
import { podColorFor } from '@/lib/podColor';
```

**Chrome tokens** (`theme.ts`, `usePalette()`, light and dark): `page` Paper #F6F3EC, `surface` White, `inset` (a note
in a card), `text` Ink #18211D, `textSecondary` Ink 2 #3A423D (text on tints), `textMuted` #4A514C (never on a tint),
`border` Line, `separator` Divider, `borderStrong` Outline (secondary buttons, suggestion chips), `field` #8A857A (input
borders, open seats), `track`, `primary` Skov #1B6452 (**everything you tap**; pressed `primaryPressed`), `link` Skov
deep, `tabActive`/`tabActiveBg`/`tabInactive`, `house` (the Skov poster field), `ink`/`onInk` (status pills, You,
unread, selected choice, Apple), `needsYou` Solsikke + `needsYouBorder` Ink, `danger` #C41E3A (outline only, never a
fill), `privateBg`/`privateBorder`/`privateText`/`privateFill` (quiet: white, Ink ring), `scrim`, `disabled*`,
`switchThumb`. Dark mode (spec §12): Paper → Night #131916, Skov light #7FCDB0 with Ink labels, the house field stays
Skov. `Layout`, `Radius` (14 inputs, 22 cards, 28 hero/band/sheet, `pill`), `BorderWidth` (1, 1.5 `control`, 2),
`Size` (54/48/44 buttons, 52 input + Add, 44 seats and targets, 48 pod badge) and `Space` hold the rest. Never
hard-code a colour in a screen.

**Pod colours.** Six, in index order: Solsikke, Blad, Bær, Tomat, Fjord, Blomme (`POD_PALETTE`: base, deep, tint,
onBase, tintBorder). Which one a pod or interest gets comes from the **word shown**, normalized (founder decision):
`podColorFor({ word, podId, sensitive })` (FNV-1a 32 of `"grouper:3410:" + normalizeTag(word).norm`,
`floor(h × 6 / 2³²)`; the salt reproduces the storyboards: brætspil Tomat, sourdough Solsikke, far på barsel Fjord,
trail running Blad, coffee Bær, hiking Blomme). The same word has the same colour everywhere, for everyone; interests
use their own word (`interestColor`), a pod the theme word on the viewer's card (`podColorOf`, `cardColor`).
Open-to-anyone pods (no theme word) use `"grouper:" + pod id`; private gets `null`. Accepted trade-off: members who
see a theme in different wordings (or app languages) may see different colours. `usePodColors(color)` resolves the roles for the scheme (`field`, `onField`,
`surface`, `surfaceBorder`, `name`, `icon`, `dot`, `dotRing`, `avatar`, …; `null` gives the quiet private set). On a
pod's own screens another interest in the pod's colour is a plain chip (`colorOnPodScreen`).

**Typography.** Bricolage Grotesque 700/800 (display, static opsz 14) and Plus Jakarta Sans 400–800 (everything you
read), loaded by the root layout (`fonts.ts`, splash held until ready) and embedded natively by the `expo-font` plugin
in `app.config.ts`. A custom font needs one family per weight, so **never set `fontWeight`** (a test enforces it): use
`<Text variant="…">`, the named primitives (`Display` L/XL, `Title`, `Headline`, `PodName`, `Heading`, `Body`, `Lede`,
`Small`, `Label`, `Eyebrow`, `Overline`), `<Strong>`, or in a StyleSheet `Type.body` / `typeStyle('body', '700')` /
`font('600')` / `fontDisplay('800')`. Display roles: `displayXL` 56/58 (fit steps 52, 48, 40; `fitDisplay()`),
`displayL` 44/46, `title` 30/32, `titleModal` 26, `headline` 22/26 (700), `podName` 18/22, `wordmark`. Reading roles:
`body` 16/24, `bodySmall` 15/22, `heading` 15/700, `small` 14/20, `chip`, `caption` 13/20, `captionBold` 13/700 (pills,
status), `eyebrow` 12/800 caps, `badge` 12/800, `micro` 12/16.

**Primitives** (`ui.tsx`): layout (`Screen`, `StepHeader` with 6 segments, `PageHeader`, `Sheet`, `Loading`);
`Button` (primary, secondary/outline, danger = outline + trash icon + word, apple, ghost, dashed, link, quietLink;
sizes lg 54, md 48, sm 44, xs 40, input 52/r14), `IconButton`, `BackButton`, `CloseButton`, `TextLink`, `InlineLink`;
`TextField` and `AddField` (the one input + Add pattern); `Chip` (pod, private, unsettled, clash; removable with a
44 px ×), `ChipButton` (suggestion "+ word"), `ChipRow`, `Tag`, `PodDot`; `Badge` (status, needsYou, onField, unread,
outline, private, danger), `UnreadBadge`, `UnreadDot`, `StatusText` (quiet "Hasn't confirmed"); `Note`/`Banner`
(needsYou with the ringed marker, info, inset, safety, private), `Card` (default, highlighted, panel, inset, private),
`ListSection`/`ListRow`, `SectionHeader`, `Divider`, `EmptyState`, `Illustration`; `Avatar` (pod deep, You ring,
pending dashed, open seat) and `AvatarStack`; pod pieces `HeroCard` + `PodTintBand` (pod colour, `null` private or
`plain`; a wrapping pill row; the name steps down from Display L to fit), `PodBand`, `SeatRow`/`Seat`,
`PosterField` + `PosterFoot` (+ `useFieldColors`), `TintDisc`, `OptionCard`; `PodMark` (dots, badge, poster; applies
the sun rule) and `Logo` (lowercase "friendpod" lockup); controls `Checkbox`, `Radio`, `Switch`, `ChoiceChip`, `Toggle`,
`SegmentedControl`; `ProgressBar`, `ProgressSegments`. Every control keeps a 44 px touch target and its accessibility
role and state; marks, seats and avatars are decorative.

**Rules.** Poster fields only for the three rituals (welcome, the Thursday drop on This week, the pod-confirmed
reveal); display type only on a field, small text on the white foot. Colour grows with commitment: proposal = tint
band, waiting = lit seats, confirmed = base field. Private stays quiet (no colour anywhere). Needs-you (Solsikke + Ink
ring) only for your own deadlines; others' states are quiet `StatusText`. Danger is an outline. Unread is Ink.

**Icons** (`Icon.tsx`, decorative unless given an `accessibilityLabel`): back, chevronRight, close, check, plus,
calendar, calendarAdd, people, tag, person, pin, clock, lock, camera, bell, info, help, phone, alert, shield, star,
starFilled (Ink), send, search, chat, download, share, more, pause, trash, block, flag.

**Navigation chrome** (`navigation.tsx`): every Stack uses `useStackScreenOptions()` (Paper header, no hairline, Ink
chevron, Bricolage title); the tab bar uses `useTabScreenOptions()` and `TabBarIcon` (Skov-tint pill behind the active
icon, Ink unread dot), also used by the bars under pushed pages (`MainTabBar`, `PodTabBar`).

**Identity.** The mark is people around a sun with your seat saved (`PodMark`). The app icon (`assets/images/icon.png`,
Skov square, poster mark at 75 %, your seat solid), the Android adaptive layers (mark inside the 66 dp safe circle,
Skov background, monochrome), the splash (`splash-icon.png` on Skov, 200 dp, same in dark mode) and the iOS Icon
Composer layer (`assets/expo.icon/Assets/mark.svg`, Skov fill) are rendered from the SVGs in `assets/images/source/`
with Playwright at 1024 × 1024.

**Copy.** `src/i18n/{en,da}/<area>.json`, deep-merged at start (`resources.ts`): common, auth, onboarding, drop, pod,
after, privacy, shell. Key paths are unchanged (`t('pod.next.voteBody')`); a key lives in one file only and both
languages have the same keys per file (test/i18n.test.ts). Danish copy is written as Danish, not translated word for
word. In the app the tagline is "Der er plads til dig." / "There's room for you." (posters keep the seat line).

## On-device embedding (D1)

Every interest is embedded on the phone with the pinned EmbeddingGemma 2 q4 graph (`EMBEDDING_MODEL` in core) and
scored by the core detector against `prototypes.bin`; `addInterests` receives `{text, vector, detector: {margin}}`. That
margin is the only sensitivity signal besides "Keep this private" (DESIGN.md F38): there is no word list on the phone or
the server. The stub embedder (`EXPO_PUBLIC_EMBEDDER=stub`, tests) fakes the model's judgement with a few word stems.

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
| Confirmed pod: next step, plan, chat, members (with "about me") | `pod/[podId]/index`, `LockedPlan` | `pods/{podId}`, `options`; `setPhotoSharing` |
| Propose and vote, extension round, report an option | `pod/[podId]/plan`, `PlacePicker` | `proposeOption`, `voteOption` |
| Attendance ("Still coming?", "Can't make it", "hasn't confirmed") | `AttendanceCard` | `confirmAttendance` |
| Add to calendar, open in Maps | `LockedPlan` | system sheet (`expo-calendar/legacy`), `place.mapUrl` |
| Feedback | `pod/[podId]/feedback` | `submitFeedback` |
| Leave pod | pod screen | `leavePod` |
| Block (remove them / leave instead / re-plan when scheduled), unblock, report a member, option or message | `pod/[podId]/member/[uid]`, `sheets/report`, `settings/blocked` | `blockUser`, `unblockUser`, `report`; `users/{uid}/blocks` |
| Interests (remove, star, did-you-mean, keep private, not sensitive for me) | `InterestManager` | `addInterests`, `removeInterest`, `updateInterest`, `confirmSuggestion` |
| Privacy: Art. 9 and gender consent, pause / skip, photo, export, blocked, notices, delete | `settings/privacy`, `settings/delete-account` | `setArt9Consent`, `withdrawArt9Consent`, `updateProfile`, `setParticipation`, `deletePhoto`, `exportData`, `deleteAccount`; `users/{uid}/exports` |
| Photo upload, change and delete | `(onboarding)/photo`, Me → `PhotoCard` | Storage `uploads/{uid}/pending*.jpg` (`onPhotoUploaded`), `deletePhoto` |
| Messages from Friendpod (statements of reasons, report receipts, export ready) | `settings/notices`, `NoticeCard` | `users/{uid}/notices` |
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
