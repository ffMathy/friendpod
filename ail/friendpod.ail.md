# Friendpod

Friendship dating for groups in Denmark: every Thursday, a pod of 4–6 people
near you who share something you care about, and then you meet in person.

This spec is being written in reverse from the existing app (`/ail:adopt`),
one slice at a time. It covers:

```
friendpod.ail.md                                       Friendpod (this file)
onboarding/about-you/about-you.ail.md                  AboutYou: step 1 of 6, first name, birth date and the Terms
onboarding/about-you/about-you-rules/…                 AboutYouRules: which names and dates the step accepts
```

Everything else (welcome and sign-in, the other five onboarding steps, the
weekly drop, pods, settings, the Firebase backend) is still the app as it is,
not yet described here. The product and technical design is
[docs/DESIGN.md](../docs/DESIGN.md).

## How the existing app runs here

The app ships for iOS and Android only (React Native Firebase needs a native
build), and this machine has neither a simulator nor an emulator. What runs is
the app's own **web preview** (`apps/mobile/preview`): the real screens,
routes, components, translations and data hooks, rendered with
react-native-web against an in-memory fixture world instead of Firebase. A
world is chosen with `?scenario=<id>`; `checks/e2e/data.ts` is the one place
that knows that. `run.legacy` builds the preview and serves it
(`scripts/ail/run-legacy.sh`).

## Target

The app as it is built today. `ail build` compiles `fn` and `data` nodes into
`packages/core/src/gen/`, which `@friendpod/core` re-exports, so the app and
the server share them; flows and views stay hand-written in `apps/mobile/app`
and `apps/mobile/src`, and are proven by their end-to-end checks. A node moves
to generated code once it is built: its hand-written counterpart is deleted in
the same change.

```ail
target
  code         TypeScript 6 in strict mode with noUncheckedIndexedAccess (tsconfig.base.json): an element of a list, an entry of a map and a group of a regular-expression match may be undefined and are checked before use, never asserted with `!`; ES modules, no `any`; Expo SDK 58 with expo-router, React Native 0.88 and React 19 function components; React Native Firebase 27 for Auth, Firestore, Functions and Storage
  libs         @friendpod/core (zod schemas and shared rules, consumed as source), react-i18next for every user-visible text
  structure    rules shared with the server live in packages/core, generated ones in packages/core/src/gen (re-exported from packages/core/src/index.ts by hand); generated code imports nothing outside its own folder except other generated nodes; screens are expo-router routes in apps/mobile/app; components and features in apps/mobile/src
  naming       lowerCamelCase functions and fields, UpperCamelCase types and components, UPPER_CASE constants; files in kebab-case
  exports      named exports only; export every name `what` mentions and nothing else except types
  absence      `nothing` is null
  time         `time` is a JavaScript Date; calendar days are read in its local time (getFullYear, getMonth, getDate)
  copy         user-visible text is never written in code: each `copy` key is an i18next key in apps/mobile/src/i18n/{en,da}/*.json, with both an English and a Danish text
  styling      React Native StyleSheet with the values of apps/mobile/src/components/theme.ts; design tokens are its Colors, Radius, Size and Layout
  comments     one doc comment per export quoting the clause it implements
  formatting   2-space indent, single quotes, semicolons, trailing commas, lines up to 120 characters (eslint at the root)
  path.fn      packages/core/src/gen/{dir}/{kebab}.ts
  path.data    packages/core/src/gen/{dir}/{kebab}.ts
  generated    packages/core/src/gen/**
  tests        bun test in TypeScript; flows and views are written by hand, so their checks drive the app's web preview in Chromium with Playwright
  checks.path  checks/derived/{dir}/{kebab}.check.ts
  checks.run   bun test ./checks/derived/{dir}/{kebab}.check.ts
  checks.harness checks/harness/preview.ts renders the app's own screens in a headless Chromium at 390×844, the size of the storyboards: `await using app = await openApp({ route: "/about", world: "new member", locale: "en" })` builds the web preview once (cached in .ail/preview), serves it and opens the route as that world's user; worlds: "new member" (signed in, not onboarded, today is 4 November 2026 19:55 in Copenhagen). app.page is the Playwright page. Find things as a user does: app.page.getByRole, getByLabel and getByText, with the copy texts; the step's fields are labelled "First name", "Date of birth, Day", "Date of birth, Month" and "Date of birth, Year", and the Terms box is the checkbox "I accept the Terms". The app's checkboxes carry no checked state on the web (react-native-web drops it), so whether one is ticked is read from its visible tick mark: `await isTicked(box)` from the harness. Whether a button can be pressed is `isDisabled()`. Each test ends with `await app.saveScreen("<the file name it was given>")`, which saves a PNG of the page in AIL_SHOTS_DIR when it is set and does nothing otherwise
```

## Glossary

```ail
glossary
  term member        plain "someone who has signed in to Friendpod"                              formal a Firebase Auth user
  term onboarding    plain "the six steps a new member goes through before their first pod"     formal the (onboarding) route group, steps 1–6
  term pod           plain "a group of 4–6 people near each other who share an interest"         formal pods/{podId}
  term "the Terms"   plain "Friendpod's terms of use, which a member accepts as a contract"      formal LEGAL_TEXTS terms, version recorded by completeOnboarding
  term "privacy notice" plain "how Friendpod handles personal data: information, not consent"   formal LEGAL_TEXTS privacy
  term "first name"  plain "the name other members see once a pod is confirmed"                  formal users/{uid}.firstName
  term "birth date"  plain "day, month and year of birth; only the year is kept"                 formal completeOnboarding.dob, stored as birthYear
  term adult         plain "18 or older on the day"                                              formal ageOn(birthDate, today) ≥ MIN_AGE
  term "welcome screen" plain "the first screen, with sign-in"                                   formal the (auth) index route
```

## Design tokens

From `apps/mobile/src/components/theme.ts` (light mode).

```ail
catalog
  tokens
    color.page=#F6F3EC  color.surface=#FFFFFF  color.text=#18211D  color.text.secondary=#3A423D  color.text.muted=#4A514C
    color.field=#8A857A  color.track=#DDD8CD  color.primary=#1B6452  color.on.primary=#FFFFFF  color.link=#174F42
    color.disabled=#DDD8CD  color.disabled.text=#4A514C  color.danger=#C41E3A
    space.gutter=24px  space.step=12px  space.dob=10px
    size.hit=44px  size.input=52px  size.button=54px  size.segment=6px  size.checkbox=24px
    radius.input=14px  radius.pill=999px  radius.checkbox=7px  border.field=1.5px  border.strong=2px
    font.display=Bricolage Grotesque  font.body=Plus Jakarta Sans
    type.title=30px/32px  type.lede=15px/22px  type.label=15px/20px  type.caption=13px  type.small=13px  type.button=17px
```

---

```ail
node Friendpod : system   level: product
  why   An app for finding friend groups: small groups of strangers who share
        an interest and live near each other meet in person, with no
        open-ended chat, no public profile and no swiping.
        because no app exists for finding friend groups (the owner, 27 November 2026)
  what
    1. Joining asks only for the basics: a first name, a birth date that shows
       the person is an adult, and accepting the Terms.                        refined-by: AboutYou
  children AboutYou
  sources
    Interview: the owner, 27 November 2026 ("An app for finding friend groups. No such existing app exists.")
    docs/OVERVIEW.md "What we are building" and the founder interview of 2026-11-04; docs/DESIGN.md §3.1 (onboarding)
    README.md: "Small groups. Real meetups."
```
