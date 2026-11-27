# Who would you like to meet? (step 5)

Step 5 of 6: the member's pod preferences, starting from the defaults the server set from their age and area.
Continue saves them. The controls and the same-gender sheet are `PodPreferenceFields` (owned by Me → Pod
preferences, which shows them with "Open to meeting anyone" as well); this node says only what differs here.

```ail
node PreferencesStep : flow   level: experience
  why   Pods only work when everyone in them fits everyone else's wishes on age, distance, language
        and time, so a member says them once before the first drop (DESIGN §3.1 step 9, §6.1).   <- Onboarding
  what
    The controls, in order: Ages, How far would you travel?, Meetup language, When are you usually free?, Same-gender pods only.
    They start from the preferences on the member's profile; until the profile has loaded the step shows Loading.
    Continue checks them: with no language it says Pick at least one language., with no time Pick at least one time., and stays.
      Otherwise it saves the ages, the distance, the languages, the times and Open to meeting anyone unchanged, then opens step 6;
      it is busy while it saves, and a refusal shows its reason above Continue. Same-gender pods only is saved by its own sheet, never by Continue.
    Open to meeting anyone is not asked here: it keeps the value the area's profile gave it.

    Scenario: The step starts from the profile's preferences
      Given a member adding interests, whose preferences are ages 28 to 42, about 10 km, Danish and English, weekday evenings and Saturday and Sunday daytime
      When Who would you like to meet? opens
      Then it reads Step 5 of 6 and Ages 28–42
      And about 10 km is chosen, Danish and English are ticked, and Weekdays, evening, Saturday, daytime and Sunday, daytime are ticked
      And it offers Same-gender pods only, and no Open to meeting anyone

    Scenario: Continue saves and opens step 6
      Given a member adding interests, on Who would you like to meet?
      When they press Continue
      Then step 6 opens, reading Step 6 of 6 and Almost done

    Scenario: A language is needed
      Given a member adding interests, on Who would you like to meet?
      When they untick Danish and English and press Continue
      Then the step says Pick at least one language.
      And it stays on Who would you like to meet?

    Scenario: A free time is needed
      Given a member adding interests, on Who would you like to meet?
      When they untick Weekdays, evening, Saturday, daytime and Sunday, daytime and press Continue
      Then the step says Pick at least one time.
      And it stays on Who would you like to meet?

    Scenario: The step in Danish
      Given a member adding interests whose app is in Danish
      When Hvem vil du gerne møde? opens
      Then it reads Trin 5 af 6, Alder, Hvor langt vil du rejse for at mødes?, Sprog til møderne and Hvornår har du typisk tid?

  how
    decide the step starts from the profile's defaults: own age ±13 in the alpha profile, which every launch city uses, and about 10 km
      because the server creates the profile with default preferences ("packages/core/src/matching/profiles.ts": "Q19 (c) wider default ages (±13) … founder decision 2026-11-05"; DESIGN §6.10)
      because "unknown, confirm with the owner: DESIGN §3.1 step 9 still says own age ±7, and ±10 in the alpha profile, while the code and §6.10 use ±13; which is right?"
    decide Open to meeting anyone is left out here, and saved unchanged
      because the storyboard and DESIGN §3.1 step 9 leave it out; the area's profile turns it on, and Settings can change it ("apps/mobile/src/features/profile/PreferencesForm.tsx")
    decide at least one language and one free time
      because members must share a meetup language (DESIGN §6.1 H6) and a pod's free times must overlap (§6.1: the AND of availability masks is non-zero), which nobody can meet with none
    decide same-gender pods change only through their own sheet, never through Continue
      because gender is sent only together with its own consent (PRIVACY §3.6; "apps/mobile/src/features/profile/PreferencesForm.tsx")
  look
    The onboarding header and title, no lede; the controls 12px apart, each with its legend in type.label, 700, color.text, 8px above it; Continue as every step's.
  copy
    onboarding.prefs.title    "Who would you like to meet?"   da "Hvem vil du gerne møde?"
    prefs.pickLanguage        "Pick at least one language."   da "Vælg mindst ét sprog."
    prefs.pickAvailability    "Pick at least one time."       da "Vælg mindst ét tidspunkt."
    common.loading            "Loading"                       da "Indlæser"
  binds
    route    "/pod-preferences"
    state    the form's preferences, starting at the profile's
    events   Continue checks them, saves all but same-gender pods, then opens step 6
  uses PodPreferenceFields
  sources
    Code: "apps/mobile/app/(onboarding)/pod-preferences.tsx", "apps/mobile/src/features/profile/PreferencesForm.tsx", "packages/core/src/schemas/profile.ts" (the preferences rules)
    Design: DESIGN §3.1 step 9, §6.1, §6.10; PRIVACY §3.6
    Screens: "apps/mobile/preview/screens.json" onb-prefs; driven in the web preview, world onboarding-interests, in English and Danish, on 27 November 2026
```
