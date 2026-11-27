# Add an interest

The add row at the top of the Interests tab: one field for an interest in the
member's own words and an Add button, and the one message that answers the
last attempt. The phone checks the text before anything is sent.

```ail
node AddInterest : flow   level: experience
  why   Members describe what they care about in their own words, and the phone refuses contact
        details and someone else's sensitive situation before anything leaves it
        (DESIGN §3.1 step 8, §5.2 (0)).                                                 <- Interests
  what
    Pressing Enter in the field adds, like Add. The field takes at most 80 characters.
    While an interest is being added, Add shows a spinner and cannot be pressed.
    A new message replaces the last one; a refused text stays in the field so it can be reworded.
    What only the server decides (an interest already held, the limit of 20, the blocklist, a private interest, Did you mean) is AddInterestAnswers.

    Scenario: A new interest is added at the end of the list
      Given a member this week with 5 interests
      When they type climbing and press Add
      Then the tab says Added.
      And climbing is last under Interests, and the count reads 6 of 20
      And the field is empty

    Scenario: An interest of one character is refused
      Given a member this week on the Interests tab
      When they type a and press Add
      Then the tab says An interest needs at least 2 characters.
      And the field still holds a, and the count still reads 5 of 20

    Scenario: An interest of more than 40 characters is refused
      Given a member this week on the Interests tab
      When they type 41 letters and press Add
      Then the tab says An interest can have at most 40 characters.

    Scenario: Contact details are refused
      Given a member this week on the Interests tab
      When they type call me 12345678 and press Add
      Then the tab says Interests cannot contain contact details such as phone numbers, emails, links or handles.
      And the field still holds call me 12345678, and the count still reads 5 of 20

    Scenario: Someone else's sensitive situation is refused
      Given a member this week on the Interests tab
      When they type min datters diabetes and press Add
      Then the tab says This seems to describe someone else's sensitive situation. Describe your own instead, for example “parent of an autistic child”.
      And the count still reads 5 of 20

    Scenario: Adding in Danish
      Given a member this week whose app is in Danish
      When they type klatring and press Tilføj
      Then the tab says Tilføjet. and the count reads 6 af 20
      When they type a and press Tilføj
      Then the tab says En interesse skal have mindst 2 tegn.

  how
    decide the text is checked on the phone first: its length after tidying, then contact details, then the model, then someone else's situation
      because nothing that would be refused should leave the phone (DESIGN §5.2 (0); "apps/mobile/src/features/interests/onDeviceCheck.ts")
    decide the phone does not check the blocklist; only the server refuses a blocked text
      because "unknown, confirm with the owner: DESIGN §5.2 (0) says the phone runs the blocklist too, but the app's device check skips it; should it?"
    decide a refused text stays in the field and an added one clears it
      because the member can reword what was refused ("apps/mobile/src/features/interests/InterestManager.tsx": "A rejection keeps the text")
    decide a refusal on the phone says nothing was sent, and the server's own refusal says only that it was not saved
      because the text did reach the server in the second case, so "Nothing was sent" would be untrue (InterestManager.tsx)
    decide no prompt when a member with consent adds a sensitive interest
      because with the consent there is no prompt per tag, only a lock (DESIGN F18)
  look
    One row, space.gap.loose under the title: a size.input white (color.surface) field with a border.field color.field border and radius.input,
      its placeholder "Add an interest" in type.body, color.text.muted; 8px right of it the Add button, size.input tall, radius.input,
      color.primary with "Add" in type.button, 700, color.on.primary.
    "Added." as a quiet status under it: a 14px check and type.caption, 700, color.text.secondary.
    Every other message in a white note (color.surface, border.hairline color.border, radius.lg) with an info icon and type.caption.text, color.text.secondary.
  copy
    interests.fieldLabel          "Add an interest in your own words"     da "Tilføj en interesse med egne ord"
    interests.placeholder         "Add an interest"                       da "Tilføj en interesse"
    interests.add                 "Add"                                   da "Tilføj"
    interests.added               "Added."                                da "Tilføjet."
    moderation.TAG_TOO_SHORT      "An interest needs at least 2 characters."   da "En interesse skal have mindst 2 tegn."
    moderation.TAG_TOO_LONG       "An interest can have at most 40 characters."   da "En interesse kan højst have 40 tegn."
    moderation.PII                "Interests cannot contain contact details such as phone numbers, emails, links or handles."   da "Interesser må ikke indeholde kontaktoplysninger som telefonnumre, e-mails, links eller brugernavne."
    moderation.THIRD_PARTY_SENSITIVE   "This seems to describe someone else's sensitive situation. Describe your own instead, for example “parent of an autistic child”."   da "Det ser ud til at handle om en andens følsomme situation. Beskriv din egen i stedet, fx »forælder til et barn med autisme«."
  uses AddInterestAnswers, InterestRules
  children AddInterestAnswers
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx", "apps/mobile/src/features/interests/useAddInterest.ts", "apps/mobile/src/features/interests/onDeviceCheck.ts", "apps/mobile/src/features/interests/parts.tsx", "functions/src/interests/pipeline.ts", "functions/src/interests/persist.ts"
    Design: DESIGN §3.1 step 8, §5.2 (0)–(5), F18, F38, A21; PRIVACY §4.3 (third parties)
    Screens: driven in the web preview, world this-week, in English and Danish, on 27 November 2026; "apps/mobile/preview/runtime/callables.ts" (the preview's server adds every text)
```
