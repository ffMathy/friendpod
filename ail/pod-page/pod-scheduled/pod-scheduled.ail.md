# Pod page: from the locked plan on

Once the meetup's plan has locked, the pod page calms down: the pod band in
the pod's tint, one "Next step" card when there is something to do, then
Plan, Chat and Members and nothing more. It stays this way through the meetup
and after it. Attendance, the plan card and the members card are children.

```ail
node PodScheduled : flow   level: experience
  why   From the locked plan on there is one obvious thing to do at a time (confirm, chat, give
        feedback) and three calm sections around it (DESIGN §3.4, F28).                    <- PodPage
  what
    The next step is the one PodNextStep gives: Still coming …? (MeetupAttendance), The meetup chat is open with
    Open chat, How did it go? with Give feedback, or, when the pod went back to planning, Plan the meetup (or the
    extra round's title) with Open the planner. With no next step, the card is left out.
    The Chat row shows while the chat is open (Open until …), before it opens (Opens …), and once closed (Closed)
    only while messages are left; it counts the viewer's unread messages while open.

    Scenario: The day before the meetup
      Given a member the day before a meetup: brætspil on Saturday 21 Nov at 14:00, Friday 19:30, the chat open with 3 unread
      When they open the brætspil pod
      Then the band reads brætspil and 5 people near Aarhus C
      And the next step reads Still coming tomorrow at 14:00? with Yes, I'm coming and Can't make it
      And Plan reads Saturday 21 Nov, 14:00 and [Board game café] · Aarhus C
      And Chat reads Open until Sunday 14:00 and 3 new
      And Members lists Mette, Jonas, Sofie and Ahmed, and Confirmed and More than one of you also likes are not shown

    Scenario: Just before the meetup the next step is the chat
      Given a member just before a meetup, who said they are coming
      When they press Open chat under The meetup chat is open
      Then the meetup chat opens, with a Message box

    Scenario: The morning after the meetup
      Given a member the morning after a meetup, Sunday 10:05, the chat open until Sunday 14:00 with 2 unread
      When they open the brætspil pod
      Then the next step reads How did it go? with Give feedback
      And Chat reads Open until Sunday 14:00 and 2 new
      When they press Give feedback
      Then the feedback form opens, asking Who was there?

    Scenario: The Chat row opens the chat
      Given a member the day before a meetup, on the brætspil pod
      When they press Chat
      Then the meetup chat opens, with a Message box

    Scenario: The pod band in Danish
      Given a member the day before a meetup whose app is in Danish
      When they open the brætspil pod
      Then it reads 5 personer i nærheden af Aarhus C, Næste skridt, Kommer du stadig i morgen kl. 14.00? and Medlemmer
      And Chat reads Åben til søndag kl. 14.00 and 3 nye

  how
    decide one next-step card plus Plan, Chat and Members, and nothing more; the pod interests belong to the reveal
      because pod-scheduled: "3.4 is now one next-step card plus Plan, Chat and Members" ("app/pod/[podId]/index.tsx"; DESIGN §3.4, F28)
    decide the band is the pod's tint, not its field
      because the field is only for the reveal; after it, the calm tint header (pull request 5; "apps/mobile/src/components/Pod.tsx")
    decide a reschedule round shows its own next-step card until the reveal returns
      because "a reschedule round sends a scheduled pod back to planning; the card catches up before the reveal shows" ("app/pod/[podId]/index.tsx")
    decide the Chat row keeps a closed chat only while its messages last
      because the row reads "Closed" only "while messages last" ("app/pod/[podId]/index.tsx"), and they are deleted about 3 days after the meetup (DESIGN §3.6)
  look
    The band (full width, from the top edge): the pod's tint with its bottom corners radius.hero and a border.hairline in the pod's base at 40%;
      the back chevron, the name in font.display, type.title.compact, 700 in the pod's deep tone, "5 people near Aarhus C" in type.small.text,
      600, color.text.secondary, the size.pod.badge pod badge and the "⋯" menu.
    Under it, space.gutter.compact from the sides, space.step apart: the next-step card (white, radius.card, border.hairline color.border,
      padding 14px 16px): a "Next step" needs-you pill, the question in type.headline, 700, its buttons side by side (size.button.medium, radius.pill).
    The Chat row: white, radius.card, a 36px disc in the pod's tint with a chat icon in its deep tone, "Chat" in type.body, 600, the window in
      type.caption, color.text.muted, and the unread count as an Ink badge (color.ink, color.on.ink, radius.pill) at the right.
  copy
    pod.nextStep         "Next step"                  da "Næste skridt"
    pod.next.chat        "The meetup chat is open"    da "Mødechatten er åben"
    pod.next.chatAction  "Open chat"                  da "Åbn chatten"
    pod.next.feedback    "How did it go?"             da "Hvordan gik det?"
    pod.giveFeedback     "Give feedback"              da "Giv feedback"
    pod.next.voteAction  "Open the planner"           da "Åbn planlæggeren"
    pod.sections.chat    "Chat"                       da "Chat"
    pod.chatOpenUntil    "Open until {{when}}"        da "Åben til {{when}}"
    pod.chatOpens        "Opens {{when}}"             da "Åbner {{when}}"
    pod.chatClosed       "Closed"                     da "Lukket"
    pod.newMessages_one  "{{count}} new"              da "{{count}} ny"
    pod.newMessages_other "{{count}} new"             da "{{count}} nye"
  binds
    shows    the next step from PodNextStep, with feedback counted as given once sent or once 7 days have passed since 2 hours after the meetup
    events   Open chat and the Chat row open the chat; Give feedback opens the feedback form; Open the planner opens the planner
    role     the Chat row is a link named "Chat, <its window>, <n> new"
  uses PodNextStep, MeetupAttendance, PodPlanCard, PodMembersCard, PodMenu, MeetupChat, AfterTheMeetup, PlanMeetup
  children MeetupAttendance, PodPlanCard, PodMembersCard
  sources
    Code: "apps/mobile/app/pod/[podId]/index.tsx" (from the locked plan on), "apps/mobile/src/features/pods/parts.tsx", "apps/mobile/src/components/Pod.tsx" (PodBand)
    Design: DESIGN §3.4, §3.6, §4.6, F28 (D13)
    Screens: driven in the web preview on 27 November 2026, worlds pod-scheduled, pod-chat-open, pod-happened, in English and Danish (screens.json pod-scheduled, app-pod-happened)
```
