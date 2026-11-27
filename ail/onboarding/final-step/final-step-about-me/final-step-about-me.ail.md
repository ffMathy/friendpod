# Almost done: About me

The optional one-sentence "About me" on step 6, checked as it is typed; Finish saves it. The Me tab shows the same
field with its own Save button.

```ail
node FinalStepAboutMe : view   level: experience
  why   One sentence helps a pod start talking, but before anyone has met it must not carry contact
        details, and it is never used for matching (DESIGN §3.1 step 10, F19).                   <- FinalStep
  what
    The field starts with what the profile holds, takes at most 140 characters, and counts them, as 53 / 140; at 140 the count turns red.
    Line breaks are not part of the text: Return closes the keyboard. An empty field is fine and clears it.
    Contact details or a word not allowed on Friendpod show the reason under the field, and Finish cannot be pressed until it is changed.

    Scenario: About me starts with what the profile holds
      Given a member on the last onboarding step, whose About me reads New in Aarhus, dad of a toddler, always up for a game
      When Almost done opens
      Then About me (optional) holds New in Aarhus, dad of a toddler, always up for a game
      And it counts 53 / 140

    Scenario: Contact details are refused
      Given a member on the last onboarding step, with the pledge ticked
      When they write Call me on 12345678 in About me
      Then the step says No contact details here: you haven't met yet. Share them in person if you like.
      And Finish cannot be pressed

    Scenario: About me in Danish
      Given a member on the last onboarding step whose app is in Danish, whose About me reads Ny i Aarhus, far til en tumling og altid klar på et spil
      Then Om mig (valgfrit) holds that sentence, and it says Vises for medlemmerne af en bekræftet pod. Bruges ikke til matchning.

  how
    decide one sentence of at most 140 characters, shown only to confirmed pod members, never used for matching
      because DESIGN §3.1 step 10 and F19
    decide contact details and words not allowed are refused here at once, and again on the server
      because DESIGN §3.1 step 10: "contact details and blocklisted words are refused"; "apps/mobile/src/features/profile/AboutMeField.tsx": "here for instant feedback and again on the server"
  look
    About me in type.label, 700, color.text, with " (optional)" in 500, color.text.muted; a two-line white (color.surface) input, radius.input, border.control color.field,
      type.body, 12px by 14px padding; border.strong color.link while focused, border.strong color.danger when refused.
    Under it the helper in type.caption, color.text.muted, and on the right the count in type.micro, 600, color.text.muted, color.danger at 140; the reason in type.small, 700, color.danger.
  copy
    aboutMe.label         "About me"   da "Om mig"
    common.optional       "(optional)"   da "(valgfrit)"
    aboutMe.placeholder   "For example: New in town, always up for a long walk"   da "Fx: Ny i byen og altid frisk på en lang gåtur"
    aboutMe.helper        "Shown to confirmed pod members. Not used for matching."   da "Vises for medlemmerne af en bekræftet pod. Bruges ikke til matchning."
    aboutMe.tooLong       "At most {{max}} characters."   da "Højst {{max}} tegn."
    aboutMe.CONTACT_INFO  "No contact details here: you haven't met yet. Share them in person if you like."   da "Ingen kontaktoplysninger her: I har ikke mødt hinanden endnu. Del dem gerne, når I ses."
    aboutMe.BLOCKLIST     "This contains words that aren't allowed on Friendpod."   da "Teksten indeholder ord, der ikke er tilladt på Friendpod."
  binds
    route    "/almost-done" (About me on Almost done)
    state    value: text, starting at the profile's About me or ""
    fields   a text box named "About me (optional)", at most 140 characters
  sources
    Code: "apps/mobile/src/features/profile/AboutMeField.tsx", "apps/mobile/app/(onboarding)/almost-done.tsx", "packages/core" (the About me rules)
    Design: DESIGN §3.1 step 10, F19
    Screens: "apps/mobile/preview/screens.json" onb-final; driven in the web preview, world onboarding-final, in English and Danish, on 27 November 2026
```
