# Same-gender pods

Turning on "Same-gender pods only" opens a sheet that asks for the member's
gender and for their consent to use it, with its own unticked box. Turning it
off asks first, then deletes the gender.

```ail
node SameGenderPods : flow   level: experience
  why   Gender is collected only from those who want same-gender pods, only with its own consent, and
        is used for nothing else (DESIGN §3.1 step 9; PRIVACY §3.6).          <- PodPreferenceFields
  what
    Scenario: Turning on asks for a gender first
      Given a member this week, on Pod preferences, with same-gender pods off
      When they turn on Same-gender pods only
      Then a sheet titled Same-gender pods offers Woman, Man and Non-binary, and says Pick your gender to see how we use it.
      And Turn on same-gender pods cannot be pressed

    Scenario: The consent box must be ticked
      Given a member this week, in the same-gender pods sheet
      When they choose Man
      Then the sheet shows the consent text, starting To give you same-gender pods we need to know your gender.
      And I consent to Friendpod using my gender to form same-gender pods. is not ticked, and Turn on same-gender pods cannot be pressed
      When they tick it and press Turn on same-gender pods
      Then the sheet closes

    Scenario: Cancel closes the sheet
      Given a member this week, in the same-gender pods sheet
      When they press Cancel
      Then the sheet closes and Pod preferences shows

    Scenario: In Danish, the non-binary text is only in English
      Given a member this week whose app is in Danish, in the same-gender pods sheet
      When they choose Nonbinær
      Then the consent text is in English, with Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary.
      And it says Denne tekst findes indtil videre kun på engelsk.

  how
    decide the gender is asked in a sheet with its own unticked consent box, and is sent only together with that consent
      because gender has its own consent (PRIVACY §3.6, DESIGN §3.1 step 9); the consent is recorded with the text's version
    decide the consent text is locked and shown word for word, never translated in the app
      because consent texts are versioned and hashed in the shared rules (DESIGN §11 i18n; "packages/core/src/legal/consent-texts.ts")
    decide Non-binary is offered in Danish with the reviewed English text and a line saying so
      because there is no Danish non-binary text yet; rather than hide the option, the English one is shown and recorded ("apps/mobile/src/features/profile/genderConsent.ts", a marked deviation)
      rejected hiding Non-binary in Danish, as the shared rules' comment asks, because "unknown, confirm with the owner: keep the English fallback until the Danish text is reviewed?"
    decide choosing another gender unticks the consent box
      because the consent is to the text shown for that gender ("apps/mobile/src/features/profile/GenderConsentSheet.tsx")
    decide turning off asks Turn off same-gender pods? (We'll delete your gender everywhere.) with Cancel and Turn off, then deletes the gender at once, without Save
      because withdrawal deletes gender everywhere (PRIVACY §3.6); the question is a system alert, which the web preview cannot show, so no scenario plays it
  look
    A bottom sheet over color.scrim: a white panel (color.surface) with a handle, as tall as its content. The title "Same-gender pods" in font.display, type.headline, 700 with a close cross at the right.
    The genders as size.hit pills, 8px apart, wrapping: chosen color.ink with color.on.ink text, the others color.surface with a border.control color.border.strong border.
    The consent text in type.body, color.text, 12px apart; the English-only line in type.small.text, color.text.secondary; the consent box as a card checkbox (size.checkbox, radius.checkbox).
    Then Turn on same-gender pods (size.button, radius.pill, color.primary; color.disabled with color.disabled.text when it cannot be pressed) and a white secondary Cancel under it, 10px apart.
  copy
    gender.title        "Same-gender pods"                         da "Pods med samme køn"
    gender.question     "Your gender"                              da "Dit køn"
    gender.pick         "Pick your gender to see how we use it."   da "Vælg dit køn for at se, hvordan vi bruger det."
    gender.options.woman      "Woman"        da "Kvinde"
    gender.options.man        "Man"          da "Mand"
    gender.options.nonbinary  "Non-binary"   da "Nonbinær"
    gender.englishOnly  "This text is only available in English for now."   da "Denne tekst findes indtil videre kun på engelsk."
    gender.confirm      "Turn on same-gender pods"                 da "Slå pods med samme køn til"
    common.cancel       "Cancel"                                   da "Annullér"
    prefs.sameGenderOffTitle  "Turn off same-gender pods?"   da "Slå pods med samme køn fra?"
    prefs.sameGenderOffBody   "We'll delete your gender everywhere."   da "Vi sletter dit køn alle steder."
    prefs.turnOff       "Turn off"                                 da "Slå fra"
  binds
    texts    the consent texts "gender-en-v2", "gender-da-v2" and "gender-nonbinary-en-v2" from the locked legal texts, word for word
    state    gender: "woman" | "man" | "nonbinary" or nothing, starting at nothing; consented: boolean, starting at false
    role     a dialog; the genders are a radio group named "Your gender"; the consent is a checkbox named by its text
    events   Turn on same-gender pods sends same-gender pods on with the gender and the consent's proof, then closes the sheet and turns the switch on; a failure shows its error in the sheet
    events   Cancel, the cross or the scrim closes the sheet and leaves the switch off
  sources
    Code: "apps/mobile/src/features/profile/GenderConsentSheet.tsx", "apps/mobile/src/features/profile/genderConsent.ts", "apps/mobile/src/features/profile/PreferencesForm.tsx", "packages/core/src/legal/consent-texts.ts"
    Design: DESIGN §3.1 step 9; PRIVACY §3.6
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
