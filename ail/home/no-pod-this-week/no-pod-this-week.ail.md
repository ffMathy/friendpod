# No pod this week

Home when the drop left the member without a pod (storyboards drop-none and app-home-none-setting): the
reason, whether they get priority next week, and things that often help.

```ail
node NoPodThisWeek : flow   level: experience
  why   A member who gets no pod is told why, in a calm card, with a tip; when a setting
        of theirs keeps them out, the reason names it (DESIGN §3.2, §6.7).          <- Home
  what
    It stands from the drop that left the member out until the end of that week, with the next drop under the card.
    The text is the reason the drop sent, or We couldn't fit you into a pod this time. when it sent none.
    You'll get priority next week. shows for the reasons that keep the member in the pool: every reason except
      a full pod count, too few interests, a city on the waitlist and an area Friendpod is not in.
    The tips show for every reason except a full pod count, a city on the waitlist and an area Friendpod is not in, in this order:
      a reason that names a setting leads with its own tip (for distance, the next distance, Try about N km);
      then Add a few more interests; then Try about N km with the next distance up, when there is one;
      then the Open to meeting anyone switch. With too few interests, only Add a few more interests shows.
    The switch is changed at once and changes back if saving fails; a failure shows its message under it.

    Scenario: No pod this week
      Given a member with no pod this week, because not enough people shared an interest, with a distance of 10 km, on Thursday 12 November 2026 at 18:30
      When Home opens
      Then it reads This week, Week 46 and No pod for you this week
      And Not enough people near you shared one of your interests and fit everyone's settings this time.
      And You'll get priority next week.
      And Things that often help with Add a few more interests, then Try about 15 km
      And the switch Open to meeting anyone, A pod without a shared theme
      And Next drop: Thursday 18:00 under the card

    Scenario: The reason names the setting
      Given a member kept out by a setting: the distance of 10 km, the third week in a row
      When Home opens
      Then it reads Your distance setting leaves too few people near you to form a pod.
      And the tips are Try about 15 km, then Add a few more interests

    Scenario: A tip opens the setting
      Given a member kept out by a setting, on Home
      When they press Try about 15 km
      Then Pod preferences opens

    Scenario: A tip opens the interests
      Given a member with no pod this week, on Home
      When they press Add a few more interests
      Then the Interests tab opens

    Scenario: No pod in Danish
      Given a member kept out by a setting whose app is in Danish
      When Home opens
      Then it reads Denne uge, Ingen pod i denne uge and Med den afstand, du har valgt, er der for få i nærheden til at samle en pod.
      And Du får forrang i næste uge., Det hjælper ofte, Prøv med ca. 15 km, Tilføj et par interesser mere and Åben for at møde alle
      And Næste drop: torsdag kl. 18.00

  how
    decide the reason names a setting only when the server sends a setting's code, which it does after 3 drops with the same cause
      because "When a user has been unmatched for 3 drops with the same user-set constraint as the cause, Home names the setting" (DESIGN §6.7; "apps/mobile/src/features/drop/NoPodCard.tsx")
    decide a calm white card with the member's seat and three open seats, no colour
      because drop-none is not a poster moment ("apps/mobile/src/features/drop/NoPodCard.tsx"; pull request 5)
    decide the next drop is a quiet line, not a needs-you
      because there is nothing to do but wait ("app/(tabs)/index.tsx")
  look
    Paper page, side padding space.gutter.compact; the title row "This week" in font.display, type.title, 800 with "Week 46" in type.small.text, 600, color.text.muted.
    A white card (color.surface, radius.card, border.hairline color.border, padding space.card), blocks 12px apart: a 104px color.inset panel, radius.lg, with You (color.ink) and three dashed open seats at different heights;
      "No pod for you this week" in font.display, type.headline, 700; the reason in type.body.small, color.text.secondary; a tick and "You'll get priority next week." in type.caption, 700, color.text.secondary.
    "Things that often help" in type.heading, 700, then the tips: rows at least 52px tall, type.body, 600, color.text, a color.text.muted chevron, a border.hairline color.separator line under each;
      the switch row at least 64px tall: the label in type.body, 600 over its hint in type.caption, color.text.muted, a 52×32 switch at the right.
    Under the card, centred: a 14px clock and "Next drop: Thursday 18:00" in type.caption, 600, color.text.muted.
  copy
    home.title            "This week"                                     da "Denne uge"
    home.noPodTitle       "No pod for you this week"                      da "Ingen pod i denne uge"
    home.noPodBody        "We couldn't fit you into a pod this time."     da "Vi kunne ikke finde en pod til dig denne gang."
    home.priorityNext     "You'll get priority next week."                da "Du får forrang i næste uge."
    home.helpTitle        "Things that often help"                        da "Det hjælper ofte"
    home.moreInterests    "Add a few more interests"                      da "Tilføj et par interesser mere"
    home.tryKm            "Try about {{km}} km"                           da "Prøv med ca. {{km}} km"
    home.openToAnyone     "Open to meeting anyone"                        da "Åben for at møde alle"
    home.openToAnyoneHint "A pod without a shared theme"                  da "En pod uden et fælles tema"
    home.nextDropAt       "Next drop: {{day}} {{time}}"                   da "Næste drop: {{day}} kl. {{time}}"
  binds
    route    "/" (Home, after a drop without a pod)
    props    reason: UnmatchedReason or nothing, the member's preferences
    state    openToAnyone: boolean, starting at the member's setting
    role     the tips are links; the last is a switch named home.openToAnyone
    events   a setting's tip and Try about N km open "/settings/preferences"; Add a few more interests opens "/interests"; the switch saves the open-to-anyone setting
  uses NoPodReasonTexts, DropReasons
  children NoPodReasonTexts
  sources
    Code: "apps/mobile/src/features/drop/NoPodCard.tsx", "apps/mobile/src/features/drop/parts.tsx", "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/lib/reasons.ts", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2, §6.7
    Storyboards: drop-none (reason NO_THEME_BUCKET), app-home-none-setting (reason RADIUS, the third week) in "apps/mobile/preview/screens.json"
    Screens: driven in the web preview, worlds drop-none and drop-none-setting, in English and Danish, on 27 November 2026; the switch carries no on or off state on the web, so its saving was read from the code
```
