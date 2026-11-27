# How did it go?

The feedback form the morning after a meetup: who was there, a private "meet
again" per person, an optional rating, and Keep pod or Not for me, which send
it all. Nobody but Friendpod sees the answers.

```ail
node MeetupFeedback : flow   level: experience
  why   No-shows, who may meet again and whether the pod meets again are settled from each member's
        private answers, the morning after (DESIGN §3.6, F24, F27, F30).                <- AfterTheMeetup
  what
    Scenario: Not there myself leaves only the pod question
      Given a member the morning after a meetup, on How did it go?
      When they tick I wasn't there myself
      Then the people, Was there, Meet again and How was it overall? are gone
      And it says Then you can skip who came and who to meet again. Just tell us about the pod below.
      And Keep pod and Not for me remain

    Scenario: Keep pod sends the answers and returns to the pod
      Given a member the morning after a meetup, who opened How did it go? from the push
      When they choose 4 for How was it overall? and press Keep pod
      Then the brætspil pod shows, its next step no longer How did it go? but The meetup chat is open

    Scenario: Not for me also sends the answers
      Given a member the morning after a meetup, who opened How did it go? from the push
      When they press Not for me
      Then the brætspil pod shows, its next step The meetup chat is open

    Scenario: A pod the member is not in
      Given a member this week, who is not in the brætspil pod
      When they open How did it go? for the brætspil pod
      Then it says This pod no longer exists., with no questions

    Scenario: The form in Danish
      Given a member the morning after a meetup whose app is in Danish
      When How did it go? opens
      Then it reads Hvordan gik det?, Hvem var der?, Var der, Ses igen and Hvordan var det alt i alt?
      And the buttons read Behold poden and Nej tak

  how
    decide I wasn't there myself is a quiet tick at the right of the Back row; ticked, no attendance and no meet-again answers are sent
      because the page keeps one screen in both languages ("apps/mobile/preview/screens.json", after-feedback; "apps/mobile/app/pod/[podId]/feedback.tsx")
    decide pressing the chosen rating again clears it
      because the rating is optional (DESIGN §3.6 lists a 1–5 rating; "apps/mobile/app/pod/[podId]/feedback.tsx")
    decide Keep pod and Not for me each send everything at once, then go back, or to the pod when there is nothing to go back to
      because "unknown, confirm with the owner: should there be a thank-you or a confirmation after sending, as today it just leaves the form?"
    decide sending feedback twice is possible: nothing on the form says it was already given
      because "unknown, confirm with the owner: should How did it go? say the answers were sent when it is opened again from the push?"
  look
    Paper page (color.page), side padding space.gutter.compact, blocks 14px apart, 28px above the Back row; no tab bar.
    Back row: a size.hit chevron on the left; at its right edge the quiet tick: a 20px box (radius.checkbox family, border.control color.field,
      filled color.primary with a white tick when ticked) and "I wasn't there myself" in type.caption, 700, color.text.secondary.
    Title "How did it go?" in font.display, type.title, 800, color.text; under it the privacy line in type.small, color.text.secondary.
    Then the Who was there? card (WhoWasThere).
    How was it overall?: heading in type.label, 700, color.text; five equal size.hit choices 8px apart, radius.pill, numbers in type.label, 700:
      white (color.surface) with a border.control color.border.strong border, the chosen one color.ink with color.on.ink text.
    Meet this pod again?: a white card (color.surface, border.hairline color.border, radius.card, 16px sides), heading in type.label, 700, its text in
      type.caption.text, color.text.secondary, then Keep pod (color.primary, color.on.primary) and Not for me (white, border.control color.border.strong,
      color.text) side by side, size.button.medium tall, radius.pill, type.button 700, 8px apart, their widths 1.4 to 1.
    Without the pod: the title, the privacy line and a white card saying the pod no longer exists in type.body.small, color.text.secondary.
  copy
    common.back                  "Back"                                                          da "Tilbage"
    feedback.heading             "How did it go?"                                                da "Hvordan gik det?"
    feedback.private             "Only Friendpod sees your answers. Nobody is told what you said."   da "Kun Friendpod ser dine svar. Ingen får at vide, hvad du har svaret."
    feedback.notThereMyself      "I wasn't there myself"                                         da "Jeg var der ikke selv"
    feedback.notThereMyselfBody  "Then you can skip who came and who to meet again. Just tell us about the pod below."   da "Så kan du springe over, hvem der kom, og hvem du vil ses med igen. Fortæl os bare om poden herunder."
    feedback.rating              "How was it overall?"                                           da "Hvordan var det alt i alt?"
    feedback.ratingValue         "{{n}} of 5"                                                    da "{{n}} ud af 5"
    feedback.keepTitle           "Meet this pod again?"                                          da "Vil du mødes med poden igen?"
    feedback.keepBody            "If at least 3 of you choose Keep, the pod plans its next meetup with just those people."   da "Vælger mindst 3 af jer »Behold poden«, planlægger poden næste møde kun med jer, der vil fortsætte."
    feedback.keep                "Keep pod"                                                      da "Behold poden"
    feedback.notForMe            "Not for me"                                                    da "Nej tak"
    pod.gone                     "This pod no longer exists."                                    da "Denne pod findes ikke længere."
  binds
    state    met: boolean, starting at true; rating: 1 to 5 or nothing, starting at nothing
    role     the rating is a radio group named "How was it overall?", each choice a radio named "{{n}} of 5"; I wasn't there myself is a checkbox
    events   Keep pod or Not for me sends { met, notThere: the unticked people when met, else none, meetAgain: the answered people who were there when met,
             rating when met and chosen, keep: true for Keep pod }; both buttons wait while it is sent, then the form goes back, or to the pod
  uses WhoWasThere
  children WhoWasThere
  sources
    Code: "apps/mobile/app/pod/[podId]/feedback.tsx", "apps/mobile/src/features/after/parts.tsx", "apps/mobile/src/features/pods/feedbackSent.ts", "packages/core/src/pods/nextStep.ts"
    Design: DESIGN §3.6, §4.4, F24, F27, F30; "apps/mobile/preview/screens.json" after-feedback
    Screens: driven in the web preview, worlds pod-happened and this-week, in English and Danish, on 27 November 2026
```
