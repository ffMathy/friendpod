# The drop: a pod proposal

Home right after the drop when it brought a pod (storyboard drop-proposal): the proposal card in the pod's
colour, with I'm in, Not this time, and Why this pod?. Declining is a child, and so is the Why this pod sheet.

```ail
node DropProposal : flow   level: experience
  why   On Thursday at 18:00 the drop proposes a pod, and the member answers it from Home
        with what they need to decide, and never names, photos, gender or who has said yes
        (DESIGN §3.2, §3.3).                                                          <- Home
  what
    Home then reads Your weekly drop, with one card per open invitation, in the order of the member's pods.
    An invitation into a pod that is already planning or scheduled shows too, and says This pod is already confirmed.
    You'll see names and photos once you join. instead of when names appear.
    A pod with no shared theme reads A pod without a shared theme over Open to anyone.
    I'm in answers yes at once, and the card becomes the wait for the others. A failure shows its message in the card.

    Scenario: The proposal on Home
      Given a member with a pod proposal: brætspil, 5 people aged 29–38 within about 10 km of Aarhus C, sharing sourdough and trail running, answer by Saturday 14 November 18:00
      When Home opens on Thursday 12 November 2026 at 18:30
      Then it reads Your weekly drop and Week 46
      And the card reads New pod, Answer by Sat 18:00, A pod around and brætspil
      And the seats, with You
      And 5 people, ages 29–38, Near Aarhus C · everyone within about 10 km of you, and Some of you also share sourdough and trail running
      And Names and photos appear when 4 people have said yes.
      And Not this time and I'm in, with Why this pod? under the card
      And no member's name is shown

    Scenario: Saying yes shows the wait for the others
      Given a member with a pod proposal, on Home
      When they press I'm in
      Then the card reads You're in, 3 of 5 said yes and 4 needed
      And I'm in is gone

    Scenario: An open pod proposal
      Given a member with an open pod proposal
      When Home opens
      Then the card reads A pod without a shared theme and Open to anyone

    Scenario: The proposal in Danish
      Given a member with a pod proposal whose app is in Danish
      When Home opens
      Then it reads Ugens drop, Uge 46, Ny pod, Svar senest lør. kl. 18.00, En pod om and brætspil
      And 5 personer, 29–38 år, Tæt på Aarhus C · alle bor højst ca. 10 km fra dig, and Nogle af jer deler også sourdough og trail running
      And Navne og billeder vises, når 4 har sagt ja.
      And Ikke nu, Jeg er med and Hvorfor denne pod?

  how
    decide the card shows the theme in the member's own wording, size, area and distance, the age span, up to 3 shared interests and the deadline, and never names, photos, gender or who has said yes
      because DESIGN §3.2 lists what the card shows and never shows; the seats show only You and open seats ("apps/mobile/src/features/pods/ProposalCard.tsx")
    decide colour grows with commitment: the pod's tint band, its name in the pod's deep tone, the needs-you pill for the deadline
      because blend decision 5 (pull request 5; "apps/mobile/src/features/pods/ProposalCard.tsx")
    decide the number of yes answers that confirms the pod comes from the city's matching profile, 4 at launch
      because confirmation is at 4 in the launch profile and 3 in the alpha profile (DESIGN §3.4, §6.10)
  look
    Paper page, side padding space.gutter.compact, the top 40px down; the title row "Your weekly drop" in font.display, type.title, 800, with "Week 46" in type.small.text, 600, color.text.muted at its right.
    The card (radius.hero, white, border.hairline color.border): a band in the pod's tint (pod.tomat.tint for brætspil), padding space.hero, holding
      an ink "New pod" badge (color.ink, color.on.ink, type.caption, 700, radius.pill) and the 30px needs-you pill (color.needs.you, a border.control color.ink border, a clock, type.caption, 700, color.on.needs.you);
      "A pod around" in type.small.text, color.text.secondary over the name in font.display, type.title, 800 in the pod's deep tone (pod.tomat.deep), and the pod badge at its right.
    Under the band, padding space.hero, 16px apart: the ProposalFacts, then the buttons.
    The buttons: Not this time a white secondary pill and I'm in a color.primary pill, size.button tall, growing 1 : 1.4, 10px apart.
    Why this pod? centred under the card, underlined, bold, color.link.
  copy
    home.titleDrop        "Your weekly drop"                     da "Ugens drop"
    pods.newPod           "New pod"                              da "Ny pod"
    pods.answerBy         "Answer by {{dayShort}} {{time}}"      da "Svar senest {{dayShort}}. kl. {{time}}"
    pods.around           "A pod around"                         da "En pod om"
    pods.noThemeLead      "A pod without a shared theme"         da "En pod uden et fælles tema"
    pods.openToAnyone     "Open to anyone"                       da "Åben for at møde alle"
    pods.accept           "I'm in"                               da "Jeg er med"
    pods.decline          "Not this time"                        da "Ikke nu"
    pods.whyLink          "Why this pod?"                        da "Hvorfor denne pod?"
  binds
    route    "/" (Home, right after the drop brought a pod)
    props    the pod's id, its card, the number that confirms it (or nothing), and what Okay does
    events   I'm in asks the server to answer yes; Not this time opens ProposalDecline; Why this pod? opens "/sheets/why-this-pod" with the pod's id
  uses ProposalFacts, ProposalDecline, DropWhy, DropWaiting
  children ProposalFacts, ProposalDecline, DropWhy
  sources
    Code: "apps/mobile/src/features/pods/ProposalCard.tsx", "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/features/drop/parts.tsx", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2, §3.3, §3.4, §6.10; pull request 5 (blend decisions)
    Storyboard: drop-proposal ("apps/mobile/preview/screens.json")
    Screens: driven in the web preview, worlds drop-proposal and pod-open-proposal, in English and Danish, on 27 November 2026
```
