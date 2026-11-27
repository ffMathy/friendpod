# Who was there?

The card at the top of "How did it go?": each other member with a tick for
"was there" and, for those who were, a private Yes or No to meeting them again.

```ail
node WhoWasThere : flow   level: experience
  why   Attendance and "meet again" come from each member's own answers: a no-show needs most of
        the others to untick them, and a mutual yes or a single no changes who may be matched
        again (DESIGN §3.6, §4.4, F24, F30).                                            <- MeetupFeedback
  what
    Scenario: Everyone starts ticked and no one has a meet-again answer
      Given a member the morning after a meetup, in the brætspil pod with Mette, Jonas, Sofie and Ahmed
      When How did it go? opens
      Then Mette, Jonas, Sofie and Ahmed are listed under Who was there?, but not the member themself
      And each is ticked as was there, with Yes and No under Meet again, neither chosen
      And I wasn't there myself is not ticked

    Scenario: Unticking someone takes away their meet-again question
      Given a member the morning after a meetup, on How did it go?
      When they untick Jonas was there
      Then Jonas has no Yes and No, and the other three still have theirs
      When they tick Jonas was there again
      Then Jonas has Yes and No again

    Scenario: A meet-again answer can be taken back
      Given a member the morning after a meetup, on How did it go?
      When they press Yes for Mette
      Then Yes for Mette is chosen, drawn in ink
      When they press it again
      Then neither Yes nor No is chosen for Mette

    Scenario: The card in Danish
      Given a member the morning after a meetup whose app is in Danish
      When How did it go? opens
      Then it reads Hvem var der?, Var der and Ses igen, with Ja and Nej for each person
      And Mette var der is ticked

  how
    decide every other member starts ticked; the member unticks whoever was missing
      because it is faster, and a no-show still needs a majority of the others' answers (DESIGN F30, §4.4)
    decide meet again is Yes, No or no answer for each person who was there; pressing the chosen answer again clears it
      because no answer is a valid choice: a mutual yes allows a new match after 4 weeks, either no means never again (DESIGN §3.6, F24)
      rejected one checkbox per person, blank meaning no, as the storyboard first drew it, because blank could not mean "not sure"; the redraw awaits the founder's sign-off ("apps/mobile/preview/screens.json", after-feedback)
    decide someone unticked has no meet-again question, and an answer given before unticking is not sent
      because only people who were there can be met again ("apps/mobile/app/pod/[podId]/feedback.tsx")
    decide the avatars are the pod's colour (its deep tone) with the initial, or the member's photo when there is one
      because the form is a calm screen in the pod's colour context ("apps/mobile/preview/screens.json", after-feedback)
  look
    A white card (color.surface, border.hairline color.border, radius.card), 12px top, 16px sides, 14px bottom.
    Head row: "Who was there?" in type.label, 700, color.text, then the column heads "Was there" (56px wide) and "Meet again" (76px wide),
      centred, in type.micro, 700, color.text.muted, sitting on the heading's line.
    One row per other member, at least 46px tall with a border.hairline color.separator line between rows: a 32px round avatar in the pod's deep tone
      (pod.tomat.deep for brætspil) with a white initial, the first name in type.body.small, 600, color.text, one line; then a size.checkbox box
      (radius.checkbox, filled color.primary with a white tick, or white with a border.control color.field border) centred in a size.hit target;
      then Yes and No: two 36px circles 4px apart, white with a border.control color.border.strong border and color.text label in type.caption, 700,
      the chosen one color.ink with color.on.ink text. An unticked person's Meet again cell is empty.
    Under the rows, 8px down, an inset note (color.page, radius.md) with the explainer in type.caption.text, color.text.secondary.
    When I wasn't there myself is ticked, only the heading and the note remain, the note then saying the not-there text.
  copy
    feedback.whoWasThere      "Who was there?"                  da "Hvem var der?"
    feedback.wasThere         "Was there"                       da "Var der"
    feedback.meetAgainColumn  "Meet again"                      da "Ses igen"
    feedback.cameLabel        "{{name}} was there"              da "{{name}} var der"
    feedback.yes              "Yes"                             da "Ja"
    feedback.no               "No"                              da "Nej"
    feedback.meetAgainYes     "Yes, meet {{name}} again"        da "Ja, jeg vil gerne ses med {{name}} igen"
    feedback.meetAgainNo      "No, don't meet {{name}} again"   da "Nej, jeg vil ikke ses med {{name}} igen"
    feedback.explainer        "Everyone is ticked; untick anyone who wasn't there. It only counts as a no-show if most of you do. Meet again: if you both say yes, you can be matched again after 4 weeks. If either of you says no, never again. Not sure? Leave it blank."   da "Alle er krydset af – fjern krydset ved dem, der ikke kom. Det tæller kun som udeblivelse, hvis de fleste af jer gør det. Ses igen: Siger I begge ja, kan I blive matchet igen efter 4 uger. Siger en af jer nej, sker det aldrig. I tvivl? Så spring over."
    member.formerMember       "Former member"                   da "Tidligere medlem"
  binds
    route    "/pod/braetspilpodaarhus46/feedback" (the card at the top of How did it go?)
    props    people: the pod's other members in the pod's order, each with first name (or Former member), photo and colour
    state    notThere: set of people, starting empty; meetAgain: map of person to "yes" | "no", starting empty
    role     each tick is a checkbox named "{{name}} was there"; Yes and No are radios named "Yes, meet {{name}} again" and "No, don't meet {{name}} again";
             the column heads are hidden from screen readers
  sources
    Code: "apps/mobile/app/pod/[podId]/feedback.tsx", "apps/mobile/src/features/after/parts.tsx" (GridCheck, MeetAgainChoice)
    Design: DESIGN §3.6, §4.4, F24, F30; "apps/mobile/preview/screens.json" after-feedback
    Screens: driven in the web preview, world pod-happened (Sunday 22 November 2026, 10:05), in English and Danish, on 27 November 2026
```
