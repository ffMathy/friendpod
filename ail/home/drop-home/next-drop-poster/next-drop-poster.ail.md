# Next drop poster

The top of Home before the drop: the house poster field with "Next drop" and the drop's day and time, its
white foot with the countdown and whether the member is in, and the skip or pause buttons under it.

```ail
node NextDropPoster : view   level: experience
  why   The Thursday drop is one of the three ritual moments that get a poster field
        (pull request 5), and pausing or skipping must be at hand and take effect at once
        (DESIGN §3.2, §10.1).                                                          <- DropHome
  what
    The next drop is the coming Thursday 18:00 in Copenhagen; from Thursday 18:00 on it is the Thursday after.
    The countdown is rounded up to the minute: in N days and N hours, in N hours and N minutes, in N minutes, and once due any minute now.
    The status under it, and the buttons under the foot, follow whether the member is in the next drop:
      in: You're in this week, with Skip this week and Pause matching;
      skipping this drop: You're skipping this week, with Join this week and Pause matching;
      on opt-in matching and not opted in: You're not in this week's drop, with Join this week and Pause matching;
      paused by themselves or after declines: Matching is paused, or paused until a date, with Resume matching only;
      paused by Friendpod in a way they may not lift, or suspended: the status, and no buttons.
    Skip, pause, join and resume are applied at once. An opt-in after Thursday 12:00 adds This week's sign-up closed
    Thursday at 12:00, so you're in from week N. under the buttons. A failure shows its message there.

    Scenario: The next drop on Tuesday
      Given a member this week, on Tuesday 10 November 2026 at 12:00, in the next drop
      When Home opens
      Then the poster reads This week, Week 46, Next drop and Thursday 18:00
      And its foot reads in 2 days and 6 hours and You're in this week
      And Skip this week and Pause matching are under it

    Scenario: Right after the drop the next one is a week away
      Given a member with a pod proposal, on Thursday 12 November 2026 at 18:30
      When they decline the proposal on Home: Not this time, the reason Too far, then Decline this pod
      Then the poster reads Next drop Thursday 18:00 and in 6 days and 23 hours

  how
    decide the poster runs full-bleed from the top edge on the house colour, with the pod mark and a seat saved for the member
      because the Thursday drop is a poster moment of the Blend identity (pull request 5) and the storyboard drop-home draws it so ("apps/mobile/src/features/drop/NextDropCard.tsx")
    decide a pause the member may not lift shows no buttons
      because "an automated pause the user may not lift shows nothing here" ("apps/mobile/src/features/drop/NextDropCard.tsx"); which pauses a member may lift follows the server (its own pause, or one after declines or ignored proposals)
    decide every smaller text sits on the white foot, never on the green field
      because small text never sits on a mid-tone colour field ("apps/mobile/src/components/theme.ts")
  look
    The field: color.house from the top edge, padding space.gutter.compact; on it "This week" in font.display, type.title, 800, color.on.house, and at its right
      a size.badge "Week 46" pill (color.field.pill, color.on.field.pill text, type.caption, 700, radius.pill).
    18px under it "Next drop" (font.display, type.headline, 700, color.on.house) over "Thursday 18:00" in font.display, type.display.xl48, 800, color.on.house,
      smaller only when it would not fit; at the right a 128px pod mark: people around a color.needs.you sun, one seat dashed.
    The foot: a white (color.surface) card overlapping the field's bottom, radius.card; the countdown in type.heading, 700, color.text over a 16px tick
      (or pause or info icon) and the status in type.small.text, color.text.secondary; a chevron in color.text.muted at the right.
    The buttons: two equal white secondary pills (size.button.compact, radius.pill, border.control color.border.strong, type.label, 700, color.text), 8px apart.
  copy
    home.title         "This week"                         da "Denne uge"
    home.week          "Week {{week}}"                     da "Uge {{week}}"
    home.nextDrop      "Next drop"                         da "Næste drop"
    home.dropAt        "{{day}} {{time}}"                  da "{{day}} kl. {{time}}"
    home.dropLinkHint  "Shows how the weekly drop works"   da "Viser, hvordan det ugentlige drop fungerer"
    home.countdown.in  "in {{span}}"                       da "om {{span}}"
    home.countdown.and "{{a}} and {{b}}"                   da "{{a}} og {{b}}"
    home.countdown.days_one       "{{count}} day"       da "{{count}} dag"
    home.countdown.days_other     "{{count}} days"      da "{{count}} dage"
    home.countdown.hours_one      "{{count}} hour"      da "{{count}} time"
    home.countdown.hours_other    "{{count}} hours"     da "{{count}} timer"
    home.countdown.minutes_one    "{{count}} minute"    da "{{count}} minut"
    home.countdown.minutes_other  "{{count}} minutes"   da "{{count}} minutter"
    home.countdown.soon "any minute now"                   da "når som helst nu"
    home.youreIn       "You're in this week"               da "Du er med i denne uge"
    home.skipping      "You're skipping this week"         da "Du springer denne uge over"
    home.notIn         "You're not in this week's drop"    da "Du er ikke med i denne uges drop"
    home.paused        "Matching is paused"                da "Matchningen er sat på pause"
    home.pausedUntil   "Matching is paused until {{when}}" da "Matchningen er sat på pause indtil {{when}}"
    home.skip          "Skip this week"                    da "Spring ugen over"
    home.pause         "Pause matching"                    da "Sæt på pause"
    home.join          "Join this week"                    da "Vær med i denne uge"
    home.resume        "Resume matching"                   da "Start matchningen igen"
    home.fromWeek      "This week's sign-up closed Thursday at 12:00, so you're in from week {{week}}."   da "Tilmeldingen til denne uge lukkede torsdag kl. 12, så du er med fra uge {{week}}."
  binds
    route    "/" (the top of Home, before the drop)
    role     the title is a header; the field and foot are one link named "Next drop, the day and time, the countdown, the status", with the hint home.dropLinkHint
    events   the link opens "/info/how-matching-works"; Skip this week asks the server for mode "skipNext", Pause matching for "pause", Join and Resume for the member's own mode
  sources
    Code: "apps/mobile/src/features/drop/NextDropCard.tsx", "apps/mobile/src/features/drop/participation.ts", "apps/mobile/src/features/drop/time.ts", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2 (pausing or skipping takes effect immediately), §4.1, §10.1; pull request 5 (poster moments)
    Screens: driven in the web preview, worlds this-week and drop-proposal, on 27 November 2026. The preview's server does not model skip or pause, so the states other than in were read from the code
```
