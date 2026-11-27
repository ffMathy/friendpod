# Pod preferences: rules

Which pod preferences the app and the server accept: the age range, the
distance steps, the meetup languages and the free times. Today they are the
zod schema `prefsSchema` in `packages/core/src/schemas/profile.ts` (and
`radiusKmSchema`, `languagesSchema`, `availabilitySchema` in
`schemas/common.ts`), which the preferences form and `updateProfile` both
parse with; once built, that schema is made from these.

```ail
node PodPreferenceRules : fn   level: system
  why   The phone refuses what the server would refuse, before anything is sent, and one rule for
        both cannot drift (DESIGN A7, §4.3).                                   <- PodPreferenceFields
  what
    MAX_AGE: integer = 99
    MIN_AGE_RANGE_WIDTH: integer = 5
    RADII_KM: list of integer = [5, 10, 15, 25]
    AVAILABILITY_ALL: integer = 63

    type Preferences = { ageMin: integer, ageMax: integer, maxKm: integer, languages: list of "da" | "en", availability: integer, sameGenderOnly: boolean, openToAnyone: boolean }

    isAgeRangeWideEnough(ageMin: integer, ageMax: integer) -> boolean — ageMax − ageMin ≥ MIN_AGE_RANGE_WIDTH

    arePreferencesValid(preferences: Preferences) -> boolean
      True when ageMin and ageMax are whole numbers from MIN_AGE (AboutYouRules) to MAX_AGE and isAgeRangeWideEnough(ageMin, ageMax);
      maxKm is one of RADII_KM; languages has one or two entries, no entry twice; and availability is a whole number from 1 to AVAILABILITY_ALL
      (six bits: weekdays daytime 1, weekdays evening 2, Saturday daytime 4, Saturday evening 8, Sunday daytime 16, Sunday evening 32).

    examples
      isAgeRangeWideEnough(28, 42) => true
      isAgeRangeWideEnough(28, 33) => true
      isAgeRangeWideEnough(28, 32) => false
      isAgeRangeWideEnough(42, 28) => false
      arePreferencesValid({ ageMin: 28, ageMax: 42, maxKm: 10, languages: ["da", "en"], availability: 22, sameGenderOnly: false, openToAnyone: false }) => true
      arePreferencesValid({ ageMin: 18, ageMax: 23, maxKm: 5, languages: ["en"], availability: 1, sameGenderOnly: false, openToAnyone: true }) => true
      arePreferencesValid({ ageMin: 94, ageMax: 99, maxKm: 25, languages: ["da"], availability: 63, sameGenderOnly: true, openToAnyone: false }) => true
      arePreferencesValid({ ageMin: 28, ageMax: 32, maxKm: 10, languages: ["da", "en"], availability: 22, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 17, ageMax: 30, maxKm: 10, languages: ["da", "en"], availability: 22, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 95, ageMax: 100, maxKm: 10, languages: ["da", "en"], availability: 22, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 28, ageMax: 42, maxKm: 20, languages: ["da", "en"], availability: 22, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 28, ageMax: 42, maxKm: 10, languages: [], availability: 22, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 28, ageMax: 42, maxKm: 10, languages: ["en", "en"], availability: 22, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 28, ageMax: 42, maxKm: 10, languages: ["da", "en"], availability: 0, sameGenderOnly: false, openToAnyone: false }) => false
      arePreferencesValid({ ageMin: 28, ageMax: 42, maxKm: 10, languages: ["da", "en"], availability: 64, sameGenderOnly: false, openToAnyone: false }) => false

  how
    decide the age range is at least 5 years wide, from 18 to 99
      because the minimum width is a product rule (DESIGN §3.1 step 9, §4.3: "min 18; width ≥ 5 years")
    decide the distance is one of 5, 10, 15 or 25 km
      because geohash-5 cells span up to 5.6 km, so finer steps would promise more than the matcher can keep (DESIGN A12, §4.3)
    decide the free times are six slots: weekdays, Saturday and Sunday, each daytime or evening, and at least one is chosen
      because a pod needs a slot every member shares (DESIGN A9, §6.1)
    decide the narrow age range is reported on the upper age
      because the form shows the message under the ages card ("packages/core/src/schemas/profile.ts")
  free [ helper names ]
  uses AboutYouRules
  sources
    Code: "packages/core/src/schemas/profile.ts" (MAX_AGE, MIN_AGE_RANGE_WIDTH, prefsSchema), "packages/core/src/schemas/common.ts" (radius, languages, availability),
          "packages/core/src/types/domain.ts" (RADII_KM, LANGUAGES, AVAILABILITY), "apps/mobile/src/features/profile/PreferencesForm.tsx"
    Examples: run on 27 November 2026 against "prefsSchema.safeParse" (isAgeRangeWideEnough through its age-range refinement, the other fields valid)
    Design: DESIGN §3.1 step 9, §4.3, A9, A12
```
