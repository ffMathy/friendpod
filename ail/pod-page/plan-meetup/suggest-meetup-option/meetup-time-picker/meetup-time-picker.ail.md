# Meetup time picker

Day and Time on "Suggest a time": two fields side by side, each opening a
sheet of choices, so only what the planner allows can be picked.

```ail
node MeetupTimePicker : view   level: experience
  why   An option must start within 14 days, between 08:00 and 22:00, so the
        member picks from those choices instead of typing a date
        (DESIGN §3.5, §4.3).                                                  <- SuggestMeetupOption
  what
    Scenario: The days run from today to 14 days ahead
      Given a member planning a meetup on Monday 16 November at 12:00, on Suggest a time
      When they press Day
      Then the sheet Which day? offers the 15 days from Mon 16 Nov to Mon 30 Nov
      When they pick Sun 22 Nov
      Then Day reads Sun 22 Nov

    Scenario: Times that have passed today cannot be picked
      Given a member planning a meetup on Monday 16 November at 12:00, with the day Mon 16 Nov picked
      When they press Time
      Then the sheet What time? says Between 08:00 and 22:00, within the next 14 days. and offers every half hour from 08:00 to 22:00
      And 08:00 to 12:00 cannot be picked, while 12:30 and 22:00 can

    Scenario: The last day ends at the time it is now
      Given a member planning a meetup on Monday 16 November at 12:00, with the day Mon 30 Nov picked
      When they press Time
      Then 12:00 can be picked and 12:30 cannot

    Scenario: A time picked before the day is not limited
      Given a member planning a meetup on Monday 16 November at 12:00, on Suggest a time with no day picked
      When they press Time
      Then 08:00 can be picked

    Scenario: Day and time in Danish
      Given a member planning a meetup whose app is in Danish, on Foreslå et tidspunkt
      When they pick søn. 22. nov. in Hvilken dag? and 15.00 in Hvilket tidspunkt?
      Then Dag reads søn. 22. nov. and Tidspunkt reads 15.00
      And the time sheet says Mellem kl. 8 og 22 inden for de næste 14 dage.

  how
    decide the days on offer are those with at least one open time, from today to 14 days ahead, counted from when the form opened
      because only what the planner accepts can be picked ("WhenFields.tsx", "optionForm.ts")
    decide every half hour from 08:00 to 22:00, in Copenhagen time; for the chosen day, times already past or beyond 14 days are greyed out
      because options start between 08:00 and 22:00 within 14 days (DESIGN §4.3); a half-hour grid is "WhenFields.tsx"'s choice
      because "unknown, confirm with the owner: why half hours, and not quarter hours or free minutes?"
    decide a time picked before the day is not limited, and the form catches a passed time when it is sent
      because the form still checks both on send ("WhenFields.tsx")
  look
    Two equal fields side by side, space.dob apart, 2px below the header: each a label (type.label, 700, color.text) 6px over a size.input.compact box with
      radius.md, a border.control color.field border, color.surface, the value in type.body (color.text, or color.text.muted for the hint) and a calendar or clock icon at the right.
    Each sheet: a color.surface panel with rounded top corners over color.scrim, a handle, the title in font.display, type.headline, 700, and a close cross;
      the choices as size.chip chips with radius.pill, 8px apart and wrapping: white with a border.control color.border.strong border, or filled when chosen; a greyed chip cannot be pressed.
  copy
    plan.date        "Day"   da "Dag"
    plan.dateHint    "Pick a day"   da "Vælg dag"
    plan.time        "Time"   da "Tidspunkt"
    plan.timeHint    "Pick a time"   da "Vælg tid"
    plan.pickDay     "Which day?"   da "Hvilken dag?"
    plan.pickTime    "What time?"   da "Hvilket tidspunkt?"
    plan.timeWindow  "Between 08:00 and 22:00, within the next 14 days."   da "Mellem kl. 8 og 22 inden for de næste 14 dage."
  binds
    props    day: text, time: text, onDay(day: text), onTime(time: text), openedAt: time
    role     each field is a button named "Day, <value or hint>" and "Time, <value or hint>", the day spoken in full ("Sunday 22 Nov"); each sheet is a dialog with a radio group of its choices
    shows    a day as "Sun 22 Nov" ("søn. 22. nov."), a time as "15:00" ("15.00")
  sources
    Code: "apps/mobile/src/features/pods/WhenFields.tsx", "apps/mobile/src/features/pods/optionForm.ts", "apps/mobile/src/features/pods/PodSheet.tsx", "apps/mobile/src/features/pods/time.ts"
    Design: DESIGN §3.5, §4.3
    Screens: pod-propose storyboard; driven in the web preview, world pod-planning (16 November 2026 12:00), in English and Danish, on 27 November 2026
```
