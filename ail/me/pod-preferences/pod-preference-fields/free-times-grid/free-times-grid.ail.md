# When are you usually free?

The free-times grid of the preference fields: weekdays, Saturday and Sunday
across, daytime and evening down; six boxes to tick.

```ail
node FreeTimesGrid : view   level: experience
  why   A pod only forms when its members share at least one time they can meet, so each member
        says roughly when they are usually free (DESIGN A9, §6.1).            <- PodPreferenceFields
  what
    Scenario: Ticking and unticking a time
      Given a member this week, on Pod preferences
      When they tick Saturday, evening and untick Sunday, daytime
      Then Saturday, evening is ticked and Sunday, daytime is not

    Scenario: The grid in Danish
      Given a member this week whose app is in Danish, on Pod preferences
      Then it reads Hvornår har du typisk tid?, Hverdage, Lørdag, Søndag, Dag and Aften

  how
    decide six slots, three day groups by daytime or evening
      because availability is six bits: weekday, Saturday or Sunday, by day or evening (DESIGN A9)
    decide each box is a checkbox named by its slot, "Saturday, daytime", and the column and row heads are hidden from screen readers
      because the names already say both ("apps/mobile/src/features/profile/AvailabilityGrid.tsx")
    decide a ticked box is Ink with a white check
      because a selected choice is Ink (design spec §6.15, quoted in "apps/mobile/src/features/profile/AvailabilityGrid.tsx")
  look
    The question "When are you usually free?" in type.label, 700, color.text, 8px over the grid.
    Rows 6px apart: a 72px label column, then three boxes sharing the rest of the row, 6px apart. Column heads in type.caption, 600, color.text.muted, centred;
      row labels in type.caption, 600, color.text.secondary.
    Each box size.hit tall with radius.md: unticked color.surface with a border.control color.field border; ticked color.ink with a white check.
    A refusal under the grid in type.small, 700, color.danger.
  copy
    prefs.availability        "When are you usually free?"   da "Hvornår har du typisk tid?"
    prefs.grid.weekdays       "Weekdays"   da "Hverdage"
    prefs.grid.saturday       "Saturday"   da "Lørdag"
    prefs.grid.sunday         "Sunday"     da "Søndag"
    prefs.grid.daytime        "Daytime"    da "Dag"
    prefs.grid.evening        "Evening"    da "Aften"
    availability.weekdayDay       "Weekdays, daytime"    da "Hverdage, dag"
    availability.weekdayEvening   "Weekdays, evening"    da "Hverdage, aften"
    availability.saturdayDay      "Saturday, daytime"    da "Lørdag, dag"
    availability.saturdayEvening  "Saturday, evening"    da "Lørdag, aften"
    availability.sundayDay        "Sunday, daytime"      da "Søndag, dag"
    availability.sundayEvening    "Sunday, evening"      da "Søndag, aften"
    prefs.pickAvailability    "Pick at least one time."   da "Vælg mindst ét tidspunkt."
  binds
    route    "/settings/preferences" (the free-times grid on Pod preferences)
    props    value: integer (the six slots, see PodPreferenceRules), onChange(value: integer)
    role     six checkboxes named by their slots
    events   a box flips its slot on or off
  uses PodPreferenceRules
  sources
    Code: "apps/mobile/src/features/profile/AvailabilityGrid.tsx", "packages/core/src/types/domain.ts" (the six slots), "apps/mobile/src/i18n/en/onboarding.json", "apps/mobile/src/i18n/da/onboarding.json"
    Design: DESIGN A9, §6.1; "apps/mobile/preview/screens.json" onb-prefs
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
