# Friendpod

Friendship dating for groups in Denmark: every Thursday, a pod of 4–6 people
near you who share something you care about, and then you meet in person.

This spec is being written in reverse from the existing app (`/ail:adopt`),
one slice at a time, and now covers the whole app:

```
friendpod.ail.md        Friendpod (this file)
sign-in/                SignIn: welcome, sign in with Apple, Google or an email link; where the app opens
onboarding/             Onboarding: the six steps, about-you/ first
home/                   Home: this week, the drop (proposal, waiting, none), the city waitlist
pod-page/               PodPage: one pod, from proposal to reveal and its next step
  plan-meetup/          PlanMeetup: suggest options, vote, the extra round
  meetup-chat/          MeetupChat: the chat around the meetup
  after-the-meetup/     AfterTheMeetup: feedback, member sheet, block, report
interests/              Interests: the Interests tab
your-pods/              YourPods: the Pods tab
me/                     Me: the Me tab and settings
  privacy-and-data/     PrivacyAndData: privacy, private-interest consent, export, delete account
info-pages/             InfoPages: how matching works, safety, private interests, legal texts
```

The Firebase backend (callables, scheduled functions, the matcher) is described
only as far as the app shows it. The product and technical design is
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
  time         `time` is a JavaScript Date, read in its local time (getFullYear, getMonth, getDate), unless a node says its times are epoch milliseconds: then each `time` is a number of milliseconds since 1970-01-01 00:00 UTC, as packages/core's pod and planning rules pass them; a time literal such as 2026-11-21 14:00:00 is wall-clock time in Europe/Copenhagen
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
  checks.harness checks/harness/preview.ts renders the app's own screens in a headless Chromium at 390×844, the size of the storyboards: `await using app = await openApp({ route: "/about", world: "new member", locale: "en" })` builds the web preview once per run (into .ail/preview), serves it and opens the route as that world's user; the worlds a Given can name, with the day and time each starts at, are listed in checks/e2e/data.ts (World), e.g. "new member" (signed in, not onboarded, 4 November 2026 19:55 in Copenhagen). app.page is the Playwright page. Find things as a user does: app.page.getByRole, getByLabel and getByText, with the copy texts; the step's fields are labelled "First name", "Date of birth, Day", "Date of birth, Month" and "Date of birth, Year", and the Terms box is the checkbox "I accept the Terms". The app's checkboxes carry no checked state on the web (react-native-web drops it), so whether one is ticked is read from its visible tick mark: `await isTicked(box)` from the harness. Whether a button can be pressed is `isDisabled()`. Each test ends with `await app.saveScreen("<the file name it was given>")`, which saves a PNG of the page in AIL_SHOTS_DIR when it is set and does nothing otherwise
