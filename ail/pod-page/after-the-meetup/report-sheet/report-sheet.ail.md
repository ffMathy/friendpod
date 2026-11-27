# Report

The report of a member, a plan suggestion or a chat message: the 112 alert,
one reason, an optional note and Send report. The reporter is never named.
What the sheet shows is its child, ReportForm.

```ail
node ReportSheet : flow   level: experience
  why   Anyone in a pod can report a person, a suggestion or a message in a few taps, without the
        other side ever learning who reported; reports act by fixed automatic rules, since nobody
        reads them (DESIGN §3.7, F17, A25; PRIVACY §13 Art. 16).                          <- AfterTheMeetup
  what
    Scenario: Reporting a member
      Given a member the morning after a meetup
      When they open the report of Jonas in the brætspil pod
      Then it reads Report Jonas, with In danger right now? Call 112. above What happened?
      And it offers Harassment or disrespect, I felt unsafe, Didn't show up, Something they wrote and May be under 18, in that order, and not Not a genuine member
      And Tell us more (optional) reads 0 / 500, with Please don't include health or other sensitive details. Jonas will not know who reported.
      And Send report cannot be pressed

    Scenario: A reason lets the report be sent
      Given a member on the report of Jonas, the morning after a meetup
      When they choose I felt unsafe
      Then Send report can be pressed

    Scenario: Tell us more stops at 500 characters
      Given a member on the report of Jonas, the morning after a meetup
      When they write 520 characters under Tell us more
      Then the field keeps 500 of them and reads 500 / 500

    Scenario: In a private pod, Not a genuine member is offered
      Given a member of a confirmed private pod
      When they open the report of Line
      Then it reads Report Line and offers Not a genuine member last, after May be under 18

    Scenario: Reporting a chat message
      Given a member the morning after a meetup
      When they open the report of a message in the brætspil pod's chat
      Then it reads Report a message, and says We keep a copy of this message with your report for 12 months, also after the chat is deleted.
      And Something they wrote comes first
      And the note's warning ends Nobody is told who reported.

    Scenario: Reporting a plan suggestion
      Given a member planning a meetup
      When they open the report of the Saturday suggestion
      Then it reads Report a suggestion, and the note's warning ends Nobody is told who reported.

    Scenario: A report opened on its own stays open after sending
      Given a member the morning after a meetup, who opened the report of Jonas from a link
      When they choose Didn't show up and press Send report
      Then the report stays open, still reading Report Jonas

    Scenario: The report in Danish
      Given a member the morning after a meetup whose app is in Danish
      When they open the report of Jonas
      Then it reads Anmeld Jonas, I fare lige nu? Ring 112., Hvad skete der? and Fortæl mere (valgfrit)
      And the button reads Send anmeldelse

  how
    decide one reason must be chosen; the note is optional, up to 500 characters, with a warning against sensitive details
      because the report's categories, optional text of at most 500 characters and that warning are part of the design (DESIGN §3.7)
    decide Not a genuine member is offered only in pods about a private interest
      because it puts the reported person on a 28-day hold from such pods, a safeguard against infiltration (DESIGN §6.1 S7, A25)
    decide for a message, Something they wrote comes first, and the sheet says a copy is kept for 12 months
      because a reported message is nearly always about what it says ("apps/mobile/app/sheets/report.tsx"), and the copy outlives the chat's deletion (DESIGN §3.6 Report)
    decide the 112 alert is always shown, whatever the reason
      because with no one reading reports, the app shows "call 112" (PRIVACY §13 Art. 18; DESIGN §3.7)
    decide sending or closing goes back to what opened the report; with nothing to go back to, the report stays open
      because "unknown, confirm with the owner: a report opened from a link stays open after Send report and Close, with no sign it was sent; should it show a receipt or go to the pod?"
    decide no receipt is shown in the sheet after sending
      because "unknown, confirm with the owner: the server sends an acknowledgement notice (DESIGN §10.1 report); should the sheet itself confirm the report was sent?"
  uses ReportForm
  children ReportForm
  sources
    Code: "apps/mobile/app/sheets/report.tsx", "packages/core/src/types/domain.ts" (the report categories), "packages/core/src/schemas/callables.ts" (the 500-character limit)
    Design: DESIGN §3.6 Report, §3.7, §10.1 report, F17, A25, §6.1 S7; PRIVACY §13; "apps/mobile/preview/screens.json" after-report, app-sheets-report-message
    Screens: driven in the web preview, worlds pod-happened, pod-private-confirmed and pod-planning, in English and Danish, on 27 November 2026
```
