# Meetup chat

The pod's short chat around its meetup (`/pod/<pod>/chat`): open from a day
before the meetup until a day after it, for the pod's current members only.
The window and its closed states, the messages, the field and the warning
about contact details are children of their own.

```ail
node MeetupChat : flow   level: experience
  why   On the day, members need to say "running late" or "I'm by the door" without swapping phone
        numbers, and a chat that only lives around the meetup keeps the room for harassment small
        (DESIGN F6, A28).                                                                     <- PodPage
  what
    Only the pod's current members see the chat; anyone else, an invitee who has not been confirmed included, sees only that it is for members.
    A member can report any other member's message by pressing and holding it; their own messages cannot be reported.

    Scenario: The chat just before the meetup
      Given a member just before a meetup, on Saturday 21 November at 13:58, with the meetup at 14:00
      When they open the pod's chat
      Then the band reads brætspil and Chat open until Sunday 14:00, with Back to pod
      And the note reads Only your pod can read this. Messages are deleted about 3 days after the meetup. Press and hold a message to report it.
      And the field reads Write to your pod, and Send cannot be pressed

    Scenario: Opening the chat clears its new messages
      Given a member the day before a meetup, on the pod, whose Chat row says 3 new
      When they press the Chat row
      Then the chat opens with Jonas's Count me in! I'll be there a few minutes early to grab a table.
      When they press Back to pod
      Then the pod shows again, and its Chat row no longer says 3 new

    Scenario: Back from a chat opened on its own goes to the Pods tab
      Given a member just before a meetup who opened the chat directly
      When they press Back to pod
      Then the Pods tab shows

    Scenario: Press and hold a message to report it
      Given a member just before a meetup, in the chat
      When they press and hold Jonas's Running 10 min late, sorry! Save me a seat.
      Then Report a message opens

    Scenario: Your own message cannot be reported
      Given a member just before a meetup, in the chat
      When they press and hold their own Me too, it will be fine. See you at 14!
      Then the chat stays, and nothing opens

    Scenario: Only members see the chat
      Given a member with a pod proposal they have not answered
      When they open that pod's chat
      Then it reads Only current members of this pod can see its chat.

    Scenario: The chat of a pod that is gone
      Given a member just before a meetup
      When they open the chat of a pod they were never in
      Then it reads This pod no longer exists.

    Scenario: The chat in Danish
      Given a member just before a meetup whose app is in Danish
      When they open the pod's chat
      Then the band reads Åben til søndag kl. 14.00, with Tilbage til poden
      And the field reads Skriv til jeres pod

  how
    decide only current members, checked again by the server on every message
      because someone who leaves, or is removed by a block, loses the chat at once (DESIGN §3.6 "Who")
    decide report by pressing and holding a message, on every message but the member's own; it opens the report sheet for that message
      because report is available on every chat message, and the report keeps a copy of it beyond its deletion (DESIGN §3.6 "Report", §3.7)
    decide the chat shows no quick replies, and "Can't make it" stays on the pod's attendance card
      because a message never changes attendance, and attendance has one place (DESIGN F29, D14)
    decide opening the chat marks its messages as seen, in memory only, and the pod's Chat row counts new messages from there
      because nothing about a pod is written to the phone for this; after a restart the member's own latest message stands in ("apps/mobile/src/features/chat/readMarker.ts")
    decide Back to pod goes back to where the member came from, or to the Pods tab when there is nowhere to go back to
      because the pod screens' shared back ("apps/mobile/src/features/pods/parts.tsx") does so on every pod screen; unknown, confirm with the owner: should a chat opened from a notification go back to its pod instead of the Pods tab?
    decide on a pod about a private interest, Android blocks screenshots of the chat
      because the chat of such a pod will often reveal the theme (PRIVACY §4.3 "Copying", R2)
  look
    A full-height screen on color.page: the pod's band at the top, the messages scrolling under it, and the field pinned
      at the bottom on color.surface with a border.hairline color.border line above it.
    The band is the pod's band in the pod's tint, with the theme as its title, the window's line under it, a back chevron
      ("Back to pod") on the left, and the other members' faces (28px, overlapping by 10px, ringed in the tint) on the right.
  copy
    chat.backToPod    "Back to pod"                                          da "Tilbage til poden"
    chat.membersOnly  "Only current members of this pod can see its chat."   da "Kun nuværende medlemmer kan se podens chat."
    pod.gone          "This pod no longer exists."                           da "Denne pod findes ikke længere."
    common.loadFailed "This could not be loaded. Try again later."           da "Det kunne ikke indlæses. Prøv igen senere."
    common.back       "Back"                                                 da "Tilbage"
  binds
    route    the pod's chat, opened from the pod's Chat row
    events   press and hold another member's message opens the report sheet with the pod and that message
  uses MeetupChatWindow, MeetupChatMessages, MeetupChatComposer, ContactDetailsWarning
  children MeetupChatWindow, MeetupChatMessages, MeetupChatComposer, ContactDetailsWarning, MeetupChatRules
  sources
    Code: "apps/mobile/app/pod/[podId]/chat.tsx", "apps/mobile/src/features/chat/readMarker.ts", "apps/mobile/src/features/pods/parts.tsx", "apps/mobile/src/features/pods/ScreenCaptureGuard.tsx"
    Design: DESIGN §3.6 "Meetup chat", §3.7, F6, F29, A28; PRIVACY §4.3, P21, R2, R17
    Screens: "apps/mobile/preview/screens.json" pod-chat, app-pod-chat-friday; driven in the web preview (worlds pod-chat-open, pod-scheduled, drop-proposal) in English and Danish on 27 November 2026
    No tickets: friendpod has no issues; pull requests 1, 3 and 4 mention the chat without reasons
```
