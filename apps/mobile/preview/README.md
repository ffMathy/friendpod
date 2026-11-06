# Web preview harness

Renders the **real app screens** (expo-router routes, components, i18n, data hooks) in a browser with fixture data,
so each screen can be screenshotted at 390×844 and compared side by side with its design storyboard. Web is preview
only: the app ships for iOS and Android, and nothing here changes native builds or Jest.

```
npm -w apps/mobile run preview:shoot -- --only drop-home,pod-plan --out /tmp/me/shots --build-dir /tmp/me/build
npm -w apps/mobile run preview:shoot -- --all --locale da --out /tmp/me/shots-da --build-dir /tmp/me/build --skip-build
```

For each id this writes `<out>/<id>.app.png` (the app, 390×844, scale 1, after fonts and data have settled),
`<out>/<id>.storyboard.png` and `<out>/<id>.side.png` (storyboard left, app right, labelled) when the entry has a
storyboard, and `<out>/report.json` (per id: final path, redirect, blank or unmatched route, console and page errors,
preview issues such as blocked network requests or unstubbed callables, a text sample). The command exits 1 if any
screen failed to render.

| Script | What it does |
| --- | --- |
| `preview:shoot -- <options>` | build (unless `--skip-build`), serve, shoot. Options: `--only a,b` or `--all`, `--out`, `--build-dir`, `--skip-build`, `--build-only`, `--locale en\|da`, `--color-scheme light\|dark`, `--storyboards <dir>` |
| `preview:build -- --build-dir <dir>` | only the web export |
| `preview:serve -- --build-dir <dir> [--port 8090]` | serve a build for a normal browser: `http://127.0.0.1:8090/pod/braetspilpodaarhus46?scenario=pod-scheduled&locale=da` |
| `preview:check` | validates every scenario document against its `@grouper/core` schema, and `screens.json` (runs before every build) |
| `preview:typecheck` | type-checks the harness with the app code |

Use your own `--build-dir` and `--out` when several people or agents build at once. A build takes about 20 s with a
warm Metro cache. Playwright with Chromium must be loadable with `require('playwright')` (it is in this environment);
the shoot uses timezone Europe/Copenhagen.

## How it works

- `EXPO_PUBLIC_PREVIEW=1 expo export --platform web` (plus `EXPO_PUBLIC_EMBEDDER=stub`, `EXPO_PUBLIC_PLACES_KEY=preview`).
  `metro.config.js` is Expo's default config; only with that flag does it call `preview/metro.cjs`, and every rule
  there is limited to `platform === 'web'`.
- `preview/metro.cjs` resolves, on web only:
  - expo-router's first import to `runtime/boot.ts`, which installs the scenario before the root layout runs;
  - native-only modules to fakes in `mocks/` (`@react-native-firebase/*`, Google and Apple sign-in, secure store,
    screen capture, calendar, localization, notifications, onnxruntime);
  - `Platform` in the app's own code (`app/`, `src/`) to `mocks/platform.ts`, so the app renders as on an iPhone
    (Sign in with Apple shows). `babel-transformer.cjs` keeps those `Platform.OS` reads from being inlined as `'web'`;
  - `react` as imported by react-dom to a shim reporting react-dom's version (see Known limitations).
- `runtime/` holds the fixture world: a fixed clock (`Date` starts at the scenario's `now` and runs on), an in-memory
  Firestore (docs, collections, `where`/`orderBy`/`limit`, `onSnapshot`, writes), callables with valid default answers
  (`runtime/callables.ts`), auth with the scenario's user and claims, and a network layer that serves placeholder
  photos for Storage downloads, the scenario's places for Google Places, and blocks every other external request.

## Scenarios

One file per scenario in `scenarios/<id>.ts`, found automatically (files starting with `_` are helpers). URL:
`?scenario=<id>&locale=da|en&platform=ios|android`. Scenarios mirror the storyboards' data: Aarhus C, the brætspil pod
with Mette, Jonas, Sofie and Ahmed, the viewer's interests (brætspil, sourdough, far på barsel, trail running, and the
private "gravid"). The storyboards' viewer is called Mathias; the preview calls him Emil so no real person appears.
Venues are bracketed placeholders (`[Board game café]`), never real places. The storyboards' "Saturday 15 Nov" is a
Sunday in 2026, so the meetup is Saturday 14 Nov 2026, 14:00.

```ts
// scenarios/pod-scheduled.ts (shortened)
const scenario: Scenario = {
  id: 'pod-scheduled',                       // = file name
  title: 'Scheduled pod the day before',
  now: now('2026-11-13 19:30'),              // Copenhagen wall-clock
  user: ONBOARDED_USER,                      // or null (signed out), NEW_USER (no onb claim)
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({                   // Firestore path → fields; ts('2026-11-14 14:00') for Timestamps
    ...profileWorld({ locale }),             // users/u_me, interests, private interest, areas/aarhus (live)
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'scheduled', myStatus: 'accepted' }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod({ state: 'scheduled', planning: LOCKED_PLANNING }),
    ...chatMessages(POD_BRAETSPIL, 'friday', locale),
  }),
  callables: { report: () => ({ reportId: 'r1' }) },   // optional overrides of runtime/callables.ts
};
```

Other fields: `onboardingFinished: false` (post-claim onboarding steps), `places` (place search results),
`pushPermission`, `secureStore`, `platform`, `locale`. To add or change one:

1. Copy the closest scenario, rename the file and its `id`; reuse `_kit.ts` builders (add new shared fixtures there).
2. `npm -w apps/mobile run preview:check`: every document must parse with the core schema the app reads it with, or
   the screen shows an error or a spinner instead of the state you meant.
3. Add or point an entry in `screens.json` at it, then shoot it.

Keep scenarios like for like with the storyboards (same names, ages 29–38, Aarhus C, times), and keep Danish content
(chat messages, About me) natural Danish. Data a screen does not use is fine: scenarios are whole worlds, so a
redesigned screen can read more (interests, other pods) without new fixtures.

## screens.json

One entry per storyboard artboard (25) plus `app-*` entries for the other routes:
`{ id, title, storyboard, route, scenario, notes, steps? }`. `steps` run before the screenshot, as Playwright
selectors: `{ "fill": sel, "text": "…" }`, `{ "click": sel }`, `{ "press": sel, "key": "Enter" }`,
`{ "waitFor": sel }`, `{ "scroll": sel }`, `{ "wait": ms }`. Prefer `testID`s (`[data-testid="…"]`) or roles over
visible text, which changes with the copy. `storyboardDir` is where the `*.dc.html` artboards live on this machine;
override with `--storyboards` or `PREVIEW_STORYBOARDS`. When a route or flow changes (e.g. the onboarding becomes the
storyboard's 6 steps), update the entry's `route` and `notes`.

## Known limitations

- It is react-native-web, not a phone: no native stack transitions, safe areas are zero, `Alert.alert` does nothing,
  Share/Linking/Calendar are fakes. Check the real thing on a device before calling a screen done.
- Transient UI state (an open form, a typed suggestion) needs `steps`; scenarios only hold data.
- The workspace pins react 19.3.0 while react-dom 19.3.1 is installed; react-dom refuses mismatched versions, so the
  preview shims the version string (`mocks/react-for-react-dom.js`). Pinning react-dom to the react version removes
  the need.
- Fixture documents are validated against the schemas, but callable defaults are generic: a flow that depends on a
  specific server answer needs a `callables` override in its scenario.
