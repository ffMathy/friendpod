# Member sheet

A bottom sheet over the pod for one member of a confirmed pod: who they are
in this pod, and Block and Report, each with what it does under it. Block's
confirmation is a child.

```ail
node MemberSheet : flow   level: experience
  why   Block and report are one tap from any member, in every confirmed pod, current or past, so
        nobody has to keep meeting or matching with someone they don't feel safe with
        (DESIGN §3.7, F28).                                                              <- AfterTheMeetup
  what
    Scenario: The sheet of a member in an active pod
      Given a member the morning after a meetup, while the meetup chat is still open
      When they open Jonas's sheet
      Then it shows Jonas, In your brætspil pod, with the brætspil pod chip
      And Block Jonas says You'll never be matched again. Jonas is taken out of this pod and only sees that the pod changed.
      And Report Jonas says Jonas won't know who reported. Reports can pause someone from matching.
      And under them: Want to leave instead? You can leave the pod from its menu at any time.

    Scenario: The sheet of a member in a private pod
      Given a member of a confirmed private pod about gravid, where Line has chosen to show her photo
      When they open Line's sheet
      Then it shows Line with her photo and the private gravid chip with its lock, named Private
      And About me reads Moved to Aarhus in the summer, always up for a walk by the water
      And it has Block Line and Report Line

    Scenario: The member's own sheet
      Given a member the morning after a meetup
      When they open their own sheet
      Then it shows Emil and That's you, with no Block and no Report

    Scenario: Report opens the report for that member
      Given a member the morning after a meetup, on Jonas's sheet
      When they press Report Jonas
      Then Report Jonas opens, with What happened?

    Scenario: A pod the member is not in
      Given a member this week, who is not in the brætspil pod
      When they open Jonas's sheet in the brætspil pod
      Then it shows Former member and This pod no longer exists., with no Block and no Report

    Scenario: The sheet in Danish
      Given a member the morning after a meetup whose app is in Danish
      When they open Jonas's sheet
      Then it reads I din pod om brætspil, Bloker Jonas and Anmeld Jonas
      And Close is named Luk

  how
    decide a pod counts as active while it is proposed, planning or scheduled, or has happened and its chat is still open; only then does Block say the member is taken out, and the leave note shows
      because inside an active pod the two cannot stay together: the app's rules cannot hide one member's messages from another (DESIGN §3.7)
    decide Report's line says reports can pause someone from matching, not that a person reviews it
      because nobody reads reports (DESIGN F17), so the storyboard's "A person on our team reviews it" would not be true ("apps/mobile/preview/screens.json", after-member)
    decide in a private pod the chip stays quiet: white with a lock, no pod colour, and a photo shows only if that member chose to show it
      because private interests are only revealed inside their pod, and photos stay hidden there until each person shows theirs (DESIGN §6.1 S6, A25; "apps/mobile/preview/screens.json", app-member-private)
    decide About me is shown on the sheet, but not while Block is being confirmed
      because "unknown, confirm with the owner: About me disappears during the block confirmation; is that intended?"
    decide someone no longer in the roster is shown as Former member and named this person in the buttons
      because the pod record keeps no name for someone who left ("apps/mobile/app/pod/[podId]/member/[uid].tsx")
  look
    The pod stays under a color.scrim; pressing the scrim closes the sheet. The sheet: white (color.surface) at the bottom, radius.hero top corners,
      a 36×5px color.border.strong handle 12px from its top, side padding space.gutter.compact, its blocks 20px apart; it scrolls when taller than the screen.
    MemberSheetHeader on top, then, 18px apart, Block (BlockConfirmation) and Report: Report is a full-width size.button outline button,
      radius.pill, border.control color.danger, a flag icon and its label in color.danger, type.button 700, with its line 8px under it
      in type.caption.text, color.text.secondary.
    In an active pod, the leave note under a border.hairline color.separator line, 14px above it, in type.caption.text, color.text.secondary.
  copy
    member.reportName         "Report {{name}}"     da "Anmeld {{name}}"
    member.reportBody         "{{name}} won't know who reported. Reports can pause someone from matching."   da "{{name}} får ikke at vide, hvem der har anmeldt. En anmeldelse kan sætte en person på pause fra matchning."
    member.reportBodyUnknown  "They won't know who reported. Reports can pause someone from matching."   da "Personen får ikke at vide, hvem der har anmeldt. En anmeldelse kan sætte en person på pause fra matchning."
    member.leaveNote          "Want to leave instead? You can leave the pod from its menu at any time. The others only see “A member left”."   da "Vil du hellere selv gå? Du kan altid forlade poden fra dens menu. De andre ser kun, at et medlem er gået."
    pod.gone                  "This pod no longer exists."   da "Denne pod findes ikke længere."
  binds
    route    the pod's member route, with the pod and the member; drawn over the pod, without a header
    events   Report opens the report with the pod and the member; Close, or the scrim, goes back, or to the pod when there is nothing to go back to
  uses MemberSheetHeader, BlockConfirmation
  children MemberSheetHeader, BlockConfirmation
  sources
    Code: "apps/mobile/app/pod/[podId]/member/[uid].tsx", "apps/mobile/src/features/after/parts.tsx" (BottomSheet), "apps/mobile/src/components/Chip.tsx"
    Design: DESIGN §3.7, F17, F28, A25, §6.1 S6; "apps/mobile/preview/screens.json" after-member, app-member-private
    Screens: driven in the web preview, worlds pod-happened, pod-private-confirmed and this-week, in English and Danish, on 27 November 2026
```
