# After the meetup

What a member does once the pod has met: say how it went, and, at any time in
a confirmed pod, block or report another member. Four screens, each a child:
the feedback form "How did it go?", the member sheet, the block confirmation
inside it, and the report sheet. This node holds the journeys between them and
the pod page.

```ail
node AfterTheMeetup : flow   level: experience
  why   After meeting in person, each member tells Friendpod privately how it went, so no-shows,
        "meet again" and the pod's next round can be settled without anyone seeing the answers;
        and every member can block or report anyone they shared a pod with, safely and
        without being named (DESIGN §3.6, §3.7, F28).                                       <- PodPage
  what
    Scenario: Give feedback opens How did it go? and Back returns to the pod
      Given a member the morning after a meetup, on the brætspil pod
      When they press Give feedback
      Then How did it go? opens
      When they press Back
      Then the pod shows again, its next step still How did it go?

    Scenario: A member's name opens their sheet, and Close returns to the pod
      Given a member the morning after a meetup, on the brætspil pod
      When they press Jonas under Members
      Then Jonas's sheet opens over the pod, with Block Jonas and Report Jonas
      When they press Close
      Then the pod shows, with no sheet over it

    Scenario: A report from a member's sheet returns to the sheet
      Given a member the morning after a meetup, on Jonas's sheet
      When they press Report Jonas
      Then Report Jonas opens
      When they choose Didn't show up and press Send report
      Then Jonas's sheet shows again, with Block Jonas and Report Jonas

    Scenario: The journey in Danish
      Given a member the morning after a meetup whose app is in Danish, on the brætspil pod
      When they press Jonas under Medlemmer
      And they press Anmeld Jonas
      Then Anmeld Jonas opens, with Hvad skete der?

  how
    decide block and report live in each member's sheet, opened from the member's name in the pod
      because block and report are in each member's sheet in a confirmed pod, current or past (DESIGN F28, §3.7)
    decide feedback is its own screen, opened from the pod's next step and from the push the morning after
      because the pod page shows one next step at a time, ending with give feedback (DESIGN F28), and the push comes the next morning at 10:00 (DESIGN F27)
    decide the report is a screen of its own over whatever opened it, and sending or closing it goes back there
      because the same report opens from a member's sheet, a plan suggestion and a chat message ("apps/mobile/app/sheets/report.tsx", DESIGN §3.6 Report)
  uses MeetupFeedback, MemberSheet, ReportSheet
  children MeetupFeedback, MemberSheet, ReportSheet
  sources
    Code: "apps/mobile/app/pod/[podId]/feedback.tsx", "apps/mobile/app/pod/[podId]/member/[uid].tsx", "apps/mobile/app/sheets/report.tsx",
          "apps/mobile/src/features/after/parts.tsx", "apps/mobile/src/features/pods/PodMembers.tsx", "apps/mobile/src/i18n/en/after.json", "apps/mobile/src/i18n/da/after.json"
    Design: DESIGN §3.6 (feedback), §3.7 (block and report), F24, F27, F28, F30, A25; PRIVACY §13 (DSA notes: the in-app Report flow, call 112)
    Screens: "apps/mobile/preview/screens.json" after-feedback, after-member, after-report, app-member-block, app-member-private, app-sheets-report-message;
             driven in the web preview, world pod-happened (Sunday 22 November 2026, 10:05), in English and Danish, on 27 November 2026
    Pull request: "https://github.com/ffMathy/friendpod/pull/4" (after the meetup rebuilt to its storyboards)
    No tickets: friendpod has no issues, and Asana has no Friendpod project
```
