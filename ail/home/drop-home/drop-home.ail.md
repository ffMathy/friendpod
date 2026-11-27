# This week, before the drop

Home on an ordinary day (storyboard drop-home): the next drop on the house poster field, skip or pause, what
the drop will match on, the member's pods, and how matching works.

```ail
node DropHome : flow   level: experience
  why   Between drops Home builds up to Thursday: when the next pod comes, whether the
        member is in, what they will be matched on, and the pods they already have
        (DESIGN §3.2, §4.1).                                                          <- Home
  what
    Your pods lists, in this order, pods the member said yes to that wait for the others (once they pressed Okay)
    and their active pods; the count after it is the active pods and the most a member may have. With none, the
    section is left out.
    Each pod row opens that pod's page.

    Scenario: This week before the drop
      Given a member this week, on Tuesday 10 November 2026 at 12:00 in week 46, with one scheduled sourdough pod on Saturday 14:00 at the [Bakery café] in Frederiksbjerg
      When Home opens
      Then it reads This week and Week 46
      And Next drop Thursday 18:00, in 2 days and 6 hours, and You're in this week
      And Your pods · 1 of 2 active lists sourdough with Saturday 14:00 · [Bakery café], Frederiksbjerg
      And How matching works is the last link

    Scenario: The next drop explains the drop
      Given a member this week, on Home
      When they press the Next drop poster
      Then How matching works opens

    Scenario: A pod row opens its pod
      Given a member this week, on Home
      When they press the sourdough row under Your pods
      Then the sourdough pod's page opens, with Plan and Members

    Scenario: This week in Danish
      Given a member this week whose app is in Danish
      When Home opens
      Then it reads Denne uge, Uge 46, Næste drop, Torsdag kl. 18.00, om 2 dage og 6 timer and Du er med i denne uge
      And Dine pods · 1 af 2 aktive lists sourdough with Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg
      And the last link reads Sådan matcher vi

  how
    decide the poster and its foot are one link, and before the drop it opens How matching works
      because it is drawn as the way to the proposal, but before the drop there is none yet, so Home points it at what the drop is ("apps/mobile/src/features/drop/NextDropCard.tsx")
    decide a pod row's time says the weekday within the coming 6 days, and the short date further out
      because within the coming week the weekday is enough ("apps/mobile/src/features/drop/PodRow.tsx")
    decide the active count leaves out pods that still wait for the others
      because "unknown, confirm with the owner: after Okay a waiting pod is listed under Your pods while the count reads 0 of 2 active; is that intended?"
  look
    Paper page (color.page), no side gutter at the top: the NextDropPoster runs full-bleed from the top edge.
    Under it, side padding space.gutter.compact, 14px down and 14px between the blocks: the participation buttons, the MatchOnCard, Your pods, and the link.
    Your pods: "Your pods" in type.heading, 700, color.text with " · 1 of 2 active" in type.heading, 500, color.text.muted; rows 10px apart.
    A pod row: white (color.surface), radius.card, a border.hairline color.border border (border.control color.private.border for a private pod), padding 14px 16px;
      up to three other members' avatars (28px, overlapping 10px) in the pod's deep tone, or a 36px disc in its tint before the pod is confirmed;
      the pod's size.dot dot (a lock for a private pod) and its name in font.display, type.pod.name, 800; under it the detail in type.caption, color.text.muted; a chevron at the right.
    "How matching works" centred, underlined, bold, color.link.
  copy
    home.yourPods            "Your pods"                                 da "Dine pods"
    home.activeCount         "{{active}} of {{max}} active"              da "{{active}} af {{max}} aktive"
    home.howMatching         "How matching works"                        da "Sådan matcher vi"
    pods.rowNew              "New pod · answer by {{dayShort}} {{time}}" da "Ny pod · svar senest {{dayShort}}. kl. {{time}}"
    pods.rowWaiting          "Waiting for the others · {{accepted}} of {{size}} said yes"   da "Venter på de andre · {{accepted}} af {{size}} har sagt ja"
    pods.rowPlanning         "Planning · vote by {{dayShort}} {{time}}"  da "Planlægges · stem senest {{dayShort}}. kl. {{time}}"
    pods.rowScheduled        "{{day}} {{time}} · {{place}}"              da "{{day}} kl. {{time}} · {{place}}"
    pods.rowScheduledNoPlace "{{day}} {{time}}"                          da "{{day}} kl. {{time}}"
    pods.openToAnyone        "Open to anyone"                            da "Åben for at møde alle"
  binds
    state    acknowledged: set of pod ids whose waiting card got Okay in this session, starting empty (kept by Home)
    events   a pod row opens the pod route "/pod/{podId}"; How matching works opens "/info/how-matching-works"
  uses NextDropPoster, MatchOnCard
  children NextDropPoster, MatchOnCard
  sources
    Code: "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/features/drop/PodRow.tsx", "apps/mobile/src/features/drop/parts.tsx", "apps/mobile/src/features/drop/time.ts", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2, §4.1, §4.3 (two active pods)
    Storyboard: drop-home ("apps/mobile/preview/screens.json": one active pod, the private interest must not appear)
    Screens: driven in the web preview, worlds this-week and pod-confirmed, in English and Danish, on 27 November 2026
```
