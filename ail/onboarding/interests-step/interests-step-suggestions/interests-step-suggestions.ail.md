# Interests step: suggestions

Help on step 4 to say an interest the way others do: "Did you mean …?" after an interest the server can match to a
common one, and the interests popular in the member's launch area, one tap each.

```ail
node InterestsStepSuggestions : view   level: experience
  why   Pods only form when people share the same interest, so the step helps members land on the
        words others use, without ever showing anything private (DESIGN §3.1 step 8, §5.2).    <- InterestsStep
  what
    Did you mean shows after an added interest the server matched to a common one: Yes, same thing joins that one; No, keep it keeps the member's words.
      Either answer closes it, and until it is answered that interest's chip is dashed.
    Popular in shows the area's own chips, in the app's language, leaving out those the member already holds; pressing one adds it like a typed interest.

    Scenario: Did you mean after a longer word
      Given a member adding interests
      When they enter brætspilsaften and press Add
      Then it asks Did you mean brætspil by “brætspilsaften”? Saying yes puts you with more people.
      And it offers Yes, same thing and No, keep it
      When they press Yes, same thing
      Then the question is gone, and brætspilsaften stays among the chips

    Scenario: A popular interest is added with one tap
      Given a member adding interests in Aarhus, whose popular interests are løb, climbing, madlavning and book club
      Then Popular in Aarhus offers løb, climbing, madlavning and book club
      When they press løb
      Then løb is among their chips, and no longer offered under Popular in Aarhus

    Scenario: Suggestions in Danish
      Given a member adding interests whose app is in Danish
      Then Populært i Aarhus offers løb, klatring, madlavning and læseklub

  how
    decide the popular chips are the area's ordinary interests with at least ten holders, never private ones
      because DESIGN §3.1 step 8: "launch-area chips (non-sensitive concepts with ≥ 10 holders in the area)"
    decide Did you mean is a question the member answers, and the interest keeps the member's own words until then
      because saying yes puts the member with more people, and the words stay theirs ("apps/mobile/src/features/interests/InterestManager.tsx"; DESIGN §5.2)
    decide the area's chips stay neutral, without pod colours
      because "apps/mobile/preview/screens.json", onb-interests: "Area chips (Popular in Aarhus) come from areas/aarhus and stay neutral"
  look
    Did you mean: a white card (color.surface, border.hairline color.border, radius.lg) with a small color.needs.you marker ringed in color.text, the question in type.small, color.text,
      the common interest in 700; under it Yes, same thing as a small primary button (color.primary) and No, keep it as a small secondary one, side by side.
    Popular in Aarhus in type.label, 700, color.text, running into its chips, which wrap after it 8px apart: size.tag tall, radius.pill, white with a
      border.control color.border.strong outline, a plus, type.chip 600 color.text.
  copy
    interests.didYouMean       "Did you mean <b>{{label}}</b> by “{{typed}}”? Saying yes puts you with more people."   da "Mente du <b>{{label}}</b> med »{{typed}}«? Siger du ja, kan vi matche dig med flere."
    interests.useSuggestion    "Yes, same thing"   da "Ja, samme ting"
    interests.keepOwnWording   "No, keep it"       da "Nej, behold den"
    interests.popularIn        "Popular in {{area}}"   da "Populært i {{area}}"
    interests.addNamed         "Add {{name}}"      da "Tilføj {{name}}"
  binds
    state    suggestion: { the interest, the common one's name, what was typed } or nothing
    role     each popular chip a button named "Add løb"
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (onboarding mode), "apps/mobile/src/features/interests/parts.tsx" (the Did you mean card)
    Design: DESIGN §3.1 step 8, §5.2
    Screens: "apps/mobile/preview/screens.json" onb-interests (typing brætspilsaften answers with brætspil); driven in the web preview, world onboarding-interests, in English and Danish, on 27 November 2026
```
