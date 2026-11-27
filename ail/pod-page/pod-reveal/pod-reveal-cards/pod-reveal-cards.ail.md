# Pod reveal: the cards and the footer

What the reveal shows under its field: the members' own sentences, the
interests more than one of them shares, the folded safety tips, the extra
round's alert, and "Plan the meetup" with the viewer's deadline.

```ail
node PodRevealCards : view   level: experience
  why   Right after confirmation, members get something to talk about and a safe way to meet,
        and the one thing to do next is to plan the meetup by the deadline (DESIGN §3.4, §4.5). <- PodReveal
  what
    Scenario: The shared interests wear their own colours
      Given a member of a confirmed pod, brætspil, whose pod shares sourdough, coffee and hiking
      When they open the brætspil pod
      Then More than one of you also likes shows sourdough in Solsikke, coffee in Bær and hiking in Blomme
      And no In their own words card is shown, since nobody wrote one

    Scenario: The deadline is a needs-you pill while there is no option
      Given a member of a confirmed pod with no options yet, planning until Tuesday 18:00
      When they open the brætspil pod
      Then Pick a time by Tuesday 18:00 is a needs-you pill under Plan the meetup

    Scenario: Once every option has the viewer's vote, the deadline is quiet
      Given a member in the extra planning round, having voted on every option, until Wednesday 18:00
      When they open the brætspil pod
      Then Voting closes Wednesday 18:00 is a quiet line with a clock under Plan the meetup

  how
    decide another interest in the pod's own colour is drawn as a plain chip on the pod's screens
      because the pod's colour is reserved there (decision 9; PodColors' clash rule)
    decide In their own words lists only the other members who wrote a sentence, and is left out when none did
      because "about me" is optional and shown to confirmed members only (DESIGN F19, "apps/mobile/src/features/pods/PodMembers.tsx")
    decide Meeting safely starts folded, its summary row being the button
      because the storyboard pod-confirmed draws it as one row ("apps/mobile/src/features/pods/parts.tsx", SafetyCard)
  look
    Under the foot, space.gutter.compact from the sides, 14px apart, white cards (color.surface, border.hairline color.border, radius.card,
      padding 14px 16px): "In their own words" (type.card.title, 700) with a 32px avatar beside each member's bold first name and
      sentence in type.small.text, color.text.secondary; "More than one of you also likes" with its chips (size.chip, radius.pill,
      each in its own colour's tint with a dot of its base, or drawn plain, without a colour, when it clashes);
      "Meeting safely": a 48px row with a shield, the words in type.body, 600, and a chevron that points down, up when open; open,
      the tips in type.caption.text, color.text.secondary and "All safety tips" as a small link in color.link.
    The extra round's alert above the cards: a needs-you banner (color.needs.you marker with a color.ink ring, a clock) with its
      title in type.body, 700 and its text in type.small.text.
    Pinned at the foot over the tab bar: "Plan the meetup" full width, size.button tall, color.primary, radius.pill, type.button,
      700, color.on.primary; 12px under it, centred, the deadline: a needs-you pill (color.needs.you, a border.control color.ink
      border, a clock, type.caption, 700, color.on.needs.you) or a quiet line (a clock and type.caption, 600, color.text.muted).
  copy
    pod.inTheirWords    "In their own words"                    da "Med deres egne ord"
    pod.alsoLikes       "More than one of you also likes"       da "Flere af jer kan også lide"
    pod.safety.title    "Meeting safely"                        da "Mød hinanden trygt"
    pod.safety.body     "Meet in a public place in daytime or early evening. Arrange your own transport and tell a friend where you're going. You can leave at any time. Never share your home address. In an emergency, call 112."   da "Mød hinanden et offentligt sted, i dagtimerne eller tidligt på aftenen. Sørg selv for transport, og fortæl en ven, hvor du skal hen. Du kan altid gå, når du vil. Del aldrig din hjemadresse. Ring 112, hvis det er akut."
    pod.safety.more     "All safety tips"                       da "Alle sikkerhedsråd"
    pod.planTheMeetup   "Plan the meetup"                       da "Planlæg mødet"
    pod.pickTimeBy      "Pick a time by {{when}}"               da "Find et tidspunkt senest {{when}}"
    pod.voteBy          "Vote by {{when}}"                      da "Stem senest {{when}}"
    plan.votingCloses   "Voting closes {{when}}"                da "Afstemningen lukker {{when}}"
    plan.weekdayAt      "{{day}} {{time}}"                      da "{{day}} kl. {{time}}"
    plan.extendedTitle  "No time works yet — add another option"   da "Intet tidspunkt passer endnu – tilføj et forslag mere"
    plan.extendedBody   "You have one more day, until {{when}}. If no option gets 3 yes votes by then, the pod ends."   da "I har én dag mere, indtil {{when}}. Hvis intet forslag får 3 ja-stemmer inden da, stopper poden."
  binds
    shows    the deadline as pod.pickTimeBy while the pod has no option, pod.voteBy while an option lacks the viewer's vote, else plan.votingCloses; the time as the weekday and the clock in Copenhagen time ("Tuesday 18:00", "tirsdag kl. 18.00")
    shows    the extra round's alert while the planning round is extended
    state    safetyOpen: boolean, starting at false
  uses PodColors
  sources
    Code: "apps/mobile/app/pod/[podId]/index.tsx" (planning), "apps/mobile/src/features/pods/PodMembers.tsx", "apps/mobile/src/features/pods/parts.tsx", "apps/mobile/src/features/pods/deadline.ts", "apps/mobile/src/features/pods/time.ts"
    Screens: driven in the web preview on 27 November 2026, worlds pod-confirmed, pod-planning, pod-planning-extended, pod-private-confirmed
```
