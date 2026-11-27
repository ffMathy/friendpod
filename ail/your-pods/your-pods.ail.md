# Your pods

The Pods tab: every pod the member is in or is invited to, active ones first
and past ones under them, each as a row that opens the pod.

```ail
node YourPods : flow   level: experience
  why   A member sees all their pods in one list, now and before, and reaches any of them in
        one tap (DESIGN §11: the Pods tab, active and past pods).                            <- Friendpod
  what
    The tab lists the pods the member said yes to or is invited to; a pod they said no to is not listed.
    Active pods (proposed, planning, scheduled, met) come first, past ones (archived, or that did not come together) under them.
    Within each, the pod with the latest answer-by time comes first.
    Each heading carries how many pods it holds; an empty section says so. With no pods at all, the tab says No pods yet instead.
    What each row shows is YourPodsRow. While the pods load the tab shows Loading; if they cannot be loaded it says so in a card.

    Scenario: Active and past pods are listed apart
      Given a member this week with an active sourdough pod and a past bouldering pod
      When the Pods tab opens
      Then it reads Pods, then Active · 1 with sourdough, then Past · 1 with bouldering

    Scenario: No past pods yet
      Given a member with a pod proposal and no earlier pods
      When the Pods tab opens
      Then it reads Active · 1 with brætspil
      And under Past it says No past pods yet.

    Scenario: A member with no pods
      Given a new member with nothing yet
      When the Pods tab opens
      Then it says No pods yet and Your first pod arrives with a Thursday drop. We'll let you know when it's here.
      And there is no Active or Past heading

    Scenario: A row opens its pod
      Given a member this week on the Pods tab
      When they press the sourdough row
      Then the sourdough pod opens, reading 4 people near Aarhus C

    Scenario: A pod said no to leaves the list
      Given a member with a pod proposal, on the Pods tab
      When they open the brætspil row, press Not this time and then Decline this pod
      And they go back to the Pods tab
      Then it says No pods yet

    Scenario: The Pods tab in Danish
      Given a member this week whose app is in Danish
      When the Pods tab opens
      Then it reads Pods, Aktive · 1, Tidligere · 1 and Arkiveret
      And the sourdough row reads Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg

  how
    decide only pods the member said yes to or is invited to; a declined pod disappears
      because "unknown, confirm with the owner: a pod the member declined vanishes from the Pods tab; should it stay under Past?"
    decide active means proposed, planning, scheduled or met; everything else is past
      because a met pod still collects feedback for 7 days, and an archived pod is a past pod (DESIGN §4.6; "apps/mobile/app/(tabs)/pods.tsx")
    decide newest answer-by time first
      because "unknown, confirm with the owner: the list is ordered by the time to answer the proposal, newest first; is that the order wanted, rather than the meetup time?"
    decide the rows are the same as This week's Your pods
      because the tab shows the pods as This week's "Your pods" rows ("apps/mobile/app/(tabs)/pods.tsx")
  look
    Paper page (color.page), side padding space.gutter.compact, space.tab.top above the title, sections space.gap.loose apart; the tab bar under it.
    "Pods" in font.display, type.title, 800, color.text.
    Each section: its heading in type.heading, 700, color.text, the count after " · " in 500, color.text.muted; rows 10px apart under it.
    An empty section's line in type.small.text, color.text.muted.
    No pods at all: a white card (color.surface, border.hairline color.border, radius.card) with a paper panel of one ink seat and three dashed open seats,
      "No pods yet" in font.display, type.headline, 800, and the body in type.body, color.text.secondary.
  copy
    tabs.pods          "Pods"                  da "Pods"
    pods.active        "Active"                da "Aktive"
    pods.past          "Past"                  da "Tidligere"
    pods.noneActive    "No active pods right now."   da "Ingen aktive pods lige nu."
    pods.nonePast      "No past pods yet."     da "Ingen tidligere pods endnu."
    pods.emptyTitle    "No pods yet"           da "Ingen pods endnu"
    pods.emptyBody     "Your first pod arrives with a Thursday drop. We'll let you know when it's here."   da "Din første pod kommer med et torsdagsdrop. Vi giver dig besked, når den er her."
    common.loading     "Loading"               da "Indlæser"
    common.loadFailed  "This could not be loaded. Try again later."   da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    route    the Pods tab, "/pods"
    shows    the member's pod cards whose own answer is yes or invited, by answer-by time, newest first, split into active and past
  uses YourPodsRow
  children YourPodsRow
  sources
    Code: "apps/mobile/app/(tabs)/pods.tsx", "apps/mobile/src/data/docs.ts" (the pod cards, newest answer-by first), "apps/mobile/src/features/drop/parts.tsx" (the section title)
    Design: DESIGN §11 (the Pods tab), §4.6 (pod states)
    Screens: app-pods ("apps/mobile/preview/screens.json"); driven in the web preview, worlds this-week, me-new, drop-proposal, drop-waiting, drop-private, pod-planning, pod-happened, pod-open-proposal and others, in English and Danish, on 27 November 2026
```
