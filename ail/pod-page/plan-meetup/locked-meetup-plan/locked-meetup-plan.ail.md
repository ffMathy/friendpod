# Locked meetup plan

What the planner shows once voting is over: "Your meetup", how the time won,
the plan with the map, the calendar and the safety tips, the member's own
answer and who else is coming. Before the pod is confirmed, the same screen
says only that the planner opens then.

```ail
node LockedMeetupPlan : flow   level: experience
  why   Once the plan locks there is nothing left to vote on: the planner becomes
        the plan, and a yes for the winning time already counts as coming
        (DESIGN §3.6 Plan lock).                                              <- PlanMeetup
  what
    Scenario: The plan once it is locked
      Given a member the day before a meetup, on Friday 20 November at 19:30
      And Saturday 21 Nov, 14:00 at [Board game café], Aarhus C won with a yes from Mette, Jonas and Ahmed, and the member has not answered
      When the planner opens
      Then it reads Your meetup and Voting has closed: this time won with 3 yes votes.
      And the plan reads Saturday 21 Nov, 14:00 and [Board game café] · Aarhus C, with Open in Maps, Add to calendar and Meeting safely
      And it says You haven't said if you're coming yet. with I'm coming and Can't make it
      And Mette, Jonas and Ahmed are Coming and Sofie Hasn't confirmed
      And there is nothing to vote on and no Done voting

    Scenario: Saying I'm coming on the plan
      Given a member the day before a meetup who has not answered
      When they press I'm coming
      Then it says You're coming.
      And the line under Your meetup still reads only Voting has closed: this time won with 3 yes votes.

    Scenario: Meeting safely opens the safety tips
      Given a member the day before a meetup
      When they press Meeting safely on the plan
      Then the safety tips open, titled Meeting safely

    Scenario: After the meetup the plan is a record
      Given a member the morning after a meetup
      When they open the planner
      Then it reads Saturday 21 Nov, 14:00 and [Board game café] · Aarhus C
      And there is no Open in Maps, Add to calendar, Meeting safely or I'm coming

    Scenario: Before the pod is confirmed
      Given a member with a pod proposal
      When they open the planner
      Then it reads Your meetup and The planner opens once the pod is confirmed.

    Scenario: The plan in Danish
      Given a member the day before a meetup whose app is in Danish
      When the planner opens
      Then it reads Jeres møde and Afstemningen er lukket, og det her tidspunkt vandt med 3 ja-stemmer.
      And the plan reads Lørdag 21. nov. kl. 14.00, with Åbn i Kort, Føj til kalender and Mød hinanden trygt

  how
    decide the line under the title says how many yes votes won it, counting current members only, or only that voting has closed when the winning option is gone
      because "plan.tsx"; the winner is decided on current members' yes votes (DESIGN §4.6)
    decide "Your yes counts as I'm coming" is added only while the meetup is ahead, the member said yes to the winning time and is still coming
      because a later "Can't make it" overrides the vote ("plan.tsx"; DESIGN §3.6: a yes for the winning option counts as coming)
    decide Open in Maps, Add to calendar, Meeting safely and the answer are shown only while the pod is scheduled and the meetup is ahead
      because once the meetup has started the date and place stay as a plain record ("LockedPlan.tsx"; DESIGN §3.6)
    decide Add to calendar opens the phone's own add-event sheet, and nothing about it is stored
      because no calendar permission is asked for and Friendpod keeps nothing (DESIGN §3.6, F26)
    decide before the pod is confirmed the planner shows only that it opens once the pod is confirmed, under the title Your meetup
      because "unknown, confirm with the owner: should this screen be titled Your meetup before any meetup exists?"
  look
    Paper page (color.page), side padding space.gutter, blocks 14px apart, 32px from the top. The back chevron, then "Your meetup" in font.display, type.title, 800;
      under it a tick and the status in type.caption, 700, color.text.secondary, wrapping to two lines.
    The plan card: color.surface, a border.hairline color.border border, radius.card, space.card padding. "PLAN" in type.eyebrow, 700, color.text.muted, with "Meeting safely"
      (a shield, type.caption 700, underlined color.link) at its right; the time in type.card.title, 800; a pin in the pod's deep colour and "name · address" in type.small.text, color.text.secondary;
      "Open in Maps" and "Add to calendar" side by side, size.hit tall, white with a border.control color.border.strong border and radius.pill; then the answer: while it is pending, in a tinted inset; once the member has answered, on the card's white under a border.hairline color.separator rule, with You're coming. and a full-width Can't make it button.
    The members card under it, as on the pod page.
  copy
    plan.lockedTitle      "Your meetup"   da "Jeres møde"
    plan.notPlanning      "The planner opens once the pod is confirmed."   da "Planlæggeren åbner, når poden er bekræftet."
    plan.lockedWon_one    "Voting has closed: this time won with {{count}} yes vote."   da "Afstemningen er lukket, og det her tidspunkt vandt med {{count}} ja-stemme."
    plan.lockedWon_other  "Voting has closed: this time won with {{count}} yes votes."   da "Afstemningen er lukket, og det her tidspunkt vandt med {{count}} ja-stemmer."
    plan.lockedClosed     "Voting has closed: this is the time that won."   da "Afstemningen er lukket, og det her tidspunkt vandt."
    plan.lockedYourYes    "Your yes counts as “I'm coming”."   da "Dit ja tæller som »Jeg kommer«."
    plan.placeLine        "{{name}} · {{address}}"   da "{{name}} · {{address}}"
    pod.sections.plan     "Plan"   da "Plan"
    pod.safety.title      "Meeting safely"   da "Mød hinanden trygt"
    pod.openMap           "Open in Maps"   da "Åbn i Kort"
    pod.addToCalendar     "Add to calendar"   da "Føj til kalender"
    pod.calendarTitle     "Pod meetup"   da "Pod-møde"
    pod.calendarFailed    "Your calendar couldn't be opened."   da "Kalenderen kunne ikke åbnes."
    attendance.mine.pending "You haven't said if you're coming yet."   da "Du har ikke sagt endnu, om du kommer."
    attendance.mine.coming  "You're coming."   da "Du kommer."
    attendance.coming     "I'm coming"   da "Jeg kommer"
    attendance.cantMakeIt "Can't make it"   da "Kan ikke komme"
  binds
    route    "/pod/braetspilpodaarhus46/plan"
    shows    the plan whenever the pod is confirmed, not planning, and has a locked time and place; else plan.notPlanning
    events   Meeting safely opens the safety tips; Open in Maps opens the option's map link; Add to calendar opens the add-event sheet titled pod.calendarTitle; I'm coming and Can't make it send the member's answer
  sources
    Code: "apps/mobile/app/pod/[podId]/plan.tsx" (the locked branch), "apps/mobile/src/features/pods/LockedPlan.tsx", "apps/mobile/src/features/pods/AttendanceCard.tsx", "apps/mobile/src/features/pods/calendar.ts"
    Design: DESIGN §3.6 (plan lock, Add to calendar, answering), F26
    Screens: "apps/mobile/preview/screens.json" app-pod-plan-locked; driven in the web preview, worlds pod-scheduled, pod-happened and drop-proposal, in English and Danish, on 27 November 2026
```
