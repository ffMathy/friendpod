# A row on the Pods tab

One pod as a row: who is in it, its colour, its theme in the member's own
words, and where it stands. The same row is This week's "Your pods".

```ail
node YourPodsRow : view   level: experience
  why   A member tells their pods apart at a glance, by colour, theme and the next thing that happens,
        while a pod about a private interest stays quiet (DESIGN §11; pull requests 5 and 6).   <- YourPods
  what
    The theme reads as the member wrote it; a pod without a theme reads Open to anyone.
    Once a pod is confirmed, the row shows up to three other members' initials; before that, a disc with people (a lock for a private pod).
    A pod about a private interest has a lock in place of the colour dot, ink in place of colour, and is announced as Private interest.
    A scheduled meetup within the coming 6 days shows its weekday; further out, a short date (Sat 21 Nov).

    Scenario: A proposal not answered yet
      Given a member with a pod proposal, on the Pods tab
      Then the brætspil row reads New pod · answer by Sat 18:00

    Scenario: A pod waiting for the others
      Given a member waiting for the others, on the Pods tab
      Then the brætspil row reads Waiting for the others · 3 of 5 said yes

    Scenario: A pod planning its meetup
      Given a member planning a meetup, on the Pods tab
      Then the brætspil row reads Planning · vote by Tue 18:00, with the initials M, J and S

    Scenario: A scheduled meetup
      Given a member the day before a meetup, on the Pods tab
      Then the brætspil row reads Saturday 14:00 · [Board game café], Aarhus C

    Scenario: A pod that has met
      Given a member the morning after a meetup, on the Pods tab
      Then the brætspil row reads Met, under Active

    Scenario: A past pod reads Archived
      Given a member this week whose bouldering pod has ended
      Then its row under Past reads bouldering and Archived, with the initials S and K

    Scenario: A pod without a theme
      Given a member with an open pod proposal
      Then the row reads Open to anyone and New pod · answer by Sat 18:00

    Scenario: A private pod stays quiet
      Given a member with a private pod proposal about gravid
      Then the row reads gravid with a lock, and is announced as gravid, Private interest

    Scenario: Rows in Danish
      Given a member waiting for the others, whose app is in Danish
      Then the row reads Venter på de andre · 3 af 5 har sagt ja

  how
    decide the theme in the member's own wording
      because the typed wording is kept for the member's own view and the theme label on their own pod card (DESIGN §5.2 (1))
    decide a pod's colour comes from its theme word, and an open pod's from the pod
      because the founder decided colours come from the word shown, and open-to-anyone pods keep the pod's own (pull request 6)
    decide initials only once the pod is confirmed
      because names and photos appear only once the pod is confirmed (DESIGN §3.4; the pods copy "Names and photos appear once the pod is confirmed.")
    decide no colour on a private pod: a lock, ink and an ink border
      because private items stay quiet (pull request 5; "apps/mobile/src/features/drop/PodRow.tsx")
    decide the weekday alone within the coming 6 days, a date further out
      because within the coming week the weekday is enough ("apps/mobile/src/features/drop/PodRow.tsx")
  look
    A white card (color.surface, border.hairline color.border, radius.card), 14px top and bottom and space.card at the sides, its parts 12px apart in one line.
    On the left the other members' initials in size.badge discs, overlapping 10px, in the pod's deep colour (pod.*.deep) with white letters; before confirmation a disc in the pod's tint (pod.*.tint).
    Then a size.dot dot in the pod's colour (pod.*.base) and the theme in font.display, type.pod.name, 800, color.text; under it the state in type.caption, color.text.muted, on an 18px line.
    A 20px chevron in color.text.muted at the end. A private pod: a border.control color.private.border border, a 14px lock in color.private.fill for the dot, and color.private.fill discs.
  copy
    pods.openToAnyone       "Open to anyone"                 da "Åben for at møde alle"
    pods.privateInterest    "Private interest"               da "Privat interesse"
    pods.rowNew             "New pod · answer by {{dayShort}} {{time}}"   da "Ny pod · svar senest {{dayShort}}. kl. {{time}}"
    pods.rowWaiting         "Waiting for the others · {{accepted}} of {{size}} said yes"   da "Venter på de andre · {{accepted}} af {{size}} har sagt ja"
    pods.rowPlanning        "Planning · vote by {{dayShort}} {{time}}"    da "Planlægges · stem senest {{dayShort}}. kl. {{time}}"
    pods.rowScheduled       "{{day}} {{time}} · {{place}}"   da "{{day}} kl. {{time}} · {{place}}"
    pods.rowScheduledNoPlace   "{{day}} {{time}}"            da "{{day}} kl. {{time}}"
    podState.happened       "Met"                            da "Mødtes"
    podState.archived       "Archived"                       da "Arkiveret"
    podState.dissolved      "Didn't come together"           da "Blev ikke til noget"
  binds
    route    "/pods" (a row on the Pods tab)
    props    a pod card: its theme, whether it is private, its state, the member's own answer, how many said yes of how many, its answer-by time; and, once confirmed, its members and plan
    role     a link named "<theme>. <state line>", with ", Private interest" after the theme of a private pod
    shows    the place as its name and the first part of its address, when the two differ; times as 14:00 in English and 14.00 in Danish
    events   pressing the row opens the pod
  uses PodColors
  sources
    Code: "apps/mobile/src/features/drop/PodRow.tsx", "apps/mobile/src/features/drop/time.ts", "apps/mobile/src/features/drop/color.ts", "apps/mobile/src/i18n/en/drop.json"
    Design: DESIGN §3.4, §5.2 (1), §11
    Screens: driven in the web preview, worlds drop-proposal, drop-waiting, pod-planning, pod-scheduled, pod-happened, this-week, pod-open-proposal, drop-private, in English and Danish, on 27 November 2026
    Pull requests: "https://github.com/ffMathy/friendpod/pull/5", "https://github.com/ffMathy/friendpod/pull/6"
```
