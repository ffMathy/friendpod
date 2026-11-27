# Privacy: your data and matching

The second card on Privacy: pause matching, download my data (the data export, a node of its own), blocked people
and how matching works.

```ail
node PrivacyDataAndMatching : flow   level: experience
  why   A member can stop being matched at once, get their data, see whom they blocked and read how matching
        decides, as the rights to restriction, access and transparency ask (PRIVACY §6, DESIGN §11).   <- PrivacyAndData
  what
    Scenario: Pausing matching says from which week
      Given a member in privacy settings, on Tuesday 10 November 2026, in week 46
      When they press Pause matching, which reads Skip drops until you come back
      Then its line reads Applies from week 2026-W46

    Scenario: Blocked people counts whom the member blocked
      Given a member in privacy settings, who blocked 1 person
      When Privacy opens
      Then Blocked people reads 1 person

    Scenario: Nobody blocked
      Given a member without private-interest consent, who blocked nobody
      When Privacy opens
      Then Blocked people reads Nobody

    Scenario: Blocked people opens the list
      Given a member in privacy settings, on Privacy
      When they press Blocked people
      Then the list of blocked people opens, with Rasmus

    Scenario: How matching works opens its page
      Given a member in privacy settings, on Privacy
      When they press How matching works
      Then the page How matching works opens, with What we use

    Scenario: Your data and matching in Danish
      Given a member in privacy settings whose app is in Danish
      When Privacy opens
      Then it reads Sæt matchning på pause with Spring drops over, indtil du vender tilbage, Blokerede personer with 1 person, and Sådan matcher vi
      When they press Sæt matchning på pause
      Then its line reads Gælder fra uge 2026-W46

    Pause matching acts at once, without asking first; a second press while it is being sent does nothing.
    A member who is already paused sees Paused until and the day and time it ends, or Paused when it has no end.

  how
    decide pausing takes effect at once and is not confirmed
      because pausing keeps all data and stops matching and notifications immediately, the right to restriction (PRIVACY §6)
    decide after a pause the line shows the week it applies from, as the server answers it, in its full form "2026-W46"
      because "unknown, confirm with the owner: the weekly drops card on Me shows only the week number (46); should Privacy show 46 too, rather than 2026-W46?"
    decide Pause matching, Download my data and How matching works carry neutral icons in the second text colour
      because only what is tapped as a link is green; these are neutral ("apps/mobile/app/settings/privacy.tsx": "neutral Ink 2 icons")
    decide Pause matching only pauses; coming back is done on Me
      because "unknown, confirm with the owner: should Privacy also offer to resume matching once paused?"
  look
    A white card (color.surface, border.hairline color.border, radius.card) headed "YOUR DATA AND MATCHING" in type.eyebrow, color.text.muted.
    Four rows: a small icon in color.text.secondary (pause, download, block, info), then the label in type.body 600 color.text over its line in type.caption, color.text.muted;
      Blocked people and How matching works are links, the other two buttons; rows are split by border.hairline color.separator lines.
  copy
    privacy.yourData            "Your data and matching"                    da "Dine data og matchning"
    privacy.pause               "Pause matching"                            da "Sæt matchning på pause"
    privacy.pauseDetail         "Skip drops until you come back"            da "Spring drops over, indtil du vender tilbage"
    privacy.pausedUntil         "Paused until {{when}}"                     da "På pause indtil {{when}}"
    privacy.paused              "Paused"                                    da "På pause"
    me.effectiveFrom            "Applies from week {{week}}"                da "Gælder fra uge {{week}}"
    privacy.blocked             "Blocked people"                            da "Blokerede personer"
    privacy.blockedCount_one    "{{count}} person"                          da "{{count}} person"
    privacy.blockedCount_other  "{{count}} people"                          da "{{count}} personer"
    privacy.blockedNone         "Nobody"                                    da "Ingen"
    info.howMatchingWorks.title "How matching works"                        da "Sådan matcher vi"
  binds
    events   Pause matching sets participation to pause, with no end; its line then reads the week the answer gives
    shows    the pause line: the week from the last answer, else Paused until the end of the pause, else Paused while the account is paused, else Skip drops until you come back
    events   Blocked people opens the blocked people route; How matching works opens the how matching works page
  uses DataExport
  sources
    Code: "apps/mobile/app/settings/privacy.tsx", "apps/mobile/src/features/shell/WeeklyDropsCard.tsx" (the week number on Me), "functions/src/lib/participation.ts"
    Design: PRIVACY §6 (restriction: pause); DESIGN §3.2, §11
    Screens: driven in the web preview, worlds privacy-settings and this-week-no-consent (10 November 2026 12:00), in English and Danish, on 27 November 2026; no world starts paused
```
