# Extra planning round

The banner the planner shows when voting closed without a winner and the pod
got its one extra day: "No time works yet — add another option".

```ail
node ExtraPlanningRound : view   level: experience
  why   A pod is not lost to one quiet weekend: when no option reached 3 yes votes
        by the deadline, the pod gets one more day to add an option and vote,
        and only then does it end (DESIGN F22, §3.5).                         <- PlanMeetup
  what
    Scenario: The extra round asks for another option
      Given a member in the extra planning round on Wednesday 18 November at 10:00, voting closing Wednesday at 18:00
      And Saturday 21 Nov, 14:00 has a yes from Mette and Jonas, Sunday 22 Nov, 11:00 a yes from Sofie and Ahmed, and the member said no to both
      When the planner opens
      Then it reads Voting closes Wednesday 18:00
      And the banner says No time works yet — add another option
      And You have one more day, until Wednesday 18:00. If no option gets 3 yes votes by then, the pod ends.
      And Saturday 21 Nov, 14:00 is Leading with 2 yes, as the earlier of two options with 2 yes
      And Suggest another time (1 spot left) can be pressed

    Scenario: The extra round in Danish
      Given a member in the extra planning round whose app is in Danish
      When the planner opens
      Then the banner says Intet tidspunkt passer endnu – tilføj et forslag mere
      And I har én dag mere, indtil onsdag kl. 18.00. Hvis intet forslag får 3 ja-stemmer inden da, stopper poden.

  how
    decide the banner shows for as long as the round is the extra one, above the options
      because the pod sees "No time works yet — add another option" during the extension (DESIGN §3.5, §4.6, the planning sticky note)
    decide its time is the moved deadline, the same as the Voting closes line
      because the extra round moves the deadline by 24 hours, once per planning round (DESIGN F22, A31)
    decide the deadline is a quiet line, not a needs-you pill, once the member has voted on every option
      because the banner already asks for another option, so the member is not asked twice ("deadline.ts")
    decide an option leads even below 3 yes votes
      because "unknown, confirm with the owner: Leading is shown for an option that cannot win as it stands; is that intended in the extra round?"
  look
    A needs-you note under the header: color.surface with a border.hairline color.border border and radius.lg, about space.step padding;
      a clock in a color.needs.you circle with a color.ink outline at the left, the title in type.small.text, 700, color.text, the text under it in type.small.text, color.text.
  copy
    plan.extendedTitle  "No time works yet — add another option"   da "Intet tidspunkt passer endnu – tilføj et forslag mere"
    plan.extendedBody   "You have one more day, until {{when}}. If no option gets 3 yes votes by then, the pod ends."   da "I har én dag mere, indtil {{when}}. Hvis intet forslag får 3 ja-stemmer inden da, stopper poden."
  binds
    route    "/pod/braetspilpodaarhus46/plan" (the banner on the planner)
    shows    while the pod's planning is marked extended; when is the deadline as a weekday and a time
  uses MeetupPlanningRules
  sources
    Code: "apps/mobile/app/pod/[podId]/plan.tsx" (the banner), "apps/mobile/src/features/pods/deadline.ts", "packages/core/src/pods/planning.ts"
    Design: DESIGN F22, A31, §3.5, §4.6
    Screens: "apps/mobile/preview/screens.json" app-pod-plan-extended; driven in the web preview, world pod-planning-extended, in English and Danish, on 27 November 2026
```
