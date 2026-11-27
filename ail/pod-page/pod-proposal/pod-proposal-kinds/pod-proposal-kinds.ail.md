# Pod page: kinds of proposal

How the proposal on the pod page looks for each kind of pod: a themed pod in
its colour, a pod open to anyone in the colour of its pod id, and a pod about a
private interest, which stays white and shows less.

```ail
node PodProposalKinds : view   level: experience
  why   Colour grows with commitment, so a proposal is a tint band in the pod's colour; a pod about a
        private interest stays quiet and shows less, so people who say no cannot work out who the
        invitees are (DESIGN §3.2 sensitive themes; PRIVACY R15).                          <- PodProposal
  what
    Scenario: A Fjord pod's proposal
      Given a member with a Fjord pod proposal for far på barsel, 5 people aged 30–39
      When they open the far på barsel pod
      Then far på barsel is in Fjord deep on the Fjord tint
      And it reads 5 people, ages 30–39, with no Some of you also share line

    Scenario: A Solsikke pod's proposal
      Given a member with a Solsikke pod proposal for sourdough
      When they open the sourdough pod
      Then sourdough is in Solsikke deep on the Solsikke tint

    Scenario: The brætspil proposal is Tomat
      Given a member with a pod proposal for brætspil
      When they open the brætspil pod
      Then brætspil is in Tomat deep on the Tomat tint

    Scenario: An open pod's proposal takes its colour from the pod
      Given a member with an open pod proposal, whose pod id lands on Blomme
      When they open the open pod
      Then the card reads A pod without a shared theme over Open to anyone
      And Open to anyone is in Blomme deep on the Blomme tint

    Scenario: A private pod's proposal shows less
      Given a member with a private pod proposal for gravid, 5 people, in week 48
      When they open the gravid pod
      Then it reads Week 48, Private interest, Answer by Sat 18:00, A pod around and gravid, in Ink on white
      And it reads 5 people and Near Aarhus C, with no ages, no distance, no seats, no New pod and no shared interests
      And it says Everyone invited added this interest themselves and gave consent. and Once the pod is confirmed, members see first names.
      And How private interests are protected is under the card, not Why this pod?
      When they press How private interests are protected
      Then the Private interests page opens

    Scenario: A private pod's proposal in Danish
      Given a member with a private pod proposal whose app is in Danish
      When they open the gravid pod
      Then it reads Privat interesse, Svar senest lør. kl. 18.00 and Sådan beskytter vi private interesser

  how
    decide a themed pod's colour comes from its theme word, an open pod's from its pod id, and a private pod has none
      because of PodColors (pull request 6; "apps/mobile/src/features/pods/color.ts")
    decide a private proposal leaves out the age span, the shared interests, the distance and the seats
      because before confirmation some invitees will decline, and those facts together could narrow down who the local holders are (DESIGN §3.2; ProposalCard.tsx decision 1)
    decide a private proposal has no New pod pill
      because a private proposal "shows less on purpose": the Private interest chip with a lock takes its place ("apps/mobile/src/features/pods/ProposalCard.tsx", decision 1)
  look
    Themed and open pods: the card's band in the pod's tint (pod.fjord.tint, pod.solsikke.tint, pod.tomat.tint, pod.blomme.tint),
      the name in its deep tone (pod.fjord.deep, pod.solsikke.deep, pod.tomat.deep, pod.blomme.deep), the fact icons in the deep tone.
    Private: the card white (color.private.bg) with a border.control color.private.border border and no tint band; the
      "Private interest" chip (white, color.private.border ring, a lock); the name in color.text; the private pod badge;
      the note with a shield; the link "How private interests are protected" centred under the card in color.link.
  binds
    shows    the colour of PodColors' podColorOf for the pod
  uses PodColors, PrivatePodProposal, DropProposal
  sources
    Code: "apps/mobile/src/features/pods/ProposalCard.tsx", "apps/mobile/src/features/pods/color.ts", "apps/mobile/src/components/Pod.tsx" (HeroCard)
    Design: DESIGN §3.2; PRIVACY R15; pull requests 5 and 6
    Screens: driven in the web preview on 27 November 2026, worlds pod-fjord-proposal, pod-solsikke-proposal, pod-open-proposal, drop-proposal, drop-private, in English and Danish (screens.json app-pod-*-proposal)
```
