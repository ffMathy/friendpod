# Suggest a meetup option

"Suggest a time": a day, a time and a public place picked from the place
search, sent as a new option for the pod to vote on. The day and time fields
and the place search are children of their own.

```ail
node SuggestMeetupOption : flow   level: experience
  why   Any member can put a time and a public place to the vote; picking the
        place from a search of public places means no home address is ever
        typed into the planner (DESIGN §3.5 Proposing, F23).                  <- PlanMeetup
  what
    Scenario: The form opens from the planner
      Given a member planning a meetup
      When they press Suggest another time
      Then Suggest a time opens with Day reading Pick a day, Time reading Pick a time and an empty Place search
      And it says Cafés, bars, libraries, parks and other public places near the pod.

    Scenario: Sending without a day and a time is refused
      Given a member planning a meetup, on Suggest a time
      When they press Suggest this time
      Then the form says Pick a day and a time.

    Scenario: Sending without a place is refused
      Given a member planning a meetup, on Suggest a time with Sunday 22 Nov at 15:00 picked
      When they press Suggest this time
      Then the form says Pick a public place from the list.

    Scenario: A time that has passed is refused
      Given a member planning a meetup on Monday 16 November at 12:00, on Suggest a time
      When they pick the time 08:00 first and then the day Monday 16 Nov, and the place [Café bar name]
      And they press Suggest this time
      Then the form says Pick a time within 14 days, between 08:00 and 22:00.

    Scenario: A suggestion joins the planner
      Given a member planning a meetup with two options, on the planner
      When they press Suggest another time, pick Sunday 22 Nov at 15:00 and the place [Café name], Latin Quarter, and press Suggest this time
      Then the planner shows a third option, Sunday 22 Nov, 15:00 at [Café name], Latin Quarter, Aarhus C
      And there is no button to suggest another time

    Scenario: Close returns to the planner
      Given a member in the extra planning round, on Suggest a time from the planner
      When they press Close
      Then the planner shows again, with No time works yet — add another option

    Scenario: The form once the plan is locked
      Given a member the day before a meetup
      When they open Suggest a time
      Then it says The planner opens once the pod is confirmed.

    Scenario: The form in Danish
      Given a member planning a meetup whose app is in Danish, on Foreslå et tidspunkt
      When they press Foreslå dette tidspunkt
      Then the form says Vælg en dag og et tidspunkt.

  how
    decide the form checks the day and time, then the time window, then the place, and shows the first problem above the button; the server decides
      because the form mirrors the server's checks so most mistakes are caught before sending ("optionForm.ts"; DESIGN §3.5)
    decide a time between 08:00 and 22:00, at most 14 days ahead, and later than now
      because options start within 14 days, between 08:00 and 22:00 (DESIGN §3.5, §4.3)
    decide no free-text place and no "public place" tick: the place is picked from the search
      because public places by construction, and no home address typed into the planner (DESIGN F23)
    decide on success the form closes back to the planner; a refusal from the server shows its message above the button
      because "propose.tsx"; the server refuses a time outside the window, the pod's 3 or the member's 2 options in the round, and a pod that is not planning (DESIGN §4.3, "functions/src/callables/pods.ts")
    decide outside planning the form shows only that the planner opens once the pod is confirmed, also when the plan is already locked
      because "unknown, confirm with the owner: a locked pod is told the planner opens once the pod is confirmed; should it say voting has closed?"
  look
    As the pod-propose storyboard: paper page (color.page), side padding space.gutter.compact, sections 16px apart.
    Header: "Suggest a time" in font.display, type.title.modal, 800, with a size.hit close button at its right.
    The day and time row (MeetupTimePicker), then the place search (MeetupPlacePicker).
    Pinned at the bottom, 28px above the edge: the form's message in type.small.text, 600, color.danger, then "Suggest this time": full width, size.button, radius.pill, color.primary, color.on.primary.
  copy
    plan.proposeTitle   "Suggest a time"   da "Foreslå et tidspunkt"
    plan.propose        "Suggest this time"   da "Foreslå dette tidspunkt"
    plan.errors.DATE    "Pick a day and a time."   da "Vælg en dag og et tidspunkt."
    plan.errors.WINDOW  "Pick a time within 14 days, between 08:00 and 22:00."   da "Vælg et tidspunkt inden for 14 dage mellem kl. 8 og 22."
    plan.errors.PLACE   "Pick a public place from the list."   da "Vælg et offentligt sted fra listen."
    plan.notPlanning    "The planner opens once the pod is confirmed."   da "Planlæggeren åbner, når poden er bekræftet."
    common.close        "Close"   da "Luk"
    errors.WINDOW       "That time isn't possible."   da "Det tidspunkt er ikke muligt."
    errors.LIMIT        "You've reached the limit for this."   da "Du har nået grænsen for dette."
    errors.STATE        "This isn't possible at this stage of the pod."   da "Det er ikke muligt på dette trin i poden."
  binds
    route    "/pod/{podId}/propose", opened from the planner
    route    "/pod/braetspilpodaarhus46/plan" or "/pod/braetspilpodaarhus46/propose"
    state    day: text, time: text, place: a picked place or nothing, starting empty; the form's problem: "DATE" | "WINDOW" | "PLACE" or nothing
    events   Suggest this time checks the form, then sends the option's start and place; on success it goes back; Close goes back
  uses MeetupTimePicker, MeetupPlacePicker, MeetupPlanningRules
  children MeetupTimePicker, MeetupPlacePicker
  sources
    Code: "apps/mobile/app/pod/[podId]/propose.tsx", "apps/mobile/src/features/pods/optionForm.ts", "functions/src/callables/pods.ts", "apps/mobile/src/i18n/en/shell.json" (errors)
    Design: DESIGN §3.5 Proposing, §4.3 Options, F23, D8
    Screens: "apps/mobile/preview/screens.json" pod-propose; driven in the web preview, worlds pod-planning, pod-planning-extended and pod-scheduled, in English and Danish, on 27 November 2026
```
