# Me: weekly drops

"Weekly drops" on Me: whether the member is in the next drop, their standing
choice (every week, or only when they opt in), and the one-off actions: skip
this week or join it, and pause matching or resume it.

```ail
node MeWeeklyDrops : view   level: experience
  why   Members take part every week by default, and can step out for a week, opt in week by week,
        or pause, at any time (DESIGN A10, Q3, §4.1).   <- Me
  what
    Scenario: In every week
      Given a member this week, who takes part every week
      When Me opens
      Then Weekly drops says You're in this week
      And it offers Every week and When I opt in, then Skip this week and Pause matching

    Scenario: Opting in week by week leaves this week's drop
      Given a member this week, on Me
      When they choose When I opt in
      Then Weekly drops says You're not in this week's drop and Applies from week 46
      And it offers Join this week instead of Skip this week

    Scenario: Skipping a week says when it applies
      Given a member this week, on Me
      When they press Skip this week
      Then Weekly drops says Applies from week 46

    Scenario: Weekly drops in Danish
      Given a member this week whose app is in Danish, on Me
      When they choose Når jeg melder mig til
      Then Weekly drops says Du er ikke med i denne uges drop, Vær med i denne uge and Gælder fra uge 46

  how
    decide the status line says what holds for the next drop, in Home's words: in, skipping, not in, or paused (until a time when there is one)
      because Me and Home must agree ("apps/mobile/src/features/shell/WeeklyDropsCard.tsx", "apps/mobile/src/features/drop/participation.ts")
    decide the standing choice is two chips, Every week and When I opt in; the one-off actions sit under them with Home's labels
      because participation is every week by default (DESIGN A10, Q3), with a weekly opt-in for those who choose it (§4.1: the Monday nudge for manual participation)
    decide in the drop, the first action is Skip this week; out of it, Join this week, or Resume matching while paused; Pause matching shows unless already paused
      because pause and skip apply at once at any time, and opting in closes Thursday at 12:00 (DESIGN §4.1)
    decide an automated pause cannot be lifted here: the chips are disabled and no action shows
      because the server refuses to lift it; only the member's own pause, or one after declines or ignored proposals, can be lifted ("apps/mobile/src/features/drop/participation.ts")
    decide after a change, Applies from week N says which drop week it counts from
      because a change near the drop applies to a later week (DESIGN §4.1, §10.1)
  look
    A white card (color.surface, border.hairline color.border, radius.card, padding space.card), its parts 12px apart.
    "Weekly drops" in type.eyebrow, 800, upper case, color.text.muted; the status line: a color.text.secondary icon and the text in type.small.text, color.text.secondary.
    The two choices as size.chip pills 8px apart: selected color.ink with color.on.ink text, the other color.surface with a border.control color.border.strong border, type.chip, 700.
    The actions in one row 8px apart, sharing its width: white secondary buttons (size.button.small, radius.pill, border.control color.border.strong, type.label, 700, color.text).
    Applies from week N in type.caption, color.text.muted.
  copy
    me.participation    "Weekly drops"                   da "Ugentlige drops"
    me.modes.auto       "Every week"                     da "Hver uge"
    me.modes.manual     "When I opt in"                  da "Når jeg melder mig til"
    me.effectiveFrom    "Applies from week {{week}}"     da "Gælder fra uge {{week}}"
    home.youreIn        "You're in this week"            da "Du er med i denne uge"
    home.skipping       "You're skipping this week"      da "Du springer denne uge over"
    home.notIn          "You're not in this week's drop"   da "Du er ikke med i denne uges drop"
    home.paused         "Matching is paused"             da "Matchningen er sat på pause"
    home.pausedUntil    "Matching is paused until {{when}}"   da "Matchningen er sat på pause indtil {{when}}"
    home.skip           "Skip this week"                 da "Spring ugen over"
    home.join           "Join this week"                 da "Vær med i denne uge"
    home.resume         "Resume matching"                da "Start matchningen igen"
    home.pause          "Pause matching"                 da "Sæt på pause"
  binds
    props    the member's status and participation (mode every week or when I opt in, the skipped or opted-in week, paused until, why paused)
    role     the choices are radios named Every week and When I opt in
    events   a choice, Skip this week, Join this week, Resume matching and Pause matching each send the participation change; the pressed one shows it is busy
    shows    Applies from week N with the week number the change counts from; a failure shows its error under the card
  sources
    Code: "apps/mobile/src/features/shell/WeeklyDropsCard.tsx", "apps/mobile/src/features/drop/participation.ts", "functions/src/callables/setParticipation.ts"
    Design: DESIGN A10, Q3, §4.1, §10.1; "apps/mobile/preview/screens.json" app-me
    Screens: driven in the web preview on 27 November 2026, world this-week (Tuesday of week 46), in English and Danish
```
