# Plan option

One option in the planner: its time, its place with a map link, the faces of
everyone who said yes, and the member's own Yes and No.

```ail
node PlanOption : view   level: experience
  why   Members vote yes or no on each option, and see who already said yes, so
        the pod can settle on a time that works for at least three of them
        (DESIGN §3.5 Voting).                                                 <- PlanMeetup
  what
    Scenario: An option shows its time, its place and who said yes
      Given a member planning a meetup, where Saturday 21 Nov, 14:00 at [Board game café], Aarhus C has a yes from Mette, Jonas and the member
      When the planner opens
      Then the option reads Saturday 21 Nov, 14:00, [Board game café], Aarhus C and Open map
      And it shows the faces M, J and You with 3 yes
      And the member's Yes is ticked and No is not

    Scenario: A second press takes the vote back
      Given a member planning a meetup, with their yes on Saturday 21 Nov, 14:00
      When they press Yes on Saturday 21 Nov, 14:00
      Then neither Yes nor No is ticked on it, and it has 2 yes

    Scenario: No replaces Yes
      Given a member planning a meetup, who has not voted on Sunday 22 Nov, 11:00
      When they press No and then Yes on it
      Then Yes is ticked, No is not, and it has 3 yes

    Scenario: Pressing and holding another member's option reports it
      Given a member planning a meetup, where Sofie suggested Sunday 22 Nov, 11:00
      When they press and hold that option
      Then Report a suggestion opens

  how
    decide the faces of everyone who said yes, in the pod's order, with the member drawn as You, and the count beside them
      because seeing who is in makes the vote social (pod-plan storyboard; "PlanOption.tsx")
    decide the count also includes yes votes of members who have left, while the faces show current members only
      because "unknown, confirm with the owner: the server counts only current members' yes votes, so the planner can show more yes votes than decide; is that intended?"
    decide a second press on the chosen answer takes the vote back
      because "PlanOption.tsx" ("A second tap on the chosen answer takes the vote back"), and the server accepts an empty vote (DESIGN §3.5)
    decide another member's option is reported by pressing and holding the card, or with the screen reader's Report action on its time; the member's own option cannot be reported
      because the card shows only what the storyboard shows, as a chat message is reported ("PlanOption.tsx")
    decide Open map opens the map link stored with the option
      because the option stores a map link built from the place, never asking Google for it (COSTS §3.2, DESIGN F23)
  look
    A white card (color.surface) with a border.hairline color.border border and radius.card, 14px padding (16px at the bottom).
    Top row: the time in type.card.title, 800, color.text; at its right, when it leads, "Leading" in a color.ink pill with color.on.ink text, type.caption 700.
    Place row (at least size.hit tall): a pin in the pod's deep colour, "name, address" in type.small.text, color.text.secondary, and "Open map" as an underlined color.link link at the right.
    Under a border.hairline color.separator rule: up to five size.badge faces overlapping by 10px, each ringed, in the pod's deep colour; the count in type.caption 700, color.text.secondary;
      at the right Yes and No, each size.hit tall, at least 64px wide, radius.pill: white with a border.control color.border.strong border,
      or, when chosen, color.ink with color.on.ink text and a tick before the word.
  copy
    plan.when           "{{date}}, {{time}}"   da "{{date}} kl. {{time}}"
    plan.optionPlace    "{{name}}, {{address}}"   da "{{name}}, {{address}}"
    plan.openMap        "Open map"   da "Åbn kort"
    pod.openMapAt       "Open {{place}} in Maps"   da "Åbn {{place}} i Kort"
    pod.mapFailed       "The map didn't open."   da "Kortet kunne ikke åbnes."
    plan.leading        "Leading"   da "Fører"
    plan.yesVotes_one   "{{count}} yes"   da "{{count}} ja"
    plan.yesVotes_other "{{count}} yes"   da "{{count}} ja"
    plan.yes            "Yes"   da "Ja"
    plan.no             "No"   da "Nej"
    plan.voteYes        "Yes to {{when}}"   da "Ja til {{when}}"
    plan.voteNo         "No to {{when}}"   da "Nej til {{when}}"
    plan.yourVote       "Your vote on {{when}}"   da "Din stemme om {{when}}"
    plan.reportOption   "Report the option at {{place}}"   da "Anmeld forslaget ved {{place}}"
  binds
    route    "/pod/braetspilpodaarhus46/plan" (an option on the planner)
    props    startsAt: time, place: { name: text, address: text, mapUrl: text }, yesVoters: list of { firstName: text, photoVersion: integer? }, yesCount: integer, mine: "yes" | "no" | nothing, leading: boolean, podColor: "solsikke" | "blad" | "baer" | "tomat" | "fjord" | "blomme" | nothing, onVote(vote: "yes" | "no" | nothing), onReport()?
    role     the time is a heading; Yes and No are buttons named "Yes to <time>" and "No to <time>"; Open map is a link named "Open <place> in Maps"
    events   Yes sends yes, or takes the vote back when mine is yes; No likewise; press and hold (450 ms) opens the report sheet for the option, when it is not the member's own
  sources
    Code: "apps/mobile/src/features/pods/PlanOption.tsx", "apps/mobile/app/pod/[podId]/plan.tsx" (yes count, faces), "packages/core/src/pods/lifecycle.ts" (yes votes of current members)
    Design: DESIGN §3.5 Voting, F23; COSTS §3.2 (the map link)
    Screens: pod-plan storyboard; driven in the web preview, world pod-planning, on 27 November 2026
```
