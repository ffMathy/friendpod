# Private interests card

The quiet card under the list for a member who has agreed to private
interests and holds at least one: each private interest with the day the
consent was given, Remove & withdraw, and the way back to an ordinary interest.

```ail
node PrivateInterestsCard : flow   level: experience
  why   A private interest is only used to form pods about it, and withdrawing it must be as easy as
        giving it, one tap from the interest itself (PRIVACY §3.5, DESIGN F18).                 <- Interests
  what
    The card shows only while the member holds a private interest; without one, and with the consent given, there is no card.
    Each private interest shows a lock, the interest in the member's own words and Consent given with the day, and Remove & withdraw.
    Remove & withdraw deletes that interest at once and withdraws the consent for it alone; the consent to private interests stays.
    This isn't sensitive for me makes the interest ordinary for this member only: it moves to the list, keeping Keep this private at hand,
      and the tab says Done. We now treat this as an ordinary interest, for you only. The web preview cannot play this: its server adds the text again as a new ordinary interest.
    With one private interest the link closes the card, after the note; with several, each interest has its own under its Remove & withdraw.

    Scenario: The private interest is shown quietly
      Given a member this week whose private interest is gravid, with consent given on 4 November 2026
      When the Interests tab opens
      Then the card Private interests shows gravid and Consent given 4 Nov 2026
      And it offers Remove gravid and withdraw consent for it, and This isn't sensitive for me
      And it says Only used to form pods about this interest. Never on a profile, never in a notification.

    Scenario: Remove and withdraw takes the private interest away
      Given a member this week with 5 interests, one of them the private interest gravid
      When they press Remove & withdraw
      Then gravid and the Private interests card are gone, and the count reads 4 of 20
      And How private interests work is still there

    Scenario: The private card in Danish
      Given a member this week whose app is in Danish
      When the Interests tab opens
      Then the card Private interesser shows gravid, Du sagde ja 4. nov. 2026, Fjern og tilbagekald and Den er ikke følsom for mig

  how
    decide removing a private interest withdraws the consent for it, from the card itself, and leaves the consent to private interests in place
      because withdrawal must be as easy as giving consent: "Remove" on each sensitive interest, for that holding only, and no consent event changes (PRIVACY §3.5)
    decide Remove & withdraw acts at once, with no confirmation
      because "unknown, confirm with the owner: Remove & withdraw deletes the private interest without asking; PRIVACY §3.5 gives confirmation copy only for withdrawing every private interest at once. Is that intended?"
    decide This isn't sensitive for me is offered on every private interest, as a quiet link under the danger button
      because the user may downgrade a flag for their own holding (DESIGN §5.2 (5) row 4, D2), and the link never fits beside the danger button at 390 px ("apps/mobile/src/features/interests/InterestManager.tsx")
    decide no colour, a lock and an ink border; a star only on a private interest already starred
      because private items stay quiet (pull request 5), and the design shows no star on private holdings (InterestManager.tsx)
    decide the card shows the day the consent was given, in Copenhagen time
      because each private interest rests on the consent given that day (PRIVACY §3.4; "apps/mobile/src/features/interests/parts.tsx")
  look
    A white (color.private.bg) card with a border.control color.private.border border and radius.card, space.card padding, rows 10px apart.
    Its eyebrow: a 14px lock and "PRIVATE INTERESTS" in type.eyebrow, 800, upper case, color.private.fill.
    Each interest: a 16px lock and the interest in type.body, 600, color.text; "Consent given 4 Nov 2026" under it in type.micro, color.text.muted;
      then Remove & withdraw: a size.hit pill (radius.pill, color.surface, a border.control color.danger border) with a 16px trash and type.chip, 700, color.danger.
    The note in type.caption, color.text.muted; "This isn't sensitive for me" as an underlined type.caption, 700, color.text.muted link, last in the card.
  copy
    interests.privateTitle         "Private interests"                                  da "Private interesser"
    interests.consentGiven         "Consent given {{date}}"                             da "Du sagde ja {{date}}"
    interests.removeWithdraw       "Remove & withdraw"                                  da "Fjern og tilbagekald"
    interests.removeWithdrawNamed  "Remove {{name}} and withdraw consent for it"        da "Fjern {{name}} og træk dit samtykke til den tilbage"
    interests.privateExplainer     "Only used to form pods about this interest. Never on a profile, never in a notification."   da "Bruges kun til at danne pods om netop den interesse. Aldrig på en profil, aldrig i en notifikation."
    interests.notSensitiveForMe    "This isn't sensitive for me"                        da "Den er ikke følsom for mig"
    interests.madeOrdinary         "Done. We now treat this as an ordinary interest, for you only."   da "Sådan. Vi behandler den nu som en almindelig interesse, kun for dig."
    interests.privateLabel         "{{name}}, private"                                  da "{{name}}, privat"
  binds
    route    "/interests" (the private card under the list on the Interests tab)
    shows    the day as "4 Nov 2026" in English and "4. nov. 2026" in Danish, in Copenhagen time
    events   Remove & withdraw deletes the private interest; This isn't sensitive for me sends it again as not sensitive for this member
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (the private card and its rows), "apps/mobile/src/features/interests/parts.tsx" (the day format, the eyebrow), "apps/mobile/preview/runtime/callables.ts"
    Design: DESIGN F18, §5.2 (5), D2; PRIVACY §3.4, §3.5, §4.3
    Screens: priv-interests ("apps/mobile/preview/screens.json"); driven in the web preview, world this-week, in English and Danish, on 27 November 2026
    Pull request: "https://github.com/ffMathy/friendpod/pull/5" (private items stay quiet)
```
