# Drop reasons

The reason codes the drop sends to Home: why a pod was proposed (for "Why this pod" and the card's facts), and
why there was no pod. The server writes them, the app only renders them. They live in `packages/core`
(`reasons.ts`), and the app's check for a reason that names a setting in `apps/mobile/src/lib/reasons.ts`.

```ail
node DropReasons : fn   level: system
  why   A member is told why they got a pod or why they did not, in their own words only,
        never with anything about other members or another private interest (DESIGN §6.7,
        §3.2; PRIVACY §4.3).                                                          <- Home
  what
    type PodReason = { code: "THEME", yourWording: text } | { code: "ALSO_SHARE", yourWordings: list of text }
      | { code: "AREA", label: text } | { code: "NEAR_YOU", km: number } | { code: "AGE_SPAN", min: integer, max: integer }
      | { code: "PRIORITY", weeks: integer } | { code: "SOFT_THEME", yourTag: text, podTheme: text } | { code: "OPEN_TO_ANYONE" }
    type UnmatchedReason = "NO_THEME_BUCKET" | "RADIUS" | "AGE" | "GENDER" | "GENDER_POOL" | "LANGUAGE" | "AVAILABILITY"
      | "MAX_ACTIVE_PODS" | "TOO_FEW_INTERESTS" | "SENSITIVE_ELIGIBILITY" | "SENSITIVE_DENSITY" | "AREA_WAITLIST"
      | "OUTSIDE_AREAS" | "NO_FIT_THIS_WEEK"
    type CardReasonInput = { themeSensitive: boolean, openToAnyone: boolean, yourThemeWording: text or nothing,
      alsoShareWordings: list of text, areaLabel: text, nearKm: number, ageSpan: { min: integer, max: integer } or nothing,
      priorityWeeks: integer or nothing }
    ALSO_SHARE_MAX: integer = 3
    UNMATCHED_REASONS: list of UnmatchedReason = ["NO_THEME_BUCKET", "RADIUS", "AGE", "GENDER", "GENDER_POOL", "LANGUAGE",
      "AVAILABILITY", "MAX_ACTIVE_PODS", "TOO_FEW_INTERESTS", "SENSITIVE_ELIGIBILITY", "SENSITIVE_DENSITY", "AREA_WAITLIST",
      "OUTSIDE_AREAS", "NO_FIT_THIS_WEEK"]
    USER_SETTING_REASONS: list of UnmatchedReason = ["RADIUS", "AGE", "GENDER_POOL", "LANGUAGE", "AVAILABILITY"]
    SENSITIVE_UNMATCHED_REASONS: list of UnmatchedReason = ["SENSITIVE_ELIGIBILITY", "SENSITIVE_DENSITY"]

    buildCardReasons(input: CardReasonInput) -> list of PodReason
      In this order: OPEN_TO_ANYONE for an open pod, else THEME with the viewer's wording; ALSO_SHARE with the first
      ALSO_SHARE_MAX wordings, only for an ordinary theme with at least one; AREA; NEAR_YOU; AGE_SPAN, only for an
      ordinary theme with an age span; PRIORITY, only when the weeks are more than 0. A theme pod without the viewer's
      wording is refused with an error.

    isUserSettingReason(reason: UnmatchedReason or nothing) -> boolean — whether reason is in USER_SETTING_REASONS

    examples
      buildCardReasons({ themeSensitive: false, openToAnyone: false, yourThemeWording: "brætspil", alsoShareWordings: ["sourdough", "trail running"], areaLabel: "Aarhus C", nearKm: 10, ageSpan: { min: 29, max: 38 }, priorityWeeks: 2 }) => [{ code: "THEME", yourWording: "brætspil" }, { code: "ALSO_SHARE", yourWordings: ["sourdough", "trail running"] }, { code: "AREA", label: "Aarhus C" }, { code: "NEAR_YOU", km: 10 }, { code: "AGE_SPAN", min: 29, max: 38 }, { code: "PRIORITY", weeks: 2 }]
      buildCardReasons({ themeSensitive: true, openToAnyone: false, yourThemeWording: "gravid", alsoShareWordings: ["sourdough", "trail running"], areaLabel: "Aarhus C", nearKm: 10, ageSpan: { min: 29, max: 38 }, priorityWeeks: 2 }) => [{ code: "THEME", yourWording: "gravid" }, { code: "AREA", label: "Aarhus C" }, { code: "NEAR_YOU", km: 10 }, { code: "PRIORITY", weeks: 2 }]
      buildCardReasons({ themeSensitive: false, openToAnyone: true, yourThemeWording: nothing, alsoShareWordings: [], areaLabel: "Aarhus C", nearKm: 10, ageSpan: nothing, priorityWeeks: nothing }) => [{ code: "OPEN_TO_ANYONE" }, { code: "AREA", label: "Aarhus C" }, { code: "NEAR_YOU", km: 10 }]
      buildCardReasons({ themeSensitive: false, openToAnyone: false, yourThemeWording: "brætspil", alsoShareWordings: ["a", "b", "c", "d"], areaLabel: "Aarhus C", nearKm: 10, ageSpan: { min: 29, max: 38 }, priorityWeeks: 0 }) => [{ code: "THEME", yourWording: "brætspil" }, { code: "ALSO_SHARE", yourWordings: ["a", "b", "c"] }, { code: "AREA", label: "Aarhus C" }, { code: "NEAR_YOU", km: 10 }, { code: "AGE_SPAN", min: 29, max: 38 }]
      isUserSettingReason("RADIUS") => true
      isUserSettingReason("AVAILABILITY") => true
      isUserSettingReason("GENDER") => false
      isUserSettingReason("NO_THEME_BUCKET") => false
      isUserSettingReason(nothing) => false

  how
    decide THEME, ALSO_SHARE and SOFT_THEME carry only the viewer's own wording
      because no shared document may hold another member's wording or the label of a sensitive concept (DESIGN §6.7)
    decide a pod about a private interest carries no ALSO_SHARE and no AGE_SPAN
      because invitees are not members yet, and those details could narrow down the local holders (DESIGN §3.2; PRIVACY §4.3 "Before confirmation")
    decide NO_FIT_THIS_WEEK exists, beyond DESIGN's list
      because without it the matcher would have to name a wrong setting when people exist but no pod fitted (DESIGN-DEVIATION in "packages/core/src/reasons.ts")
    decide only RADIUS, AGE, GENDER_POOL, LANGUAGE and AVAILABILITY name a setting
      because they are the user-set constraints Home may name after 3 drops with the same cause (DESIGN §6.7)
  free [ helper names ]
  sources
    Code: packages/core/src/reasons.ts (PodReason, UNMATCHED_REASONS, USER_SETTING_REASONS, SENSITIVE_UNMATCHED_REASONS, buildCardReasons), apps/mobile/src/lib/reasons.ts (isUserSettingReason)
    Examples: run against the existing code on 27 November 2026 with tsx
    Design: docs/DESIGN.md §3.2, §6.7; docs/PRIVACY.md §4.3
```