```

## Glossary

```ail
glossary
  term member                     plain "someone who has signed in to Friendpod"   formal a Firebase Auth user
  term onboarded                  plain "has finished the six onboarding steps on this phone"   formal the onb claim and the onboardingComplete.<uid> flag on the phone
  term onboarding                 plain "the six steps a new member goes through before their first pod"   formal the (onboarding) route group, steps 1–6
  term "sign-in link"             plain "a one-time link emailed to sign in without a password"   formal a Firebase Auth email sign-in link
  term "kept address"             plain "the email address a link was asked for, kept on this phone until the link is used"   formal secure-store key emailLink.pendingEmail
  term "the Terms"                plain "Friendpod's terms of use, which a member accepts as a contract"   formal LEGAL_TEXTS terms, version recorded by completeOnboarding
  term "privacy notice"           plain "how Friendpod handles personal data: information, not consent"   formal LEGAL_TEXTS privacy
  term "first name"               plain "the name other members see once a pod is confirmed"   formal users/{uid}.firstName
  term "birth date"               plain "day, month and year of birth; only the year is kept"   formal completeOnboarding.dob, stored as birthYear
  term adult                      plain "18 or older on the day"   formal ageOn(birthDate, today) ≥ MIN_AGE
  term "welcome screen"           plain "the first screen, with sign-in"   formal the (auth) index route
  term "safety pledge"            plain "the promise a member makes at the end of onboarding to meet safely"   formal onboarding.final.pledge
  term interest                   plain "something a member cares about, in their own words"   formal a holding in users/{uid}/interests
  term "main interest"            plain "one of up to 3 starred interests"   formal a holding with starred: true
  term "private interest"         plain "an interest that may say something sensitive (health, faith, sexuality…), kept apart and only ever used as the theme of a pod about it"   formal a sensitive or self-flagged holding in users/{uid}/sensitiveInterests
  term "private-interest consent" plain "the one explicit consent that lets Friendpod save private interests; it can be withdrawn at any time"   formal the blanket Art. 9 consent, users.legal.art9
  term drop                       plain "the weekly moment, Thursday 18:00, when Friendpod proposes pods or says why there is none"   formal releaseDrop at Thursday 18:00 Europe/Copenhagen
  term pod                        plain "a group of 4–6 people near each other who share an interest"   formal pods/{podId}
  term "pod colour"               plain "one of six colours (Solsikke, Blad, Bær, Tomat, Fjord, Blomme), taken from the pod's theme word"   formal podColorFor, PodColors
  term proposal                   plain "a pod offered to a member, which they answer yes or no by the deadline"   formal users/{uid}/pods/{podId} with state proposed
  term confirmed                  plain "a pod enough people said yes to, so names and photos appear"   formal the area profile's confirmationMin (4 at launch, 3 alpha)
  term "private pod"              plain "a pod formed around a private interest"   formal a pod card with themeSensitive
  term "active pod"               plain "a pod not over yet: proposed, planning, scheduled, or met with its chat still open"   formal state in proposed, planning, scheduled, or happened while the chat is open
  term "past pod"                 plain "a pod that ended"   formal state archived or dissolved
  term waitlist                   plain "a city that is not open yet, counting sign-ups toward its goal"   formal areas/{areaId}.status waitlist or beta, waitlistCount, goal.waitlist
  term reason                     plain "why the drop proposed a pod, or why there was none"   formal PodReason and UnmatchedReason codes (DESIGN §6.7)
  term priority                   plain "being placed first next week after waiting"   formal PRIORITY weeks in the matcher
  term participation              plain "whether a member is in each week's drop: every week, opt-in, skip or pause"   formal users/{uid}.participation
  term "pause matching"           plain "stop getting drops until coming back; nothing is deleted"   formal setParticipation with mode pause
  term "pod preferences"          plain "the ages, distance, meetup languages and free times a member wants"   formal users/{uid}.prefs
  term "same-gender pods"         plain "pods only with people of the member's gender, which needs its own consent"   formal prefs.sameGenderOnly plus a gender consent event
  term option                     plain "a time and a public place a member suggests for the meetup"   formal pods/{podId}/options/{optionId}
  term planner                    plain "where a confirmed pod suggests options and votes on them"   formal route /pod/{podId}/plan
  term "voting deadline"          plain "when voting closes, 72 hours after the pod is confirmed"   formal pods.planning.deadline
  term "extra round"              plain "one more day to add an option when nothing got 3 yes votes"   formal pods.planning.extended (F22)
  term "locked plan"              plain "the time and place that won, once voting is over"   formal a pod in scheduled, with planning.winningOptionId, meetupAt and place
  term "public place"             plain "a café, library, park or the like, picked from the place search"   formal a Google Places pick of a PUBLIC_PLACE_TYPES type
  term "meetup chat"              plain "the pod's short chat, open from a day before until a day after the meetup"   formal pods/{podId}/messages, written only by sendMessage
  term "chat window"              plain "when the chat can be written in: 24 hours before to 24 hours after the meetup"   formal chatWindow(meetupAt), isChatOpen
  term "contact details"          plain "a phone number, email address, handle or link"   formal checkChatText warning CONTACT_INFO_BEFORE_MEETUP
  term "member sheet"             plain "the panel that opens on a member's name in a pod"   formal route pod/[podId]/member/[uid]
  term block                      plain "never be matched with someone again; photos hidden both ways"   formal blockUser, users/{uid}/blocks/{uid}
  term report                     plain "tell Friendpod about a person, suggestion or message; the other side never learns who"   formal the report callable, REPORT_CATEGORIES
  term "meet again"               plain "a private yes or no about meeting one person again"   formal submitFeedback.meetAgain, pairSignals (F24)
  term "Keep pod"                 plain "choosing to meet the same pod again"   formal submitFeedback.keep
  term "message from Friendpod"   plain "a note about the account, kept for a year"   formal users/{uid}/notices/{id}
  term "statement of reasons"     plain "why an automatic decision was made, with no person involved"   formal notice type statementOfReasons (DSA Art. 17)
  term "data export"              plain "a file with everything Friendpod holds about the member, ready for 24 hours"   formal exportData, users/{uid}/exports/{id}
  term "sign in again"            plain "confirming it's you before exporting or deleting"   formal reauthenticate; the server wants a sign-in within 5 minutes
  term "tab bar"                  plain "the four tabs at the bottom: This week, Pods, Interests, Me"   formal the (tabs) navigator
  term "draft legal text"         plain "a legal text the lawyer has not approved yet"   formal a LEGAL_DOC_VERSIONS version ending in .draftN
