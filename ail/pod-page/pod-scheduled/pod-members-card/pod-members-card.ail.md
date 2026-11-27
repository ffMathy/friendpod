# Pod page: the Members card

The other members of a pod from the locked plan on: their first name, their
own sentence and, while the meetup is scheduled, whether they are coming. Each
row opens the member's sheet, where block and report live.

```ail
node PodMembersCard : view   level: experience
  why   Members see who they are meeting and who has confirmed, while someone who has not answered is
        shown quietly, never flagged (DESIGN §3.4 Members, §3.6, F20).                      <- PodScheduled
  what
    The card lists the other members in roster order; the viewer is not in it. While the meetup is scheduled,
    each row ends with Coming, Can't make it or Hasn't confirmed; from the meetup on, rows carry no status.

    Scenario: Who is coming, the day before
      Given a member the day before a meetup, with Mette, Jonas and Ahmed coming and Sofie not confirmed
      When they open the brætspil pod
      Then Members lists Mette Coming, Jonas Coming, Sofie Hasn't confirmed and Ahmed Coming, in that order
      And Sofie's row is named Sofie hasn't confirmed

    Scenario: A member's row opens their sheet
      Given a member the day before a meetup, on the brætspil pod
      When they press Mette's row
      Then Mette's sheet opens

    Scenario: After the meetup, no statuses
      Given a member the morning after a meetup
      When they open the brætspil pod
      Then Members lists Mette, Jonas, Sofie and Ahmed with no Coming or Hasn't confirmed

    Scenario: Members in Danish
      Given a member the day before a meetup whose app is in Danish
      When they open the brætspil pod
      Then Medlemmer lists Kommer three times and Har ikke bekræftet once

  how
    decide someone who has not confirmed is shown quietly: a dashed avatar, a clock and the words in Ink 2, never a coloured flag
      because decision 3 ("apps/mobile/src/features/pods/PodMembers.tsx"); pull request 5: another member's Hasn't confirmed never shows in yellow
    decide the statuses show only while the meetup is scheduled
      because attendance belongs to a scheduled meetup (DESIGN §4.6): the card shows "while the meetup is scheduled, whether they're coming" ("apps/mobile/src/features/pods/PodMembers.tsx")
    decide the viewer is left out of the list
      because the storyboard pod-scheduled lists "the other members" under MEMBERS ("apps/mobile/src/features/pods/PodMembers.tsx")
  look
    A white card (color.surface, border.hairline color.border, radius.card), 16px side padding: "MEMBERS" as an eyebrow (type.eyebrow, 700,
      color.text.muted) 12px from the top; rows at least 46px tall, separated by border.hairline color.separator lines: a 32px avatar (the
      initial on the pod's deep tone, a photo on top when there is one; dashed when not confirmed), the first name in type.body, 600, the
      member's sentence under it in type.caption, color.text.muted, and the status at the right: a tick, a cross or a clock with the word
      in type.caption, 600, color.text.secondary.
  copy
    pod.sections.members            "Members"                     da "Medlemmer"
    attendance.other.coming         "Coming"                      da "Kommer"
    attendance.other.notComing      "Can't make it"               da "Kan ikke komme"
    attendance.hasntConfirmedShort  "Hasn't confirmed"            da "Har ikke bekræftet"
    attendance.hasntConfirmed       "{{name}} hasn't confirmed"   da "{{name}} har ikke bekræftet"
  binds
    route    "/pod/braetspilpodaarhus46" (the members card on the pod page)
    role     each row is a link named "<first name>, <status>, <sentence>", or "<first name> hasn't confirmed" when not confirmed
    events   a row opens that member's sheet
  uses PodColors, MemberSheet
  sources
    Code: "apps/mobile/src/features/pods/PodMembers.tsx" (MembersCard), "apps/mobile/src/features/pods/MemberAvatar.tsx", "apps/mobile/app/pod/[podId]/index.tsx"
    Design: DESIGN §3.4, §3.6, §3.7, F20; PRIVACY recipients ("<firstName> hasn't confirmed")
    Screens: driven in the web preview on 27 November 2026, worlds pod-scheduled and pod-happened, in English and Danish
```
