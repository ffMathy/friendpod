# Pod page about a private interest

A confirmed pod whose theme is a private interest: no colour anywhere (white
and Ink with a lock), photos hidden until each member chooses to show theirs,
and the viewer's own switch for that.

```ail
node PrivatePodPage : flow   level: experience
  why   A private interest is only ever revealed inside a pod about it, and even there a member's photo
        shows only once they choose to show it in that pod (DESIGN §3.4, S6; PRIVACY §3.3).      <- PodPage
  what
    A private pod's page is the reveal or the pod band like any other, with no pod colour: white with an Ink
    border, a lock before the name, the private badge, and member initials on Ink 2. A member's photo shows
    only once they have turned on Show my photo to this pod; the viewer's own switch is on the page, under
    the reveal's foot while planning and at the page's end from the locked plan on.

    Scenario: The private reveal hides photos until shown
      Given a member of a confirmed private pod, gravid, with Line (who shows her photo), Mads, Sara and Nikolaj
      When they open the gravid pod
      Then it reads Confirmed and gravid, with a lock named Private interest, in Ink on white
      And Line shows her photo, and Mads, Sara and Nikolaj show their initials on Ink 2
      And Show my photo to this pod offers In a pod about a private interest, photos stay hidden until each person chooses to show theirs. Yours shows once you turn this on.
      And In their own words shows Line: Moved to Aarhus in the summer, always up for a walk by the water
      And it offers Plan the meetup, with Pick a time by Tuesday 18:00

    Scenario: The private pod the day before its meetup
      Given a member the day before a private meetup, gravid on Saturday 5 Dec at 14:00, the viewer coming and Nikolaj not confirmed
      When they open the gravid pod
      Then the band reads gravid and 5 people near Aarhus C, in Ink on white with the private badge
      And the next step reads The meetup chat is open, with Open chat
      And the plan reads Saturday 5 Dec, 14:00 and You're coming.
      And Members shows Nikolaj hasn't confirmed, and the page ends with Show my photo to this pod

    Scenario: The private reveal in Danish
      Given a member of a confirmed private pod whose app is in Danish
      When they open the gravid pod
      Then it reads Bekræftet, gravid and Vis mit billede i denne pod

  how
    decide a private pod gets no colour: white, Ink and a lock
      because a pod about a private interest stays quiet (decision 1; PodColors)
    decide photos are opt-in per member per pod, and the viewer's own avatar always shows You
      because DESIGN §6.1 S6: in sensitive-themed pods a member's photo is shown only after that member taps "Show my photo to this pod"
    decide the switch stays at the end of the pod band page, after Members
      because it is the member's own privacy control ("app/pod/[podId]/index.tsx": "The photo switch stays")
  look
    Reveal: no field; under the back chevron and "⋯", a white card (color.private.bg) with a border.control color.private.border
      border and radius.hero, padding space.hero: the "Confirmed" pill (color.ink, color.on.ink) with the 96px private mark at the right,
      a 24px lock before the name in font.display, color.text, then a color.separator line and the members, initials on color.private.fill.
    Band: white (color.private.bg) with a border.control color.private.border border, a lock before the name in color.text, the private
      pod badge; the Chat row's disc white with a border.hairline Ink outline; "1 new" in color.ink.
    The switch: a white card (radius.card, border.hairline color.border) with "Show my photo to this pod" in type.body, 600, the hint in
      type.small.text, color.text.secondary, and the switch at the right (color.primary when on, color.track when off).
  copy
    pod.showMyPhoto       "Show my photo to this pod"   da "Vis mit billede i denne pod"
    pod.showMyPhotoHint   "In a pod about a private interest, photos stay hidden until each person chooses to show theirs. Yours shows once you turn this on."   da "I en pod om en privat interesse er billederne skjult, indtil hver enkelt selv vælger at vise sit. Dit eget bliver vist, når du slår det til."
    pods.privateInterest  "Private interest"            da "Privat interesse"
  binds
    state    shown: boolean, from the viewer's pod card, starting at off
    events   the switch shows or hides the viewer's photo to this pod; it cannot be pressed while that is being saved; a failure shows its message under it
  uses PodColors, PodReveal, PodScheduled
  sources
    Code: "apps/mobile/app/pod/[podId]/index.tsx", "apps/mobile/src/features/pods/Reveal.tsx" (PrivateReveal), "apps/mobile/src/features/pods/MemberAvatar.tsx", "apps/mobile/src/features/pods/ScreenCaptureGuard.tsx"
    Design: DESIGN §3.4, §6.1 S6; PRIVACY §3.3, §4.3
    Screens: driven in the web preview on 27 November 2026, worlds pod-private-confirmed and pod-private-scheduled, in English and Danish (screens.json app-pod-private-confirmed, app-pod-private-scheduled)
```
