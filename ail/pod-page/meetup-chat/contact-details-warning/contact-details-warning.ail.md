# Meetup chat: contact details before the meetup

Before the meetup, a message with a phone number, an email address, a handle
or a link is held back once: the writer is asked whether to send it anyway.

```ail
node ContactDetailsWarning : flow   level: experience
  why   Strangers are nudged to meet before they swap numbers, without being stopped from it: the
        second tap is theirs to give (DESIGN §3.6 "Before you have met", PRIVACY R17).        <- MeetupChat
  what
    Until the meetup's start time, a message with contact details is not posted: the server answers with the warning, and nothing is stored.
    The warning offers Send anyway, which sends the same text, and Edit, which puts the cursor back in the field with the text kept.
    While the warning shows, Send cannot be pressed; it goes away as soon as the text changes, and comes back if the text is changed back to what was held.
    A map link from the places the planner offers is not contact details, nor are times and dates.
    From the meetup's start time there is no warning.

    Scenario: A phone number before the meetup needs a second tap
      Given a member just before a meetup, on Saturday 21 November at 13:58, with the meetup at 14:00
      When they write 20 30 40 50 and press Send
      Then it reads You haven't met yet. It's fine to wait until after the meetup before sharing your number or profile.
      And it offers Send anyway and Edit, Send cannot be pressed, and no message is added

    Scenario: Send anyway sends it
      Given a member just before a meetup, warned about 20 30 40 50
      When they press Send anyway
      Then the last message reads You · 13:58 and 20 30 40 50
      And the warning is gone and the field is empty

    Scenario: Edit keeps the text to change
      Given a member just before a meetup, warned about emil@example.com
      When they press Edit
      Then the warning is gone, the field still holds emil@example.com and has the cursor, and Send can be pressed

    Scenario: Changing the text hides the warning
      Given a member just before a meetup, warned about emil@example.com
      When they change the text to emil@example.co
      Then the warning is gone
      When they change it back to emil@example.com
      Then the warning shows again

    Scenario: A map link is not contact details
      Given a member just before a meetup, in the chat
      When they write https://maps.app.goo.gl/abc123 and press Send
      Then the last message reads https://maps.app.goo.gl/abc123, with no warning

    Scenario: After the meetup there is no warning
      Given a member the morning after a meetup, on Sunday 22 November at 10:05
      When they write 20 30 40 50 and press Send
      Then the last message reads You · 10:05 and 20 30 40 50, with no warning

    Scenario: The warning in Danish
      Given a member just before a meetup whose app is in Danish
      When they write 20 30 40 50 and press Send
      Then it reads I har ikke mødt hinanden endnu. Det er helt i orden at vente til efter mødet med at dele dit nummer eller din profil.
      And it offers Send alligevel and Ret

  how
    decide the server decides whether to warn, not the phone
      because only the server knows whether the meeting time has passed ("apps/mobile/src/features/chat/useSendMessage.ts")
    decide a warning, not a refusal, and only before the meetup
      because strangers are nudged to meet before swapping numbers (DESIGN A28, §3.6; PRIVACY §4.3 "Meetup chat")
    decide the warning's words are "You haven't met yet." and a longer second sentence, not DESIGN's "It's fine to wait until after."
      because "unknown, confirm with the owner: DESIGN §3.6 and PRIVACY R17 quote the shorter text, which the app keeps unused as an error message; which is meant?"
    decide the warning is a note with the needs-you marker, above the field
      because it is a question only the writer can answer (DESIGN decision 2, quoted in "apps/mobile/app/pod/[podId]/chat.tsx")
  look
    Above the field: a color.inset note with radius.lg, 11px by 12px padding: a row of the needs-you marker (color.needs.you, ringed)
      and the text in type.small.text, color.text, "You haven't met yet." in 700; under it, 10px apart, two buttons 44px tall,
      8px apart, sharing the row: Send anyway (color.surface, border.control color.border.strong, color.text) and Edit (color.primary, color.on.primary).
  copy
    chat.contactWarning       "You haven't met yet."   da "I har ikke mødt hinanden endnu."
    chat.contactWarningDetail "It's fine to wait until after the meetup before sharing your number or profile."   da "Det er helt i orden at vente til efter mødet med at dele dit nummer eller din profil."
    chat.sendAnyway           "Send anyway"            da "Send alligevel"
    chat.edit                 "Edit"                   da "Ret"
  binds
    state    held: the text the server held back, or nothing; the warning shows while it is the draft
    role     the warning's text is an alert
    events   Send anyway resends held with the warning acknowledged; Edit clears held and focuses the field
  uses MeetupChatRules
  sources
    Code: "apps/mobile/app/pod/[podId]/chat.tsx", "apps/mobile/src/features/chat/useSendMessage.ts", "packages/core/src/chat/moderation.ts", "apps/mobile/preview/scenarios/_pod.ts" (the preview answers as the server does)
    Design: DESIGN §3.6 "Before you have met", A28; PRIVACY §4.3, R17
    Screens: "apps/mobile/preview/screens.json" app-pod-chat-warning; driven in the web preview (worlds pod-chat-open, pod-happened) in English and Danish on 27 November 2026
```
