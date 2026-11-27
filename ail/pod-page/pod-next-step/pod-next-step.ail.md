# Pod next step

The one primary "next step" of a pod for the viewer, derived from the pod's
state, so the app (and any push copy) agree on it. Today it is `podNextStep`
in `packages/core/src/pods/nextStep.ts`.

```ail
node PodNextStep : fn   level: system
  why   A pod page offers one obvious thing to do at any time: vote, then confirm attendance, then
        chat while the meetup chat is open, then give feedback (DESIGN §3.4, F28, D13).      <- PodPage
  what
    Every time in this node is passed as epoch milliseconds, as its callers in the app and on the server pass them.
    type PodState = "proposed" | "planning" | "scheduled" | "happened" | "archived" | "dissolved"
    type AttendanceStatus = "coming" | "notComing" | "pending" | "unconfirmed"
    type PodNextStepKind = "vote" | "addOption" | "confirmAttendance" | "chat" | "feedback"
    type PodNextStepInput = { state: PodState, now: time, votedOnAllOptions: boolean, optionCount: integer, extended: boolean, meetupAt: time?, myAttendance: AttendanceStatus?, attendanceAskedAt: time?, feedbackGiven: boolean }

    podNextStep(input: PodNextStepInput) -> PodNextStepKind?
      planning: "vote" when optionCount > 0 and not votedOnAllOptions; else "addOption" when optionCount is 0
        or extended; else nothing.
      scheduled: "confirmAttendance" when myAttendance is neither "coming" nor "notComing", attendanceAskedAt is
        something and now ≥ attendanceAskedAt; else "chat" when meetupAt is something and isChatOpen(meetupAt, now);
        else nothing.
      happened: "feedback" when not feedbackGiven; else "chat" when meetupAt is something and
        isChatOpen(meetupAt, now); else nothing.
      any other state: nothing.

    examples
      podNextStep({ state: "planning", now: 2026-11-15 10:00:00, votedOnAllOptions: false, optionCount: 0, extended: false, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => "addOption"
      podNextStep({ state: "planning", now: 2026-11-15 10:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => "addOption"
      podNextStep({ state: "planning", now: 2026-11-16 10:00:00, votedOnAllOptions: false, optionCount: 2, extended: false, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => "vote"
      podNextStep({ state: "planning", now: 2026-11-16 10:00:00, votedOnAllOptions: true, optionCount: 2, extended: false, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => nothing
      podNextStep({ state: "planning", now: 2026-11-18 10:00:00, votedOnAllOptions: true, optionCount: 2, extended: true, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => "addOption"
      podNextStep({ state: "planning", now: 2026-11-18 10:00:00, votedOnAllOptions: false, optionCount: 2, extended: true, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => "vote"
      podNextStep({ state: "scheduled", now: 2026-11-18 10:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "pending", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => nothing
      podNextStep({ state: "scheduled", now: 2026-11-20 19:30:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "pending", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => "confirmAttendance"
      podNextStep({ state: "scheduled", now: 2026-11-20 19:30:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: nothing, attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => "confirmAttendance"
      podNextStep({ state: "scheduled", now: 2026-11-20 19:30:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "unconfirmed", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => "confirmAttendance"
      podNextStep({ state: "scheduled", now: 2026-11-20 19:30:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => "chat"
      podNextStep({ state: "scheduled", now: 2026-11-20 13:59:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => nothing
      podNextStep({ state: "scheduled", now: 2026-11-20 14:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => "chat"
      podNextStep({ state: "scheduled", now: 2026-11-21 10:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "pending", attendanceAskedAt: nothing, feedbackGiven: false }) => "chat"
      podNextStep({ state: "scheduled", now: 2026-11-22 14:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "notComing", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => nothing
      podNextStep({ state: "happened", now: 2026-11-22 10:05:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => "feedback"
      podNextStep({ state: "happened", now: 2026-11-22 10:05:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: true }) => "chat"
      podNextStep({ state: "happened", now: 2026-11-22 14:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: true }) => nothing
      podNextStep({ state: "proposed", now: 2026-11-12 18:30:00, votedOnAllOptions: false, optionCount: 0, extended: false, meetupAt: nothing, myAttendance: nothing, attendanceAskedAt: nothing, feedbackGiven: false }) => nothing
      podNextStep({ state: "archived", now: 2026-11-30 10:00:00, votedOnAllOptions: true, optionCount: 0, extended: false, meetupAt: 2026-11-21 14:00:00, myAttendance: "coming", attendanceAskedAt: 2026-11-20 14:00:00, feedbackGiven: false }) => nothing

  how
    decide one step at a time, in the order vote, confirm attendance, chat, feedback
      because DESIGN §3.4 and F28 (D13): "one primary next step card, derived from state", so there is one obvious thing to do
    decide an attendance answer is asked for until it is "coming" or "notComing"; "pending" and "unconfirmed" both still ask
      because no answer is never a no-show, but an unconfirmed member is not counted as coming (DESIGN F20, §3.6)
    decide in the extra planning round, a viewer who has voted on everything is asked to add an option
      because the round exists to find a time that works ("No time works yet — add another option", DESIGN F22, nextStep.ts)
    decide after feedback, the chat is the next step while its window lasts
      because the chat stays open until 24 hours after the meetup (DESIGN §4.6, meetup chat window)
  uses MeetupChatRules
  free [ helper names ]
  sources
    Code: "packages/core/src/pods/nextStep.ts", "packages/core/src/time/schedule.ts" (isChatOpen, firstAttendanceAsk)
    Examples: run against the existing podNextStep with tsx, in Europe/Copenhagen, on 27 November 2026
    Design: DESIGN §3.4, §3.6, §4.6, F20, F22, F28 (D13)
```
