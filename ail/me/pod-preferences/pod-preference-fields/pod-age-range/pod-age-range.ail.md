# Ages

The ages card of the preference fields: the chosen range as a number and a
two-thumb slider from 18 to 99 that never lets the range get narrower than
five years.

```ail
node PodAgeRange : view   level: experience
  why   Pods match people of similar ages, and everyone in a pod fits everyone else's range; a range
        narrower than five years would rarely find a pod (DESIGN §3.1 step 9, §4.3).   <- PodPreferenceFields
  what
    Scenario: The saved range
      Given a member this week, whose ages are 28–42
      When Pod preferences opens
      Then Ages reads 28–42, with Youngest age and Oldest age sliders
      And Starts around your own age. Everyone in a pod fits everyone else's range.

    Scenario: The youngest age stops five years below the oldest
      Given a member this week, on Pod preferences
      When they drag Youngest age all the way to the right
      Then Ages reads 37–42

    Scenario: The oldest age goes up to 99
      Given a member this week, on Pod preferences
      When they drag Oldest age all the way to the right
      Then Ages reads 28–99

    Scenario: Ages in Danish
      Given a member this week whose app is in Danish, on Pod preferences
      Then it reads Alder, 28–42 and Starter omkring din egen alder. Alle i en pod passer ind i hinandens aldersinterval.

  how
    decide the thumbs stop five years apart, so a range narrower than that cannot be chosen; its message exists for a range that arrives too narrow
      because the age range is at least 5 years wide (DESIGN §4.3; PodPreferenceRules)
    decide the track is not even: 18–50 takes the first 70 %, 50–70 the next 20 %, 70–99 the rest; every whole year stays reachable
      because most pods are in the twenties to forties, and it puts 28–42 where onb-prefs draws it ("apps/mobile/src/features/profile/AgeRangeSlider.tsx")
    decide each thumb is its own control for screen readers, one year per step, with a hit area of size.hit
      because the slider must work without dragging ("apps/mobile/src/features/profile/AgeRangeSlider.tsx")
    decide the hint keeps the app's wording, "Starts around your own age"
      because the alpha profile widens the default to ±13 ("apps/mobile/preview/screens.json", onb-prefs)
  look
    A white card (color.surface, border.hairline color.border, radius.card), 14px top and bottom and space.card at the sides, parts 10px apart.
    Top row: "Ages" in type.label, 700, color.text at the left; "28–42" in type.card.title, 800, color.text at the right.
    The slider, 28px tall: a 4px color.track track with radius.track across the card, the chosen part color.primary; two 28px white thumbs (color.surface) with a border.strong color.primary ring,
      overhanging the track's ends. Under it the hint in type.caption, color.text.muted; a refusal in type.small, 700, color.danger.
  copy
    prefs.ages               "Ages"                  da "Alder"
    prefs.agesValue          "Ages {{min}} to {{max}}"   da "Alder {{min}} til {{max}}"
    prefs.youngest           "Youngest age"          da "Yngste alder"
    prefs.oldest             "Oldest age"            da "Ældste alder"
    prefs.agesHint           "Starts around your own age. Everyone in a pod fits everyone else's range."   da "Starter omkring din egen alder. Alle i en pod passer ind i hinandens aldersinterval."
    prefs.ageRangeTooNarrow  "The age range must span at least 5 years."   da "Aldersintervallet skal dække mindst 5 år."
  binds
    props    youngest: integer, oldest: integer, onChange(youngest: integer, oldest: integer)
    role     two sliders named "Youngest age" and "Oldest age", from 18 to 99; the number reads aloud as "Ages 28 to 42"
    events   dragging a thumb moves it in whole years, never below 18 or above 99, and never closer than 5 years to the other thumb
  uses PodPreferenceRules
  sources
    Code: "apps/mobile/src/features/profile/AgeRangeSlider.tsx", "apps/mobile/src/features/profile/PreferencesForm.tsx", "apps/mobile/src/i18n/en/onboarding.json"
    Design: DESIGN §3.1 step 9, §4.3; "apps/mobile/preview/screens.json" onb-prefs
    Screens: driven in the web preview on 27 November 2026, world this-week, dragging with the mouse, in English and Danish
```
