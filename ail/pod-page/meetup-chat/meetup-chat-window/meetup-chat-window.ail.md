# Meetup chat: the window

When the chat can be written in, and what it says when it cannot: the line
under the band, and the note above the field while it is closed.

```ail
node MeetupChatWindow : view   level: experience
  why   Strangers still planning get no chat, and nothing lives on after the meetup: the chat is
        only open from 24 hours before the meetup until 24 hours after it (DESIGN F6, A28).  <- MeetupChat
  what
    The chat is open from 24 hours before the meetup until 24 hours after it, while the pod is scheduled or its meetup has happened; the band then reads Chat open until, with the weekday and time it closes.
    Before the window opens, the band reads Chat opens, with the weekday and time it opens, and the note says when a member can write.
    From 24 hours after the meetup, the band reads Chat closed and the note says the chat closed 24 hours after the meetup.
    When the meetup is no longer scheduled (moved back to planning or cancelled), the chat closes at once: with messages the note says so, without any it says the chat opens once a time is picked.
    While the chat is closed, the messages stay readable, the field cannot be typed in, and Send is dimmed and cannot be pressed.
    The line and the field change by themselves when the window opens or closes while the chat is on screen.

    Scenario: Before a time is picked the chat is closed
      Given a member planning a meetup, with no meetup time picked yet
      When they open the pod's chat
      Then the band reads Chat closed
      And the note reads The chat opens 24 hours before your meetup, once you have picked a time.
      And there are no messages, the field cannot be typed in, and Send cannot be pressed

    Scenario: The morning after the meetup the chat is still open
      Given a member the morning after a meetup, on Sunday 22 November at 10:05, with the meetup the day before at 14:00
      When they open the pod's chat
      Then the band reads Chat open until Sunday 14:00, and the field can be typed in

    Scenario: The closed chat in Danish
      Given a member planning a meetup whose app is in Danish
      When they open the pod's chat
      Then the band reads Chatten er lukket
      And the note reads Chatten åbner 24 timer før jeres møde, når I har valgt et tidspunkt.

  how
    decide open from 24 hours before until 24 hours after the meetup time, as fixed lengths of time
      because the window opens together with the 24-hour "Still coming?" (DESIGN §3.6, A28); across a change to or from summer time the clock gap is 23 or 25 hours ("packages/core/src/time/schedule.ts")
    decide a return to planning, or a cancelled meetup, closes the chat at once; the next scheduled meetup opens a new window around its own time
      because DESIGN §3.6 "Closing"
    decide a closed chat stays readable
      because the field is disabled outside the window and existing messages stay readable until they are deleted ("apps/mobile/src/features/chat/Composer.tsx"; DESIGN §3.6 "Closing": read-only at 24 hours after)
    decide the notes say "about 3 days after the meetup"
      because messages are deleted 72 hours after the meetup by the database's expiry, which can take up to another day (PRIVACY §5)
  look
    The line under the band's title in the band's subtitle style.
    While closed, the note is centred above the field in type.caption, color.text.muted; the field is dimmed to 55% and Send to 40%.
  copy
    chat.openUntil     "Chat open until {{when}}"   da "Åben til {{when}}"
    chat.opens         "Chat opens {{when}}"        da "Chatten åbner {{when}}"
    chat.closed        "Chat closed"                da "Chatten er lukket"
    plan.weekdayAt     "{{day}} {{time}}"           da "{{day}} kl. {{time}}"
    chat.notOpenYet    "You can write here from 24 hours before the meetup until 24 hours after it."   da "Du kan skrive her fra 24 timer før mødet til 24 timer efter."
    chat.closedEnded   "This chat closed 24 hours after the meetup. Messages are deleted about 3 days after it."   da "Chatten lukkede 24 timer efter mødet. Beskederne slettes cirka 3 dage efter mødet."
    chat.closedOff     "This chat closed because the meetup is no longer scheduled. Messages are deleted about 3 days after the original meetup time."   da "Chatten er lukket, fordi mødet ikke længere er aftalt. Beskederne slettes cirka 3 dage efter det oprindelige mødetidspunkt."
    chat.notScheduled  "The chat opens 24 hours before your meetup, once you have picked a time."   da "Chatten åbner 24 timer før jeres møde, når I har valgt et tidspunkt."
  binds
    route    "/pod/braetspilpodaarhus46/chat"
    state    status: "upcoming" | "open" | "ended" | "off", from the pod's meetup time and state and the clock, re-read at the window's next edge
    shows    the band's line: open until the closing time, opens at the opening time, or closed; the note only while not open
  uses MeetupChatRules
  sources
    Code: "apps/mobile/src/features/chat/window.ts", "apps/mobile/app/pod/[podId]/chat.tsx", "packages/core/src/time/schedule.ts", "apps/mobile/src/i18n/en/pod.json", "apps/mobile/src/i18n/da/pod.json"
    Design: DESIGN §3.6 "Meetup chat", §4.6 "Meetup chat window", F6, A28; PRIVACY §5
    Screens: driven in the web preview (worlds pod-planning, pod-happened) in English and Danish on 27 November 2026; no world shows a chat before its window opens, after it ended, or closed with messages, so those claims come from the code
```
