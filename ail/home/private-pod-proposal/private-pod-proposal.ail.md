# A proposal about a private interest

Home when the drop proposes a pod about one of the member's private interests (storyboard priv-sensitive): a
quiet card that shows less on purpose.

```ail
node PrivatePodProposal : flow   level: experience
  why   Before a pod is confirmed, invitees are not members, and some will say no; a card
        about a private interest must not let them work out who holds it (DESIGN §3.2
        "Sensitive themes"; PRIVACY §4.3 "Before confirmation").                    <- Home
  what
    It answers like any proposal: I'm in, and Not this time with its optional reason.
    While a proposal about a private interest is on Home, the phone may not take screenshots of it.

    Scenario: A private proposal shows less
      Given a member with a private pod proposal: gravid, 5 people near Aarhus C, answer by Saturday 28 November 18:00
      When Home opens on Thursday 26 November 2026 at 18:30
      Then it reads Your weekly drop and Week 48
      And the card reads Private interest, Answer by Sat 18:00, A pod around and gravid
      And 5 people and Near Aarhus C
      And Everyone invited added this interest themselves and gave consent. We show less here on purpose, so that people who say no can't work out who you are.
      And Once the pod is confirmed, members see first names. Your photo stays hidden unless you choose to show it in this pod.
      And Not this time and I'm in, with How private interests are protected under the card
      And there is no New pod, no seats, no ages, no distance, no shared interests and no Why this pod?

    Scenario: How private interests are protected
      Given a member with a private pod proposal, on Home
      When they press How private interests are protected
      Then the Private interests page opens, with What counts as private

    Scenario: A private proposal in Danish
      Given a member with a private pod proposal whose app is in Danish
      When Home opens
      Then it reads Ugens drop, Uge 48, Privat interesse, Svar senest lør. kl. 18.00, En pod om, gravid, 5 personer and Tæt på Aarhus C
      And Ikke nu, Jeg er med and Sådan beskytter vi private interesser

  how
    decide no age span, no shared interests, no distance and no seats on the card
      because together they could narrow down who the local holders are (DESIGN §3.2; "apps/mobile/preview/scenarios/drop-private.ts": no age span, no shared interests by schema)
    decide the card stays quiet: white with an ink border, the private chip with a lock, the name in ink, no colour anywhere
      because private items stay quiet (pull request 5, blend decision 1)
    decide a link to how private interests are protected instead of Why this pod?
      because "unknown, confirm with the owner: why does a private proposal not offer Why this pod?" ("apps/mobile/src/features/pods/ProposalCard.tsx" shows one link or the other)
    decide screenshots are blocked while it shows
      because screen capture can be blocked on sensitive-themed pod screens (PRIVACY §4.3 "Copying"; "apps/mobile/src/features/pods/ScreenCaptureGuard.tsx")
  look
    As the proposal card, with no tint: white (color.private.bg) with a border.control color.private.border border, radius.hero.
    In its top: the "Private interest" chip (white, border.control color.private.border, a lock, type.caption, 700, color.ink) above the needs-you pill;
      "A pod around" over "gravid" in font.display, type.title, 800, color.ink, and the pod mark with a lock in ink at its right; a color.separator line under it.
    Two fact lines with color.text.secondary icons; the note on color.inset with a shield, its two paragraphs in type.caption, color.text.secondary, 8px apart.
    "How private interests are protected" centred under the card, underlined, bold, color.link.
  copy
    pods.privateInterest "Private interest"     da "Privat interesse"
    pods.privateNote     "Everyone invited added this interest themselves and gave consent. We show less here on purpose, so that people who say no can't work out who you are."   da "Alle inviterede har selv tilføjet interessen og givet samtykke. Vi viser med vilje mindre her, så dem, der siger nej tak, ikke kan regne ud, hvem du er."
    pods.privateReveal   "Once the pod is confirmed, members see first names. Your photo stays hidden unless you choose to show it in this pod."   da "Når poden er bekræftet, kan medlemmerne se hinandens fornavne. Dit billede forbliver skjult, medmindre du selv vælger at vise det i denne pod."
    pods.privateHow      "How private interests are protected"   da "Sådan beskytter vi private interesser"
  binds
    route    "/" (Home, with a proposal about a private interest)
    events   How private interests are protected opens "/info/sensitive-interests"
    platform screen capture is prevented while any proposal on Home is about a private interest
  uses DropProposal, ProposalDecline
  sources
    Code: "apps/mobile/src/features/pods/ProposalCard.tsx", "apps/mobile/src/features/pods/ScreenCaptureGuard.tsx", "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2; PRIVACY §4.3; pull request 5
    Storyboard: priv-sensitive ("apps/mobile/preview/screens.json": week 48, no age span, no shared interests by schema)
    Screens: driven in the web preview, world drop-private, in English and Danish, on 27 November 2026
```
