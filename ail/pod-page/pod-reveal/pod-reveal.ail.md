# Pod page: the reveal

A confirmed pod while it plans its meetup: the pod's colour as a poster field
with its name, every member at its foot, what more than one of them likes,
"Meeting safely", and "Plan the meetup" with the viewer's deadline. The
field and the cards under it are children; a private pod is PrivatePodPage.

```ail
node PodReveal : flow   level: experience
  why   Confirmation is the pod's ritual moment: first names (and photos) appear, the pod gets its
        colour as a field, and the one next step is to plan the meetup within 72 hours
        (DESIGN §3.4, §3.5).                                                               <- PodPage
  what
    The reveal shows while the pod plans its meetup (the extra planning round included).
    Under the field: In their own words, when another member wrote an about-me sentence; More than one of you
    also likes, when the pod has shared interests; Meeting safely, folded; and Plan the meetup pinned at the foot
    with the viewer's deadline under it: Pick a time by … while there is no option, Vote by … while an option
    waits for their vote, else a quiet Voting closes ….

    Scenario: The reveal names everyone
      Given a member of a confirmed pod: brætspil with Mette, Jonas, Sofie and Ahmed, no options yet, planning until Tuesday 18:00
      When they open the brætspil pod
      Then it reads Confirmed, brætspil and 5 people near Aarhus C
      And Mette, Jonas, Sofie and Ahmed can each be opened, and the viewer shows as You over Emil
      And More than one of you also likes lists sourdough, coffee and hiking
      And it offers Meeting safely and Plan the meetup, with Pick a time by Tuesday 18:00

    Scenario: A member opens their sheet
      Given a member of a confirmed pod, on the brætspil reveal
      When they press Jonas
      Then Jonas's sheet opens, with Block Jonas and Report Jonas

    Scenario: Meeting safely unfolds the tips
      Given a member of a confirmed pod, on the brætspil reveal
      When they press Meeting safely
      Then it says Meet in a public place in daytime or early evening. and In an emergency, call 112.
      When they press All safety tips
      Then the Meeting safely page opens

    Scenario: Plan the meetup opens the planner
      Given a member of a confirmed pod, on the brætspil reveal
      When they press Plan the meetup
      Then the planner opens, titled Plan the meetup

    Scenario: An option waiting for the viewer's vote
      Given a member planning a meetup, with an option they have not voted on, planning until Tuesday 18:00
      When they open the brætspil pod
      Then it reads Vote by Tuesday 18:00 under Plan the meetup

    Scenario: The extra planning round
      Given a member in the extra planning round, having voted on every option, until Wednesday 18:00
      When they open the brætspil pod
      Then an alert reads No time works yet — add another option and You have one more day, until Wednesday 18:00. If no option gets 3 yes votes by then, the pod ends.
      And it reads Voting closes Wednesday 18:00 under Plan the meetup

    Scenario: The reveal in Danish
      Given a member of a confirmed pod whose app is in Danish
      When they open the brætspil pod
      Then it reads Bekræftet, 5 personer i nærheden af Aarhus C, Dig, Flere af jer kan også lide and surdej
      And it offers Mød hinanden trygt and Planlæg mødet, with Find et tidspunkt senest tirsdag kl. 18.00

  how
    decide the reveal is a poster field in the pod's base colour, one of only three poster moments
      because of the blend identity (pull request 5: poster fields only on welcome, the Thursday drop and the pod reveal)
    decide the viewer's deadline is a needs-you pill while they have something to do, else a quiet status
      because decision 2, one rule for the pod page and the planner ("apps/mobile/src/features/pods/deadline.ts")
    decide the shared interests are never attributed to anyone
      because pod interests are held by at least 2 members and "not attributed to anyone" (DESIGN §3.4)
    decide the safety tips come with the reveal
      because DESIGN §3.4 and §4.5: safety tips are shown at confirmation and at T−24 h
  uses PodRevealField, PodRevealCards, PodMenu, PlanMeetup, MemberSheet, InfoMeetingSafely
  children PodRevealField, PodRevealCards
  sources
    Code: "apps/mobile/app/pod/[podId]/index.tsx" (planning), "apps/mobile/src/features/pods/Reveal.tsx", "apps/mobile/src/features/pods/parts.tsx" (SafetyCard), "apps/mobile/src/features/pods/deadline.ts"
    Design: DESIGN §3.4, §3.5, §4.5, F22
    Screens: driven in the web preview on 27 November 2026, worlds pod-confirmed, pod-planning, pod-planning-extended, in English and Danish (screens.json pod-confirmed, app-pod-extended)
```
