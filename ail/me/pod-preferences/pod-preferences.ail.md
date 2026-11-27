# Pod preferences

Me → Pod preferences (`/settings/preferences`): who the member would like to
meet and when they are free, with Save pinned at the bottom. The fields are a
child of their own, shared with onboarding step 5.

```ail
node PodPreferences : flow   level: experience
  why   A member can change, at any time, the ages, distance, meetup languages and times that shape their
        pods; a change counts from the next drop (DESIGN §3.1 step 9, §11 settings).   <- Me
  what
    Scenario: The page shows what is saved
      Given a member this week, whose preferences are ages 28–42, about 10 km, Danish and English, weekday evenings and Saturday and Sunday daytime
      When Pod preferences opens
      Then it reads Me above Pod preferences, and Who you'd like to meet and when you're free. Changes count from the next drop.
      And Ages reads 28–42, 10 km is chosen, Danish and English are ticked
      And Weekdays, evening, Saturday, daytime and Sunday, daytime are ticked, the other three times are not

    Scenario: Saved changes show on Me
      Given a member this week, on Me
      When they open Pod preferences, choose 15 km, untick Danish and press Save
      Then Me shows again, its Pod preferences row reading Ages 28–42 · about 15 km and English

    Scenario: Save needs a language and a time
      Given a member this week, on Pod preferences
      When they untick both languages and every time, and press Save
      Then it says Pick at least one language. and Pick at least one time.
      And Pod preferences stays open
      When they tick English again
      Then Pick at least one language. is gone

    Scenario: Pod preferences in Danish
      Given a member this week whose app is in Danish
      When Pod preferences opens
      Then it reads Ønsker til pods, Alder, Hvor langt vil du rejse for at mødes?, Sprog til møderne with Dansk and Engelsk, and Gem

  how
    decide the same fields as onboarding step 5, plus Open to meeting anyone
      because onb-prefs draws them, and Open to meeting anyone is changed only here (DESIGN §3.1 step 9, Q12)
    decide Save checks the whole form first, shows each problem under its field, and sends nothing until they are fixed; a fixed field's message goes at once
      because the server would refuse the same (PodPreferenceRules; "apps/mobile/src/features/profile/PreferencesForm.tsx")
    decide Save sends everything but same-gender pods, then returns to the previous screen
      because same-gender pods change only through their own consent ("apps/mobile/src/features/profile/PreferencesForm.tsx")
    decide changes count from the next drop, and the page says so
      because the drop works on inputs frozen on Thursday at 16:00 (DESIGN §4.1)
    decide no note asks to keep unsaved changes when leaving
      because "unknown, confirm with the owner: Back drops unsaved changes without asking; is that wanted?"
  look
    Paper page with the Settings header: "Me" eyebrow over "Pod preferences" in font.display, type.title, 800; blocks 18px apart; Me's tab bar at the foot.
    The lede in type.body, color.text.secondary, then the fields.
    Save pinned above the tab bar, the page fading out under it: full width, size.button tall, radius.pill, color.primary with color.on.primary text, type.button, 700.
  copy
    me.preferences       "Pod preferences"   da "Ønsker til pods"
    me.preferencesLede   "Who you'd like to meet and when you're free. Changes count from the next drop."   da "Hvem du gerne vil møde, og hvornår du kan. Ændringer gælder fra næste drop."
    common.save          "Save"              da "Gem"
    tabs.me              "Me"                da "Mig"
    common.loadFailed    "This could not be loaded. Try again later."   da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    route    "/settings/preferences"
    shows    Loading while the profile loads; the title and a card with common.loadFailed if it cannot be
    state    the form, starting at the saved preferences
    events   Save checks the form; when it passes, sends every preference but same-gender pods and, once saved, returns to the previous screen; the button shows it is busy meanwhile
  uses PodPreferenceFields
  children PodPreferenceFields
  sources
    Code: "apps/mobile/app/settings/preferences.tsx", "apps/mobile/src/features/profile/PreferencesForm.tsx", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/en/onboarding.json"
    Design: DESIGN §3.1 step 9, §4.1, §11; "apps/mobile/preview/screens.json" app-settings-preferences and onb-prefs
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
