# Me: About me

"About me" on Me: the one optional sentence pod members see, editable in
place. Save shows only once the text differs from what is saved; then a quiet
"Saved.".

```ail
node MeAboutMe : view   level: experience
  why   One optional sentence lets pod members know a little about each other before they meet,
        without ever being used for matching or carrying contact details (DESIGN §3.1 step 10, F19).   <- Me
  what
    Scenario: The saved sentence, and no Save until it changes
      Given a member this week
      When Me opens
      Then About me (optional) holds New in Aarhus, dad of a toddler, always up for a game, counted 53 / 140
      And there is no Save button

    Scenario: A changed sentence is saved
      Given a member this week, on Me
      When they write Board games and long walks in About me
      Then it counts 26 / 140 and Save shows
      When they press Save
      Then it says Saved. and Save is gone

    Scenario: Contact details are refused
      Given a member this week, on Me
      When they write Call me on 12345678 in About me
      Then it says No contact details here: you haven't met yet. Share them in person if you like.
      And Save cannot be pressed

    Scenario: About me in Danish
      Given a member this week whose app is in Danish, on Me
      When they write Ring på 12345678 in Om mig (valgfrit)
      Then it says Ingen kontaktoplysninger her: I har ikke mødt hinanden endnu. Del dem gerne, når I ses.

  how
    decide at most 140 characters, typing stops there, and the counter turns red when full
      because "about me" is one sentence of up to 140 characters (DESIGN §3.1 step 10, §4.3)
    decide contact details and words that are not allowed are refused here at once and again on the server, with no send anyway
      because the sentence is shown to strangers before anyone has met (DESIGN F19, §4.3; "packages/core/src/profile/aboutMe.ts")
    decide line breaks and runs of spaces are folded into one space; an empty field clears the sentence
      because it is one sentence ("packages/core/src/schemas/profile.ts", "apps/mobile/src/features/profile/AboutMeField.tsx")
    decide Save appears only while the text differs from what is saved, then a quiet Saved. with a check
      because nothing here needs the member until they change it; Saved. is a calm fact, not an action ("apps/mobile/src/features/shell/AboutMeCard.tsx")
    decide the field is three lines tall on Me, two in onboarding
      because on Me the whole sentence should read back ("apps/mobile/src/features/shell/AboutMeCard.tsx")
  look
    No card: the field sits on the page. Label "About me" in type.label, 700, color.text with " (optional)" in 500, color.text.muted; at the right "53 / 140" in type.micro, 600, color.text.muted (color.danger when full).
    A three-line white input (color.surface, border.control color.field, radius.input) in type.body, color.text; focused border.strong color.link; refused border.strong color.danger.
    Under it the helper in type.caption.text, color.text.muted, then a refusal in type.small, 700, color.danger.
    Save: a small filled button at the right (size.button.small, radius.pill, color.primary, color.on.primary text). Saved.: a check and the word in type.caption, 600, color.text.secondary.
  copy
    aboutMe.label         "About me"                                    da "Om mig"
    common.optional       "(optional)"                                  da "(valgfrit)"
    aboutMe.placeholder   "For example: New in town, always up for a long walk"   da "Fx: Ny i byen og altid frisk på en lang gåtur"
    aboutMe.helper        "Shown to confirmed pod members. Not used for matching."   da "Vises for medlemmerne af en bekræftet pod. Bruges ikke til matchning."
    aboutMe.tooLong       "At most {{max}} characters."                 da "Højst {{max}} tegn."
    aboutMe.CONTACT_INFO  "No contact details here: you haven't met yet. Share them in person if you like."   da "Ingen kontaktoplysninger her: I har ikke mødt hinanden endnu. Del dem gerne, når I ses."
    aboutMe.BLOCKLIST     "This contains words that aren't allowed on Friendpod."   da "Teksten indeholder ord, der ikke er tilladt på Friendpod."
    aboutMe.save          "Save"                                        da "Gem"
    aboutMe.saved         "Saved."                                      da "Gemt."
  binds
    state    text: text, starting at the saved sentence or ""
    fields   a text box named "About me", at most 140 characters, Return closes the keyboard
    shows    the counter as the number of characters typed / 140
    events   Save sends the folded text as the new sentence; while it is being saved the button shows it is busy; a failure shows its error under the field
  sources
    Code: "apps/mobile/src/features/shell/AboutMeCard.tsx", "apps/mobile/src/features/profile/AboutMeField.tsx" (the checks), "packages/core/src/profile/aboutMe.ts", "packages/core/src/schemas/profile.ts" (140)
    Design: DESIGN §3.1 step 10, §4.3, F19, §5.2 (PII); "apps/mobile/preview/screens.json" app-me
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
