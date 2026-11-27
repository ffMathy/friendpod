# Interests step: the field

The field and Add on step 4, the answers to an interest that is added or refused, and the standing notice about
sensitive interests under it.

```ail
node InterestsStepField : view   level: experience
  why   Every interest is checked on the phone before anything is sent, so a refused one never
        leaves it, and the member learns at the field what counts as sensitive (DESIGN §3.1 step 8, §5.2, PRIVACY §3.2).   <- InterestsStep
  what
    The field takes at most 80 characters; Add adds what is typed. A refused interest keeps its text in the field, to reword it; an added one empties it.
    Until the phone is ready to check interests the field and Add cannot be used, and it says Getting interests ready on your phone…;
      if the phone cannot run the check, a message says why, with Try again.
    The answers, under the field: Added. for an interest added; a refusal, in a note, for one that is too short, too long, holds contact details,
      describes someone else's sensitive situation, or may be sensitive without the consent. The last one adds Sensitive interests: give consent,
      which opens the private-interests step.
    Under them, always, the standing notice, verbatim from the locked text in the app's language (interest-notice-en-v2, interest-notice-da-v2).

    Scenario: A one-letter interest is refused
      Given a member adding interests
      When they enter a and press Add
      Then the step says An interest needs at least 2 characters.
      And the field still holds a

    Scenario: An interest with a phone number is refused
      Given a member adding interests
      When they enter ring me on 12345678 and press Add
      Then the step says Interests cannot contain contact details such as phone numbers, emails, links or handles.

    Scenario: Someone else's sensitive situation is refused
      Given a member adding interests
      When they enter my brother has diabetes and press Add
      Then the step says This seems to describe someone else's sensitive situation. Describe your own instead, for example “parent of an autistic child”.

    Scenario: The notice and a refusal in Danish
      Given a member adding interests whose app is in Danish
      Then the notice starts Tip: Interesser, der siger noget om dit helbred
      When they enter a and press Tilføj
      Then the step says En interesse skal have mindst 2 tegn.

  how
    decide the checks run on the phone before anything is sent, and the server repeats them
      because DESIGN §3.1 step 8: "everything is checked on the phone first", and §5.2 (0)
    decide a refused interest stays in the field
      because the member can then reword it ("apps/mobile/src/features/interests/InterestManager.tsx")
    decide without the consent, an interest the phone finds sensitive is refused with a way to the consent
      because DESIGN §3.1 step 8 and F18: refused on the device, never sent, with a link to that setting
    decide the notice is the locked text, shown word for word
      because it is part of the consent design (PRIVACY §3.2: the standing notice at the interest field)
  look
    The field: a size.input white (color.surface) input, border.field color.field, radius.input, with the placeholder "Add an interest in your own words" in color.text.muted;
      Add beside it, size.input tall, radius.input, color.primary with color.on.primary text.
    Added. as a small check and type.caption text; a refusal in an info note (color.surface, border.hairline color.border, radius.lg) in type.caption.text, color.text.secondary.
    The notice in the same info note, in type.caption with a 19px line, color.text.secondary.
  copy
    interests.fieldLabel                  "Add an interest in your own words"   da "Tilføj en interesse med egne ord"
    interests.add                         "Add"     da "Tilføj"
    interests.added                       "Added."  da "Tilføjet."
    interests.model.preparing             "Getting interests ready on your phone…"   da "Gør interesser klar på din telefon …"
    common.retry                          "Try again"   da "Prøv igen"
    moderation.TAG_TOO_SHORT              "An interest needs at least 2 characters."   da "En interesse skal have mindst 2 tegn."
    moderation.TAG_TOO_LONG               "An interest can have at most 40 characters."   da "En interesse kan højst have 40 tegn."
    moderation.PII                        "Interests cannot contain contact details such as phone numbers, emails, links or handles."   da "Interesser må ikke indeholde kontaktoplysninger som telefonnumre, e-mails, links eller brugernavne."
    moderation.THIRD_PARTY_SENSITIVE      "This seems to describe someone else's sensitive situation. Describe your own instead, for example “parent of an autistic child”."   da "Det ser ud til at handle om en andens følsomme situation. Beskriv din egen i stedet, fx »forælder til et barn med autisme«."
    moderation.ART9_CONSENT_REQUIRED      "This interest may be sensitive, so we only save it if you've agreed to sensitive interests. Nothing was sent or saved. You can give consent in Settings → Privacy."   da "Interessen kan være følsom, så vi gemmer den kun, hvis du har sagt ja til følsomme interesser. Intet blev sendt eller gemt. Du kan give samtykke under Indstillinger → Privatliv."
    interests.openSensitiveConsent        "Sensitive interests: give consent"   da "Følsomme interesser: giv samtykke"
    interests.thirdPartyWarning           "Added. Please only add interests about yourself."   da "Tilføjet. Tilføj kun interesser om dig selv."
  binds
    state    text: text, starting at ""; message: the last answer or nothing
    fields   the field is named "Add an interest in your own words", at most 80 characters
    shows    the refusal's text from its reason
  uses InterestRules
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx", "apps/mobile/src/features/interests/useAddInterest.ts", "apps/mobile/src/features/interests/onDeviceCheck.ts", "packages/core/src/legal/consent-texts.ts" (the notice)
    Design: DESIGN §3.1 step 8, §5.1, §5.2, F18; PRIVACY §3.2
    Screens: "apps/mobile/preview/screens.json" onb-interests; driven in the web preview, worlds onboarding-interests and onboarding-consent, in English and Danish, on 27 November 2026
```
