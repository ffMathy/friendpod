# Pod preference fields

The preference fields, as onb-prefs draws them: the ages, how far, the meetup
languages, the free times, same-gender pods and, outside onboarding, Open to
meeting anyone. Pod preferences (Me) and onboarding step 5 both show them.

```ail
node PodPreferenceFields : view   level: experience
  why   Pods are formed from these few choices, each asked in plain words, with distances shown only
        as the member's own "about" radius (DESIGN §3.1 step 9, A12, A13).    <- PodPreferences
  what
    Scenario: One distance at a time
      Given a member this week, on Pod preferences
      When they choose 25 km
      Then 25 km is chosen, with a check, and 10 km is not

    Scenario: Meetup languages are ticked one by one
      Given a member this week, on Pod preferences
      When they untick Danish
      Then Danish is not ticked and English still is

    Scenario: Open to meeting anyone is offered here
      Given a member this week, on Pod preferences
      Then it offers Open to meeting anyone, saying If no interest fits, you can be matched with nearby people without a shared theme.
      And Same-gender pods only, saying We'll ask for your gender and your consent, and use it only for this.

  how
    decide the distance is four pills, 5, 10, 15 and 25 km, read aloud as "about"
      because distances are approximate and never shown between people (DESIGN A12, A13; §3.1 step 9: "shown as about")
    decide the languages are named in the reader's language, Danish and English, not by their own names
      because the summary on Me names them the same way ("apps/mobile/src/features/profile/PreferencesForm.tsx")
    decide a chosen pill is Ink with white text and a check; switches and the slider are the brand green
      because a selected choice is Ink and "on" is Skov (design spec §6.15, quoted in "apps/mobile/src/features/profile/PreferencesForm.tsx")
    decide Open to meeting anyone shows here but not in onboarding step 5
      because onboarding leaves it to the area's default, and it can be changed later in Settings (Q12, DESIGN §6.10)
  look
    Blocks 12px apart. The ages card first (PodAgeRange).
    Each other block: its question in type.label, 700, color.text, 8px over its controls.
    Distance: four size.hit pills sharing the row 8px apart, radius.pill, type.label, 700: chosen color.ink with color.on.ink text and a check;
      the others color.surface with a border.control color.border.strong border and color.text.
    Languages: size.hit pills, 8px apart, each with a 20px square box (4px corners) before the name: ticked a color.ink pill, color.on.ink text, a white box with a color.ink check;
      unticked a color.surface pill with a border.control color.border.strong border and an empty box with a border.control color.field border.
    A refusal under its block in type.small, 700, color.danger. The free times (FreeTimesGrid).
    Same-gender pods only and Open to meeting anyone: white switch cards (color.surface, border.hairline color.border, radius.lg) with the label in type.body, 600, color.text,
      the hint in type.caption, color.text.muted, and a switch at the right: on color.primary, off color.track with a border.control color.field ring, the thumb color.switch.thumb.
  copy
    prefs.travel           "How far would you travel?"   da "Hvor langt vil du rejse for at mødes?"
    prefs.km               "{{km}} km"                   da "{{km}} km"
    prefs.aboutKm          "about {{km}} km"             da "ca. {{km}} km"
    prefs.languages        "Meetup language"             da "Sprog til møderne"
    prefs.language.da      "Danish"                      da "Dansk"
    prefs.language.en      "English"                     da "Engelsk"
    prefs.pickLanguage     "Pick at least one language."   da "Vælg mindst ét sprog."
    prefs.sameGender       "Same-gender pods only"       da "Kun pods med samme køn"
    prefs.sameGenderHint   "We'll ask for your gender and your consent, and use it only for this."   da "Vi spørger om dit køn og dit samtykke og bruger det kun til det her."
    prefs.openToAnyone     "Open to meeting anyone"      da "Åben for at møde alle"
    prefs.openToAnyoneHint "If no interest fits, you can be matched with nearby people without a shared theme."   da "Hvis ingen interesse passer, kan du blive matchet med folk i nærheden uden et fælles tema."
  binds
    route    "/settings/preferences" (the fields of Pod preferences)
    props    the form, the app's language, and whether to show Open to meeting anyone (yes unless onboarding)
    role     the distances are a radio group named "How far would you travel?", each radio named "about N km"; each language is a checkbox; each switch is named by its label
    events   a distance sets the distance; a language ticks or unticks it; Open to meeting anyone flips it; Same-gender pods only opens SameGenderPods
  uses PodAgeRange, FreeTimesGrid, SameGenderPods, PodPreferenceRules
  children PodAgeRange, FreeTimesGrid, SameGenderPods, PodPreferenceRules
  sources
    Code: "apps/mobile/src/features/profile/PreferencesForm.tsx", "apps/mobile/src/components/Controls.tsx" (the switch), "apps/mobile/src/i18n/en/onboarding.json", "apps/mobile/src/i18n/da/onboarding.json"
    Design: DESIGN §3.1 step 9, §6.10, A12, A13, Q12; "apps/mobile/preview/screens.json" onb-prefs
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