```

## Design tokens

From `apps/mobile/src/components/theme.ts` (light mode; the app follows the system's dark mode too, which no check covers yet). `type.*` gives size/line height; the weight is written in the look (e.g. "type.body, 600"), display type (Bricolage) says font.display.

```ail
catalog
  tokens
    color.page=#F6F3EC  color.surface=#FFFFFF  color.text=#18211D  color.text.secondary=#3A423D  color.text.muted=#4A514C
    color.border=#E4DFD4  color.separator=#EEEAE2  color.border.strong=#C9C3B6
    color.field=#8A857A  color.track=#DDD8CD  color.primary=#1B6452  color.primary.pressed=#174F42  color.on.primary=#FFFFFF  color.link=#174F42
    color.tab.active=#174F42  color.tab.active.bg=#E1EFE9  color.tab.inactive=#4A514C
    color.house=#1B6452  color.on.house=#FFFFFF  color.field.pill=#FFFFFF  color.on.field.pill=#18211D
    color.ink=#18211D  color.on.ink=#FFFFFF  color.needs.you=#FFD84D  color.on.needs.you=#18211D  color.inset=#F6F3EC
    color.danger=#C41E3A  color.private.bg=#FFFFFF  color.private.border=#18211D  color.private.fill=#3A423D
    color.private.text=#18211D
    color.scrim=rgba(24,33,29,0.5)  color.disabled=#DDD8CD  color.disabled.text=#4A514C  color.switch.thumb=#FFFFFF
    pod.solsikke.base=#FFD84D  pod.solsikke.deep=#6A4900  pod.solsikke.tint=#FFF1C2
    pod.blad.base=#9FD05E  pod.blad.deep=#395500  pod.blad.tint=#E6F3D4
    pod.baer.base=#F48AB3  pod.baer.deep=#90124D  pod.baer.tint=#FDE2EC
    pod.tomat.base=#F26A4B  pod.tomat.deep=#8C2107  pod.tomat.tint=#FDE2D9
    pod.fjord.base=#2F6FD6  pod.fjord.deep=#124593  pod.fjord.tint=#DDE7FB
    pod.blomme.base=#6C3399  pod.blomme.deep=#4F2272  pod.blomme.tint=#EDE1F6
    space.gutter=24px  space.gutter.compact=20px  space.gap=16px  space.gap.loose=24px  space.bottom=32px  space.tab.top=40px
    space.card=16px  space.hero=20px  space.step=12px  space.dob=10px
    radius.track=2px  radius.bar=3px  radius.sm=10px  radius.input=14px  radius.md=14px  radius.lg=16px  radius.xl=18px
    radius.card=22px  radius.hero=28px  radius.pill=999px  radius.checkbox=7px
    border.hairline=1px  border.field=1.5px  border.control=1.5px  border.strong=2px
    size.hit=44px  size.button=54px  size.button.medium=48px  size.button.compact=44px  size.button.small=40px
    size.input=52px  size.input.compact=52px  size.chip=36px  size.tag=32px  size.badge=28px  size.badge.small=24px
    size.segment=6px  size.seat=44px  size.pod.badge=48px  size.dot=10px  size.tab.bar=64px  size.icon=24px  size.checkbox=24px
    font.display=Bricolage Grotesque  font.body=Plus Jakarta Sans
    type.display.xl=56px/58px  type.display.xl48=48px/50px  type.heading=15px/22px  type.display.l=44px/46px  type.title=30px/32px  type.title.compact=28px/30px  type.title.modal=26px/28px
    type.headline=22px/26px  type.pod.name=18px/22px  type.card.title=18px/24px  type.stat=20px/26px
    type.body=16px/24px  type.lede=15px/22px  type.body.small=15px/22px  type.label=15px/20px  type.button=16px/20px
    type.small=13px  type.small.text=14px/20px  type.chip=14px/18px  type.caption=13px  type.caption.text=13px/20px  type.eyebrow=12px/16px  type.micro=12px/16px
```

---

```ail
node Friendpod : system   level: product
  why   An app for finding friend groups: small groups of strangers who share
        an interest and live near each other meet in person, with no
        open-ended chat, no public profile and no swiping.
        because no app exists for finding friend groups (the owner, 27 November 2026)
  what
    1. Signing in needs no password: Apple, Google or a link sent by email.    refined-by: SignIn
    2. Joining asks only for the basics: a first name, a birth date that shows
       the person is an adult, the Terms, an area, interests and a few
       preferences.                                                            refined-by: Onboarding
    3. Every Thursday at 18:00 the drop proposes a pod to each member who can
       be matched, or says why there is none; a city that is not open yet
       shows its waitlist instead.                                             refined-by: Home
    4. A pod is revealed once enough people say yes; its members then plan
       one meetup at a public place by voting.                                 refined-by: PodPage
    5. Around the meetup the pod can talk in a short chat, and afterwards each
       member says how it went, and can block or report anyone.               refined-by: MeetupChat, AfterTheMeetup
    6. Interests are written in a member's own words, and private ones are
       only ever shown inside a pod about them.                               refined-by: Interests
    7. A member sees all their pods in one list.                               refined-by: YourPods
    8. A member controls their profile, preferences, notifications and the
       people they blocked.                                                    refined-by: Me
    9. A member can see and export their data, give or withdraw consent for
       private interests, and delete their account.                          refined-by: PrivacyAndData
   10. How matching works, how to meet safely, and the legal texts are always
       one tap away.                                                           refined-by: InfoPages
  children SignIn, Onboarding, Home, PodPage, Interests, YourPods, Me, InfoPages
  sources
    Interview: the owner, 27 November 2026 ("An app for finding friend groups. No such existing app exists.")
    docs/OVERVIEW.md "What we are building" and the founder interview of 2026-11-04; docs/DESIGN.md §3.1 (onboarding)
    README.md: "Small groups. Real meetups."
```
