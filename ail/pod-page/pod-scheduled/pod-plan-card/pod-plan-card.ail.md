# Pod page: the Plan card

The locked plan on the pod page: when and where, a way to the map and the
calendar while the meetup is ahead, and the safety tips beside its heading.
Once the meetup has started it is a plain record.

```ail
node PodPlanCard : view   level: experience
  why   Members need the time and place at a glance, one tap to the map and to their own calendar
        without Friendpod storing anything, and the safety tips at hand before they go
        (DESIGN §3.4 Plan, §3.6, §4.5, F26).                                               <- PodScheduled
  what
    Scenario: The plan the day before
      Given a member the day before a meetup, at [Board game café] in Aarhus C on Saturday 21 Nov at 14:00
      When they open the brætspil pod
      Then Plan reads Saturday 21 Nov, 14:00 and [Board game café] · Aarhus C
      And it offers Open in Maps, named Open [Board game café] in Maps, and Add to calendar
      And Meeting safely is beside the Plan heading

    Scenario: Meeting safely beside the plan opens the tips
      Given a member the day before a meetup, on the brætspil pod
      When they press Meeting safely beside the Plan heading
      Then the Meeting safely page opens

    Scenario: After the meetup the plan is a record
      Given a member the morning after a meetup
      When they open the brætspil pod
      Then Plan reads Saturday 21 Nov, 14:00 and [Board game café] · Aarhus C
      And Open in Maps, Add to calendar and Meeting safely are not shown

    Scenario: The plan in Danish
      Given a member the day before a meetup whose app is in Danish
      When they open the brætspil pod
      Then Plan reads Lørdag 21. nov. kl. 14.00 and [Brætspilscafé] · Aarhus C, with Åbn i Kort and Føj til kalender

  how
    decide Add to calendar opens the phone's own add-event sheet titled Pod meetup, without the theme, and asks for no calendar permission
      because nothing about it is stored by Friendpod (DESIGN §3.6, F26; "apps/mobile/src/features/pods/LockedPlan.tsx": "without the theme, D11")
    decide Open in Maps opens the map link stored with the option
      because the place comes from Google Places with its map link (DESIGN §3.5, F23)
    decide once the meetup has started, or the pod has met, only the date and place remain
      because "no map, safety or calendar actions on a plan that has been" ("app/pod/[podId]/index.tsx")
    decide the times read in Copenhagen time, "Saturday 21 Nov, 14:00" in English and "Lørdag 21. nov. kl. 14.00" in Danish
      because every drop, deadline and meetup is in Europe/Copenhagen (DESIGN §4.1; "apps/mobile/src/features/pods/time.ts")
  look
    A white card (color.surface, border.hairline color.border, radius.card, padding 14px 16px): "PLAN" as an eyebrow (type.eyebrow, 700,
      color.text.muted, upper case) with "Meeting safely" at its right (a shield, type.caption, 700, underlined, color.link); the date in
      type.card.title, 700; a pin in the pod's deep tone (color.text.secondary in a private pod) before the place in type.small.text,
      color.text.secondary; then "Open in Maps" and "Add to calendar" side by side, size.button.compact tall, white with a border.control
      color.border.strong border, radius.pill, each with a 16px icon; a failure under them in color.danger.
  copy
    pod.sections.plan     "Plan"                                  da "Plan"
    plan.when             "{{date}}, {{time}}"                    da "{{date}} kl. {{time}}"
    plan.placeLine        "{{name}} · {{address}}"                da "{{name}} · {{address}}"
    pod.openMap           "Open in Maps"                          da "Åbn i Kort"
    pod.openMapAt         "Open {{place}} in Maps"                da "Åbn {{place}} i Kort"
    pod.addToCalendar     "Add to calendar"                       da "Føj til kalender"
    pod.calendarTitle     "Pod meetup"                            da "Pod-møde"
    pod.calendarFailed    "Your calendar couldn't be opened."     da "Kalenderen kunne ikke åbnes."
    pod.mapFailed         "The map didn't open."                  da "Kortet kunne ikke åbnes."
    pod.safety.title      "Meeting safely"                        da "Mød hinanden trygt"
  binds
    props    the meetup's time, its place (name, address, map link), the pod's colour, and whether the meetup is past
    events   Open in Maps opens the map link; Add to calendar opens the add-event sheet; Meeting safely opens the safety page (/info/safety), only while the pod is scheduled and the meetup ahead
  uses PodColors, InfoMeetingSafely, MeetupAttendance
  sources
    Code: "apps/mobile/src/features/pods/LockedPlan.tsx", "apps/mobile/src/features/pods/calendar.ts", "apps/mobile/src/features/pods/time.ts", "apps/mobile/app/pod/[podId]/index.tsx"
    Design: DESIGN §3.4, §3.5, §3.6, §4.1, §4.5, F23, F26
    Screens: driven in the web preview on 27 November 2026, worlds pod-scheduled and pod-happened, in English and Danish
```
