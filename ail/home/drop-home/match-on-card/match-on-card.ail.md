# What we'll match on

The card on Home before the drop that shows what the next drop will use: the member's ordinary interests as
coloured chips, then their area, distance, age range and meetup languages.

```ail
node MatchOnCard : view   level: experience
  why   A member should see what the drop will match them on, and fix it before
        Thursday (DESIGN §3.2), without a private interest ever showing on the first
        screen of the app (PRIVACY §4.3: a private interest is only ever a pod's theme). <- DropHome
  what
    The chips are the member's ordinary interests, at most 8, each in the colour of its word; more than 8 add a +N badge.
    Private interests are never among them. With no interests at all, the card says so instead.
    The line under the chips is the area, about N km, ages N–N and the meetup languages, joined by " · ".
    Edit opens the Interests tab.

    Scenario: The card before the drop
      Given a member this week with the interests brætspil, sourdough, far på barsel and trail running, the private interest gravid,
        Aarhus C, about 10 km, ages 28–42 and the meetup languages Danish and English
      When Home opens
      Then What we'll match on shows brætspil, sourdough, far på barsel and trail running
      And gravid is not shown
      And it reads Aarhus C · about 10 km · ages 28–42 · Danish, English

    Scenario: Edit opens the interests
      Given a member this week, on Home
      When they press Edit on What we'll match on
      Then the Interests tab opens

    Scenario: The card in Danish
      Given a member this week whose app is in Danish
      When Home opens
      Then it reads Det matcher vi på and Ret
      And Aarhus C · ca. 10 km · 28–42 år · Dansk, Engelsk

  how
    decide private interests are left out of this card
      because they are only ever a pod's theme, and this card is on the first screen of the app ("apps/mobile/src/features/drop/MatchOnCard.tsx"; PRIVACY §4.3)
    decide each chip takes the colour of its word, the same colour everywhere the word appears
      because the same word always gets the same colour (pull request 6)
    decide the meetup languages read Danish, English in English and Dansk, Engelsk in Danish, never their own names
      because endonyms belong only to the language switch ("apps/mobile/src/features/drop/MatchOnCard.tsx")
    decide at most 8 chips, the rest counted
      because "unknown, confirm with the owner: why 8?" (MAX_TAGS in "apps/mobile/src/features/drop/MatchOnCard.tsx" gives no reason)
  look
    A white card (color.surface, radius.card, border.hairline color.border, padding space.card), its blocks 10px apart.
    Title row: "What we'll match on" in type.heading, 700, color.text; at its right "Edit" in type.small.text, 700, underlined, color.link.
    The chips: pod chips size.tag tall with radius.pill, each tinted in its word's pod colour (pod.*.tint) with a size.dot dot in its base colour, the word in type.chip, color.text; 8px apart, wrapping.
    The summary in type.caption, line height 18px, color.text.muted.
  copy
    home.matchOn          "What we'll match on"                              da "Det matcher vi på"
    home.edit             "Edit"                                             da "Ret"
    home.moreTags         "+{{count}}"                                       da "+{{count}}"
    home.noInterests      "Add a few interests so we can find your pod."    da "Tilføj et par interesser, så vi kan finde din pod."
    home.aboutKm          "about {{km}} km"                                  da "ca. {{km}} km"
    home.ages             "ages {{min}}–{{max}}"                             da "{{min}}–{{max}} år"
    home.language.da      "Danish"                                           da "Dansk"
    home.language.en      "English"                                          da "Engelsk"
  binds
    props    interests: list of the member's ordinary interests or nothing while loading, prefs: the member's preferences, areaLabel: text
    role     the title is a header; Edit is a link
    events   Edit opens "/interests"
  sources
    Code: "apps/mobile/src/features/drop/MatchOnCard.tsx", "apps/mobile/src/lib/podColor.ts", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2; PRIVACY §4.3; pull request 6 (colour from the word)
    Storyboard: drop-home ("apps/mobile/preview/screens.json": the private "gravid" must not appear in What we'll match on)
    Screens: driven in the web preview, world this-week, in English and Danish, on 27 November 2026
```
