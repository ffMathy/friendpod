# Meetup chat: messages

The messages, oldest first, under a note that says who can read them and how
long they stay.

```ail
node MeetupChatMessages : view   level: experience
  why   Members see who wrote what and when, on the day, and are told plainly that only the pod
        reads it and that it is deleted about 3 days after the meetup (DESIGN §3.6, PRIVACY §4.3).  <- MeetupChat
  what
    The messages are listed oldest first, and the list starts scrolled to the newest.
    Each message shows its writer and time over its bubble: the first name from the pod, You for the member's own, or Former member for someone no longer in the pod.
    The time is the clock time for a message from today, and the short weekday and the clock time for one from another day.
    The member's own messages sit on the right, everyone else's on the left.
    A message is never shown after its deletion time (72 hours after the meetup), even when a copy is still on the phone.
    An open chat with no messages says No messages yet. Say hi, or let the others know when you're on your way.

    Scenario: Five messages just before the meetup
      Given a member just before a meetup, on Saturday 21 November at 13:58
      When they open the pod's chat
      Then the messages read, in order: Mette · Fri 15:02, Sofie · Fri 18:40, You · Fri 19:05, Jonas · 13:41 and Ahmed · 13:55
      And Ahmed's reads I'm here, table by the window, green jacket.

    Scenario: Three messages the day before
      Given a member the day before a meetup, on Friday 20 November at 19:30, who has not written yet
      When they open the pod's chat
      Then the messages read, in order: Mette · 15:02, Sofie · 18:40 and Jonas · 19:12

    Scenario: A private pod's chat stays uncoloured
      Given a member the day before a private meetup, a pod about gravid
      When they open the pod's chat
      Then the band reads gravid, with a lock named Private
      And the messages read, in order: Line · 15:10, Sara · 17:45, You · 18:20 and Mads · 19:05

    Scenario: The messages in Danish
      Given a member just before a meetup whose app is in Danish
      When they open the pod's chat
      Then the messages read, in order: Mette · fre. 15.02, Sofie · fre. 18.40, Dig · fre. 19.05, Jonas · 13.41 and Ahmed · 13.55
      And the note reads Kun jeres pod kan læse med her. Beskederne slettes cirka 3 dage efter mødet. Hold en besked nede for at anmelde den.

  how
    decide the member's own bubbles are the pod's tint and everyone else's white; in a pod about a private interest nothing is coloured
      because a private pod stays quiet: no pod colour anywhere ("apps/mobile/preview/screens.json", app-pod-private-chat; PRIVACY §4.3)
    decide a message past its deletion time is hidden on the phone, and the list updates when the next one expires
      because the device cache can hold copies the server has already deleted, and the consent says "deleted about 3 days after the meetup" ("apps/mobile/src/features/chat/useChatMessages.ts"; PRIVACY §5 "Device caches")
    decide only the weekday, never the date, for older messages
      because the window spans about two days ("apps/mobile/src/features/pods/time.ts")
  look
    The list has 14px above and below, 16px at the sides and 10px between messages.
    The note at the top is centred, at most 330px wide: color.surface with a border.hairline color.border border and radius.md,
      a 16px lock icon in color.text.secondary and the text in type.micro, color.text.secondary.
    Each message is at most 280px wide: the writer and time in type.micro, 700, color.text.muted, 4px in from the bubble's side,
      4px over the bubble. A bubble has radius.xl corners, 6px at the bottom corner nearest its side, a border.hairline border,
      10px by 14px padding, and its text in type.body.small (15px, line height 1.45).
    Others' bubbles: color.surface, color.border border, color.text. Own bubbles: the pod's tint (pod.tomat.tint for brætspil)
      with its base colour at 40% as the border, color.text; in a private pod: color.inset with a color.border border.
    The empty line is centred in type.caption, color.text.muted.
  copy
    chat.privacyNote  "Only your pod can read this. Messages are deleted about 3 days after the meetup. Press and hold a message to report it."   da "Kun jeres pod kan læse med her. Beskederne slettes cirka 3 dage efter mødet. Hold en besked nede for at anmelde den."
    chat.messages     "Messages"   da "Beskeder"
    chat.empty        "No messages yet. Say hi, or let the others know when you're on your way."   da "Ingen beskeder endnu. Sig hej, eller fortæl de andre, når du er på vej."
    chat.you          "You"        da "Dig"
    member.formerMember "Former member"   da "Tidligere medlem"
    chat.messageLabel "{{name}}, {{time}}: {{text}}"   da "{{name}}, {{time}}: {{text}}"
    chat.report       "Report message"   da "Anmeld besked"
    common.private    "Private"    da "Privat"
  binds
    props    messages: list of { writer: text, own: boolean, time: text, text: text }, oldest first; color: the pod's colour, or nothing for a private pod
    role     the list is named "Messages"; each message is one element named "<writer>, <time>: <text>", with a screen-reader action "Report message" on others' messages
  sources
    Code: "apps/mobile/app/pod/[podId]/chat.tsx", "apps/mobile/src/features/chat/MessageBubble.tsx", "apps/mobile/src/features/chat/useChatMessages.ts", "apps/mobile/src/features/pods/time.ts", "apps/mobile/src/features/pods/parts.tsx"
    Design: DESIGN §3.6; PRIVACY §4.3, §5
    Screens: "apps/mobile/preview/screens.json" pod-chat, app-pod-chat-friday, app-pod-private-chat; driven in the web preview (worlds pod-chat-open, pod-scheduled, pod-private-scheduled) in English and Danish on 27 November 2026
```
