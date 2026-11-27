# Pod page: the proposal

The pod page before the viewer is a confirmed member: the same proposal card
This week shows (Home's DropProposal, DropWaiting and PrivatePodProposal),
under the drop's header, with a back chevron. The kinds of proposal (colours,
open to anyone, private) are a child.

```ail
node PodProposal : flow   level: experience
  why   Before a pod is confirmed, an invitee decides on the theme, size, area and deadline alone:
        never names, photos or who has accepted (DESIGN §3.2, §3.3).                        <- PodPage
  what
    Until the viewer is a confirmed member, the pod page is the drop's header over the proposal card, with
    the link under it: Why this pod? while invited, Changed your mind? Leave this pod after saying yes.
    The waiting card has no Okay button here: that is only on This week.

    Scenario: The proposal names the pod, never its people
      Given a member with a pod proposal for brætspil: 5 people aged 29–38 within about 10 km, answer by Saturday 18:00
      When they open the brætspil pod
      Then it reads Your weekly drop and Week 46
      And the card reads New pod, Answer by Sat 18:00, A pod around and brætspil
      And it shows You, 5 people, ages 29–38, Near Aarhus C · everyone within about 10 km of you, and Some of you also share sourdough and trail running
      And it says Names and photos appear when 4 people have said yes.
      And it offers Not this time and I'm in, with Why this pod? under the card
      And no member's first name is shown

    Scenario: I'm in turns the proposal into the wait
      Given a member with a pod proposal that 2 of its 5 invitees have already said yes to
      When they press I'm in
      Then the card reads You're in, Open until Sat 18:00 and 3 of 5 said yes, with 4 needed
      And it says We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits.
      And Changed your mind? Leave this pod is under the card
      And I'm in, Not this time and Okay are not shown

    Scenario: Waiting for the others
      Given a member waiting for the others, 3 of 5 having said yes
      When they open the brætspil pod
      Then the card reads You're in, 3 of 5 said yes and 4 needed

    Scenario: Saying no on the pod page
      Given a member with a pod proposal, on the brætspil pod
      When they press Not this time, pick Too far and press Decline this pod
      Then the card reads You said no over brætspil, and the page stays open
      And I'm in, Not this time and Why this pod? are not shown

    Scenario: Why this pod? gives the reasons
      Given a member with a pod proposal
      When they press Why this pod?
      Then Why this pod opens, starting Everyone added brætspil, or something that means the same.

    Scenario: The proposal in Danish
      Given a member with a pod proposal whose app is in Danish
      When they open the brætspil pod
      Then it reads Ugens drop, Uge 46, Ny pod, Svar senest lør. kl. 18.00 and En pod om
      And it offers Ikke nu and Jeg er med, with Hvorfor denne pod? under the card

  how
    decide the pod page shows the proposal card exactly as This week does, under the drop's header
      because "app/pod/[podId]/index.tsx": "the proposal card under the drop's header, as on This week (drop-proposal, drop-waiting, priv-sensitive)"
    decide the waiting card has no Okay here
      because Okay folds the card away on This week, and the pod page passes no such action ("apps/mobile/src/features/pods/ProposalCard.tsx")
    decide Leave this pod, after saying yes, asks first: Leave this pod? You can't join it again afterwards., with Cancel and Leave
      because a member who leaves cannot rejoin, which the question says ("apps/mobile/src/features/pods/ProposalCard.tsx")
  look
    Paper page (color.page): the back chevron (size.hit) at the top left, then "Your weekly drop" in font.display, type.title,
      700, color.text, with "Week 46" at its right in type.small.text, 600, color.text.muted; space.gap under it, the card
      (DropProposal, DropWaiting or PrivatePodProposal), and the centred link under it; the tab bar at the foot.
  copy
    home.titleDrop     "Your weekly drop"     da "Ugens drop"
    home.week          "Week {{week}}"        da "Uge {{week}}"
  binds
    shows    the week number of the answer deadline
    events   I'm in and Decline this pod answer the proposal and stay on the page; Why this pod? opens the reasons sheet; How private interests are protected opens the private-interests page
  uses DropProposal, ProposalDecline, DropWaiting, PrivatePodProposal, PodProposalKinds
  children PodProposalKinds
  sources
    Code: "apps/mobile/app/pod/[podId]/index.tsx", "apps/mobile/src/features/pods/ProposalCard.tsx", "apps/mobile/src/features/drop/parts.tsx"
    Design: DESIGN §3.2, §3.3, §4.6 (proposed)
    Screens: driven in the web preview on 27 November 2026, worlds drop-proposal and drop-waiting, in English and Danish (screens.json app-pod-proposal, app-pod-waiting)
```
