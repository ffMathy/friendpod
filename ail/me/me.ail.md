# Me

The Me tab (`/me`): the member's own profile and the way to everything about
their account. From top to bottom: the profile card (photo, name, area, their
own meetup record), their interests, About me, Weekly drops, a note when one of
their settings kept them out of the last drop, then two list cards: Your
account (pod preferences, privacy, messages from Friendpod, settings) and Good
to know (the info pages). Each card is a child; the pages it opens are too.

```ail
node Me : flow   level: experience
  why   A member controls their own profile, preferences, notifications and the people they blocked,
        in one calm place that never looks like a public profile (DESIGN §11: Me; PRIVACY §6).   <- Friendpod
  what
    Scenario: Me shows the member and their account
      Given a member this week
      When Me opens
      Then it reads Me, with Emil, Aarhus C and Attended 2 of 2 meetups, and Your account lists Pod preferences with Ages 28–42 · about 10 km and Danish, English,
        Privacy, Messages from Friendpod and Settings
      And Good to know lists How matching works, Meeting safely and Private interests

    Scenario: A setting that kept a new member out is named
      Given a new member with nothing yet, whose last drop found no pod because of their distance
      When Me opens
      Then it says Your distance is short for your area. Going a little further would help.
      When they press Change preferences
      Then Pod preferences opens

    Scenario: The account rows open their pages
      Given a member this week, on Me
      When they press Pod preferences, Messages from Friendpod, Settings or Privacy
      Then that page opens, with Back above its title, and Back returns to Me (on Privacy, Back is the Me above the title)

    Scenario: Me in Danish
      Given a new member with nothing yet whose app is in Danish
      When Me opens
      Then it reads Mig, Ingen møder endnu, Din konto, Ønsker til pods with 28–42 år · ca. 10 km and Dansk, Engelsk

  how
    decide no storyboard draws Me; it follows the calm screens: Paper, white cards, list rows, the brand green only on what can be pressed
      because Me has no storyboard, so it borrows priv-settings' list cards (whose "Me" eyebrow points here) and onb-final's photo card ("apps/mobile/app/(tabs)/me.tsx")
    decide the note naming a setting shows only when the last drop found no pod because of one of the member's own settings: distance, ages, same-gender pods, meetup languages or free times
      because Me shows "the setting that blocks matching, if any" (DESIGN §11, §6.7), and only those reasons are the member's to change ("apps/mobile/src/lib/reasons.ts")
    decide the preferences row sums them up in two lines: ages and distance, then the meetup languages, named in the reader's language
      because a line break never falls inside a part, and the names match the Pod preferences page ("apps/mobile/src/features/shell/prefsSummary.ts")
    decide distances are never shown, only the member's own radius as "about"
      because distances could reveal where others live (DESIGN A13, A12)
    decide Privacy is on Me and on Settings; pod preferences and messages from Friendpod are on Me only; blocked people are under Privacy
      because the consent texts send people to Settings → Privacy, and the two lists should not repeat each other ("apps/mobile/app/settings/index.tsx")
  look
    Paper page (color.page), side padding space.gutter.compact, cards space.gap apart, the title "Me" 40px from the top in font.display, type.title, 800, color.text.
    The note naming a setting: a white card (color.surface, border.hairline color.border, radius.lg) with an info icon and the text in type.caption, color.text.secondary,
      and "Change preferences" under it as a small white secondary button (size.button.small, radius.pill, border.control color.border.strong).
    Your account and Good to know: white list cards (color.surface, border.hairline color.border, radius.card) with the eyebrow in type.eyebrow, 800, upper case, color.text.muted;
      rows at least 56px tall with a color.text.secondary icon, the label in type.label, 600, color.text, the detail in type.caption, color.text.muted, a chevron at the right,
      and border.hairline color.separator lines between them.
    Friendpod's four-tab bar at the foot, size.tab.bar tall, with Me selected (color.tab.active on color.tab.active.bg).
  copy
    tabs.me                 "Me"                                         da "Mig"
    me.yourAccount          "Your account"                               da "Din konto"
    me.preferences          "Pod preferences"                            da "Ønsker til pods"
    me.prefsAges            "Ages {{min}}–{{max}}"                       da "{{min}}–{{max}} år"
    me.prefsKm              "about {{km}} km"                            da "ca. {{km}} km"
    me.privacy              "Privacy"                                    da "Privatliv"
    me.privacyDetail        "Consents, your data, delete account"       da "Samtykker, dine data, slet konto"
    notices.title           "Messages from Friendpod"                    da "Beskeder fra Friendpod"
    me.noticesDetail        "Pauses, report receipts, your data"        da "Pauser, kvitteringer, dine data"
    me.settings             "Settings"                                   da "Indstillinger"
    me.settingsDetail       "Language, notifications, legal, sign out"  da "Sprog, notifikationer, vilkår og log ud"
    me.goodToKnow           "Good to know"                               da "Godt at vide"
    me.changePreferences    "Change preferences"                         da "Ret dine ønsker"
    blockingSetting.RADIUS        "Your distance is short for your area. Going a little further would help."   da "Din afstand er kort i forhold til dit område. Det hjælper at sætte den op."
    blockingSetting.AGE           "Your age range is narrow for your area."                 da "Dit aldersinterval er smalt i forhold til dit område."
    blockingSetting.GENDER_POOL   "Same-gender pods are rare in your area right now."       da "Pods med samme køn er sjældne i dit område lige nu."
    blockingSetting.LANGUAGE      "Few people near you share your meetup languages."        da "Få i nærheden kan mødes på dine sprog."
    blockingSetting.AVAILABILITY  "Few people near you can meet at your times."             da "Få i nærheden kan mødes på dine tidspunkter."
    common.loadFailed       "This could not be loaded. Try again later."  da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    route    "/me", the fourth tab
    shows    while the profile loads, Loading; if it cannot be loaded, the title and a card with common.loadFailed
    shows    the note for the last drop's reason when the last drop is unmatched and its reason is RADIUS, AGE, GENDER_POOL, LANGUAGE or AVAILABILITY
    events   Pod preferences and Change preferences open "/settings/preferences"; Privacy "/settings/privacy"; Messages from Friendpod "/settings/notices"; Settings "/settings"
    events   How matching works, Meeting safely and Private interests open "/info/how-matching-works", "/info/safety" and "/info/sensitive-interests"
  uses MeProfileCard, MeInterestsCard, MeAboutMe, MeWeeklyDrops, InfoPages
  children MeProfileCard, MeInterestsCard, MeAboutMe, MeWeeklyDrops, PodPreferences, FriendpodMessages, MeSettings, BlockedPeople, PrivacyAndData
  sources
    Code: "apps/mobile/app/(tabs)/me.tsx", "apps/mobile/src/features/shell/prefsSummary.ts", "apps/mobile/src/lib/reasons.ts", "apps/mobile/src/features/shell/parts.tsx", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: DESIGN §11 (screens: Me), §6.7 (reasons), A12, A13; "apps/mobile/preview/screens.json" app-me and app-me-new
    Screens: driven in the web preview on 27 November 2026, worlds this-week and me-new, in English and Danish
    No tickets: friendpod has no issues; pull request 4 says only that Me and settings get the storyboards' identity
```
