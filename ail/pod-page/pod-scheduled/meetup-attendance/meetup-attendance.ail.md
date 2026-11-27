# Meetup attendance

"Still coming?" on the pod page while a meetup is scheduled: the next-step
card once the question has been asked, then a line at the foot of the Plan
card with the viewer's answer and the way to change it.

```ail
node MeetupAttendance : flow   level: experience
  why   The pod needs to know who is really coming: a yes vote for the winning time counts as coming,
        and "Still coming?" is asked 3 days and 24 hours before; no answer is never a no-show,
        but it does not count as coming (DESIGN §3.6, F20).                              <- PodScheduled
  what
    Once Still coming …? has been asked and the viewer has not answered, it is the next-step card, with
    Yes, I'm coming and Can't make it. Otherwise, while the meetup is scheduled, the foot of the Plan card
    shows the viewer's answer: You're coming. with Can't make it; You said you can't make it. with
    I'm coming after all; or, with no answer yet, a needs-you note with I'm coming and Can't make it.
    Can't make it asks first: Can't make it? We'll tell your pod you're not coming. Cancelling close to the
    meetup counts as a late cancellation., with Cancel and Can't make it.

    Scenario: Saying yes moves the next step on to the chat
      Given a member the day before a meetup, asked Still coming tomorrow at 14:00? and not yet answered, the chat open
      When they press Yes, I'm coming
      Then the next step reads The meetup chat is open, with Open chat
      And the Plan card reads You're coming. with Can't make it
      And Still coming tomorrow at 14:00? is not shown

    Scenario: The viewer already said they are coming
      Given a member just before a meetup, who said they are coming
      When they open the brætspil pod
      Then the Plan card reads You're coming. with Can't make it

    Scenario: Still coming? in Danish
      Given a member the day before a meetup whose app is in Danish
      When they press Ja, jeg kommer
      Then the Plan card reads Du kommer. with Kan ikke komme

  how
    decide the question names the meetup relative to today: today at 14:00, tomorrow at 14:00, on Saturday at 14:00, or the date further out
      because the ask comes at most 3 days ahead, so a weekday is never ambiguous ("apps/mobile/src/features/pods/time.ts")
    decide Can't make it asks first, and says that cancelling close to the meetup counts as a late cancellation
      because cancelling 24 hours or more before costs nothing, later it is a late cancel (DESIGN §4.4)
    decide a missing answer is a needs-you note, never a coloured flag on anyone else
      because decision 2 (the viewer's own action needs them) and decision 3 (others are shown quietly) ("apps/mobile/src/features/pods/AttendanceCard.tsx")
  look
    The ask: the next-step card with "Still coming tomorrow at 14:00?" in type.headline, 700, then "Yes, I'm coming" (color.primary, color.on.primary)
      and "Can't make it" (white, border.control color.border.strong) side by side, size.button.medium tall, radius.pill, sharing the row 1.4 : 1
      but never narrower than their labels.
    The line: under a border.hairline color.separator rule at the Plan card's foot, a tick (or a cross) and the answer in type.caption, 600,
      color.text.muted, then the other answer as a size.button.compact button; with no answer, a needs-you note (color.needs.you marker with a
      color.ink ring, on color.page) holding the two buttons full width.
  copy
    attendance.stillComing         "Still coming {{when}}?"        da "Kommer du stadig {{when}}?"
    attendance.relative.today      "today at {{time}}"             da "i dag kl. {{time}}"
    attendance.relative.tomorrow   "tomorrow at {{time}}"          da "i morgen kl. {{time}}"
    attendance.relative.weekday    "on {{day}} at {{time}}"        da "på {{day}} kl. {{time}}"
    attendance.relative.date       "on {{date}} at {{time}}"       da "{{date}} kl. {{time}}"
    attendance.yesComing           "Yes, I'm coming"               da "Ja, jeg kommer"
    attendance.coming              "I'm coming"                    da "Jeg kommer"
    attendance.comingAfterAll      "I'm coming after all"          da "Jeg kommer alligevel"
    attendance.cantMakeIt          "Can't make it"                 da "Kan ikke komme"
    attendance.cantMakeItTitle     "Can't make it?"                da "Kan du ikke komme?"
    attendance.cantMakeItBody      "We'll tell your pod you're not coming. Cancelling close to the meetup counts as a late cancellation."   da "Vi fortæller din pod, at du ikke kommer. Et afbud tæt på mødet tæller som et sent afbud."
    attendance.mine.pending        "You haven't said if you're coming yet."   da "Du har ikke sagt endnu, om du kommer."
    attendance.mine.coming         "You're coming."                da "Du kommer."
    attendance.mine.notComing      "You said you can't make it."   da "Du har meldt afbud."
    attendance.mine.unconfirmed    "You haven't confirmed. Let the others know if you're coming."   da "Du har ikke bekræftet. Fortæl de andre, om du kommer."
  binds
    route    "/pod/braetspilpodaarhus46" (Still coming? on the pod page)
    events   Yes, I'm coming, I'm coming and I'm coming after all tell the pod the viewer is coming; Can't make it, once confirmed, that they are not; both buttons wait while it is sent, and a failure shows its message
  uses PodNextStep
  sources
    Code: "apps/mobile/src/features/pods/AttendanceCard.tsx", "apps/mobile/src/features/pods/time.ts", "apps/mobile/app/pod/[podId]/index.tsx"
    Design: DESIGN §3.6, §4.4, F20 (D5)
    Screens: driven in the web preview on 27 November 2026, worlds pod-scheduled and pod-chat-open, in English and Danish
```
