# Plan the meetup

The planner of a confirmed pod: the options to vote on (a time and a public
place each), the voting deadline, the button that suggests another option, and
once the plan is locked, the plan itself. Each option is a child of its own
(PlanOption), as are the extra round's banner, the locked plan, the form that
suggests an option, and the rules the server applies at the deadline.

```ail
node PlanMeetup : flow   level: experience
  why   A confirmed pod agrees on one time and one public place by voting, without a
        chat: before a meetup is scheduled the planner is the only way to talk
        (DESIGN §3.5, "No chat while planning").                              <- PodPage
  what
    Scenario: The planner shows the options to vote on
      Given a member planning a meetup on Monday 16 November at 12:00, voting closing Tuesday 17 November at 18:00
      And the options Saturday 21 Nov, 14:00 at [Board game café], Aarhus C with a yes from Mette, Jonas and the member, and Sunday 22 Nov, 11:00 at [Library café], Aarhus harbour with a yes from Sofie and Ahmed
      When the planner opens
      Then it reads Plan the meetup and Voting closes Tuesday 18:00
      And Saturday 21 Nov, 14:00 is Leading with 3 yes, and Sunday 22 Nov, 11:00 has 2 yes
      And Suggest another time (1 spot left) and Done voting can be pressed
      And the rules end with Press and hold an option to report it.

    Scenario: A yes and a yes taken back move the lead
      Given a member planning a meetup, with their yes on Saturday 21 Nov, 14:00 only
      When they press Yes on Sunday 22 Nov, 11:00
      Then Sunday has 3 yes and Saturday stays Leading, as the earlier time
      When they press Yes on Saturday again
      Then Saturday has 2 yes and Sunday 22 Nov, 11:00 is Leading

    Scenario: Done voting returns to the pod
      Given a member planning a meetup, on the pod page
      When they press Plan the meetup and then Done voting
      Then the pod page shows again, with the pod's name brætspil

    Scenario: A pod with no options yet
      Given a member of a confirmed pod on Sunday 15 November, with no options yet
      When the planner opens
      Then it says No times yet. Suggest a time and a public place, and the others can vote on it.
      And Suggest a time (3 spots left) and Back to the pod can be pressed
      And the rules say nothing about reporting

    Scenario: The planner in Danish
      Given a member planning a meetup whose app is in Danish
      When the planner opens
      Then it reads Planlæg mødet, Afstemningen lukker tirsdag kl. 18.00 and Lørdag 21. nov. kl. 14.00 with Fører
      And Foreslå et nyt tidspunkt (1 ledig plads) and Færdig med at stemme can be pressed

  how
    decide an option is Leading when it has the most yes votes, the earlier time on a tie, and none leads without a yes
      because the deadline decides the same way (DESIGN §3.5: ties go to the earlier time; plan.tsx)
    decide the voting deadline is a needs-you pill while the member has an option left to vote on, or none exists, and a quiet clock line once they voted on every option
      because the deadline is the member's own to act on only while they still have something to do (blend decision 2, "deadline.ts")
    decide at most three options per pod, the button counting the spots left from all the pod's options
      because the planner asks for 2–3 options, at most 3 per pod (DESIGN §3.5 and the Options row of §4.3)
      because "unknown, confirm with the owner: the extra round allows three new options, as the server counts per round, but the button still counts the first round's options (1 spot left); which is right?"
    decide Done voting, Back to the pod and the back arrow all return to the previous screen, or to the Pods tab when there is none
      because "unknown, confirm with the owner: why opening the planner from a link returns to the Pods tab, not the pod page"
    decide the rules end with the report hint only while another member's option is shown
      because only those can be reported ("PlanOption.tsx": the viewer's own option has no report)
  look
    As the pod-plan storyboard at 390×844: paper page (color.page), side padding space.gutter, blocks 14px apart, 32px from the top.
    Header: the back chevron (size.hit), the title "Plan the meetup" in font.display, type.title, 800, color.text, and under it the deadline:
      a needs-you pill (color.needs.you, a border.hairline color.ink border, radius.pill, a clock icon, type.caption 700) or a quiet line (clock icon, type.caption 700, color.text.secondary).
    The option cards (PlanOption), then the dashed suggest button: size.button.medium tall, radius.pill, border.control dashed color.field,
      a plus, the label in type.label 700 color.text and the spots left in type.label 500 color.text.muted.
    The rules in type.caption.text, color.text.secondary. Done voting pinned at the bottom: full width, size.button, radius.pill, color.primary, color.on.primary.
  copy
    plan.heading        "Plan the meetup"   da "Planlæg mødet"
    plan.votingCloses   "Voting closes {{when}}"   da "Afstemningen lukker {{when}}"
    plan.weekdayAt      "{{day}} {{time}}"   da "{{day}} kl. {{time}}"
    plan.noOptions      "No times yet. Suggest a time and a public place, and the others can vote on it."   da "Ingen tidspunkter endnu. Foreslå et tidspunkt og et offentligt sted, så kan de andre stemme om det."
    plan.suggestFirst   "Suggest a time"   da "Foreslå et tidspunkt"
    plan.suggestAnother "Suggest another time"   da "Foreslå et nyt tidspunkt"
    plan.spotsLeft_one  "({{count}} spot left)"   da "({{count}} ledig plads)"
    plan.spotsLeft_other "({{count}} spots left)"   da "({{count}} ledige pladser)"
    plan.rules          "The option with the most yes votes (at least 3) wins when voting closes, and your yes counts as “I'm coming”. If everyone says yes to one, it's settled right away. If nothing gets 3 yes votes, you get one extra day to add another option."   da "Forslaget med flest ja-stemmer (mindst 3) vinder, når afstemningen lukker, og dit ja tæller som »Jeg kommer«. Siger alle ja til det samme forslag, er det aftalt med det samme. Får intet forslag 3 ja-stemmer, får I én dag ekstra til at komme med et nyt."
    plan.reportHint     "Press and hold an option to report it."   da "Hold et forslag nede for at anmelde det."
    plan.doneVoting     "Done voting"   da "Færdig med at stemme"
    plan.backToPod      "Back to the pod"   da "Tilbage til poden"
    chat.backToPod      "Back to pod"   da "Tilbage til poden"
    common.loadFailed   "This could not be loaded. Try again later."   da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    route    the planner of a pod, "/pod/{podId}/plan"; while the pod is planning it shows the options, otherwise LockedMeetupPlan ("Your meetup")
    shows    the deadline as "Voting closes" with the weekday and time; ExtraPlanningRound while the round is extended; plan.noOptions when there is no option; the suggest button while fewer than 3 options exist
    events   Yes and No on an option send the vote (a second press on the chosen answer takes it back); the suggest button opens SuggestMeetupOption; Done voting (Back to the pod with no options) goes back
  uses PlanOption, ExtraPlanningRound, LockedMeetupPlan, SuggestMeetupOption, MeetupPlanningRules
  children PlanOption, ExtraPlanningRound, LockedMeetupPlan, SuggestMeetupOption, MeetupPlanningRules
  sources
    Code: "apps/mobile/app/pod/[podId]/plan.tsx", "apps/mobile/src/features/pods/deadline.ts", "apps/mobile/src/features/pods/PlanOption.tsx", "apps/mobile/src/features/pods/parts.tsx" (going back), "apps/mobile/src/i18n/en/pod.json", "apps/mobile/src/i18n/da/pod.json"
    Server: "functions/src/callables/pods.ts" ("proposeOption": limits per round; "voteOption")
    Design: DESIGN §3.5, §4.3 (Options), §4.6, F22; blend decision 2 (pull request 5, "Needs you" pills)
    Screens: "apps/mobile/preview/screens.json" pod-plan; driven in the web preview, worlds pod-planning, pod-confirmed, drop-proposal, in English and Danish, on 27 November 2026
```
