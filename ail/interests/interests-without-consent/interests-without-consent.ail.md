# Interests without consent to private interests

The Interests tab of a member who said no (or not yet) to private interests:
the private card is Off, carries the standing notice and a way to agree, and
any interest that would be private is refused on the phone, with nothing sent.

```ail
node InterestsWithoutConsent : flow   level: experience
  why   Saying no to private interests keeps the app usable; it only means interests like these are
        not saved, and possibly sensitive text never leaves the phone (DESIGN F18, §5.2 (0); PRIVACY §3.8). <- Interests
  what
    Without the consent, a text the phone finds sensitive, or an interest the member asks to keep private, is refused on the phone and nothing is sent.
    The refusal says so and offers Sensitive interests: give consent; the text stays in the field.
    The private card says Off, carries the standing notice about sensitive interests word for word, and ends with Agree to sensitive interests.
    How private interests work is not shown while the card is Off.

    Scenario: The private card is Off
      Given a member without private-interest consent
      When the Interests tab opens
      Then the card Private interests says Off
      And it reads Tip: interests that say something about your health, beliefs, sexuality, politics, ethnic origin or union membership are only saved if you have agreed to sensitive interests (Settings → Privacy). We then keep them private and use them only as a pod's theme. Only add things about yourself.
      And it ends with Agree to sensitive interests
      And there is no How private interests work

    Scenario: A sensitive interest is refused on the phone
      Given a member without private-interest consent, with 4 interests
      When they type gravid and press Add
      Then the tab says This interest may be sensitive, so we only save it if you've agreed to sensitive interests. Nothing was sent or saved. You can give consent in Settings → Privacy.
      And it offers Sensitive interests: give consent
      And the field still holds gravid, and the count still reads 4 of 20

    Scenario: Keep this private is refused without the consent
      Given a member without private-interest consent
      When they press More for sourdough and then Keep this private
      Then the tab says This interest may be sensitive, so we only save it if you've agreed to sensitive interests. Nothing was sent or saved. You can give consent in Settings → Privacy.
      And sourdough is still under Interests, and no Private interests card lists it

    Scenario: The refusal leads to the consent
      Given a member without private-interest consent whose interest gravid was just refused
      When they press Sensitive interests: give consent
      Then the Sensitive interests consent opens, under Settings

    Scenario: Agree to sensitive interests leads to the consent
      Given a member without private-interest consent
      When they press Agree to sensitive interests
      Then the Sensitive interests consent opens, under Settings

    Scenario: Without consent in Danish
      Given a member without private-interest consent whose app is in Danish
      When the Interests tab opens
      Then the card Private interesser says Slået fra and ends with Sig ja til følsomme interesser
      When they type gravid and press Tilføj
      Then the tab says Interessen kan være følsom, så vi gemmer den kun, hvis du har sagt ja til følsomme interesser. Intet blev sendt eller gemt. Du kan give samtykke under Indstillinger → Privatliv.

  how
    decide a possibly sensitive text is refused on the phone and never sent when there is no consent
      because possibly special-category text should reach the server only from members who consented (DESIGN §5.2 (0); PRIVACY §3.8)
    decide no This isn't sensitive for me without the consent; only the consent or rewording
      because DESIGN Q23 answers no: without the consent the app offers the Settings path or rewording, to revisit with counsel
    decide the standing notice stands in the Off card, and not elsewhere on the tab
      because in full it says what happens without the consent; with the consent, a link opens it on the info page instead ("apps/mobile/src/features/interests/InterestManager.tsx")
    decide the consent opens under Settings, not as an onboarding step
      because the consent can be given or withdrawn later in Settings → Privacy (DESIGN §3.1 step 7)
  look
    The Off card: the private card (color.private.bg, a border.control color.private.border border, radius.card, space.card padding),
      its eyebrow with "Off" at the end in an outlined badge (size.badge.small tall, radius.pill, border.control color.border.strong, type.micro, 700, color.text).
    The notice in type.caption.text, color.text.secondary; "Agree to sensitive interests" an underlined type.body, 700, color.link link.
    The refusal is the add row's white note, with Sensitive interests: give consent under its text: a white size.button.small pill (radius.pill, border.control color.border.strong, color.text).
  copy
    interests.privateOffBadge     "Off"                                     da "Slået fra"
    interests.giveConsent         "Agree to sensitive interests"            da "Sig ja til følsomme interesser"
    interests.openSensitiveConsent   "Sensitive interests: give consent"    da "Følsomme interesser: giv samtykke"
    moderation.ART9_CONSENT_REQUIRED   "This interest may be sensitive, so we only save it if you've agreed to sensitive interests. Nothing was sent or saved. You can give consent in Settings → Privacy."   da "Interessen kan være følsom, så vi gemmer den kun, hvis du har sagt ja til følsomme interesser. Intet blev sendt eller gemt. Du kan give samtykke under Indstillinger → Privatliv."
    legal.interestNotice          "Tip: interests that say something about your health, beliefs, sexuality, politics, ethnic origin or union membership are only saved if you have agreed to sensitive interests (Settings → Privacy). We then keep them private and use them only as a pod's theme. Only add things about yourself."   da "Tip: Interesser, der siger noget om dit helbred, din tro, din seksualitet, politik, etniske oprindelse eller fagforening, gemmer vi kun, hvis du har sagt ja til følsomme interesser (Indstillinger → Privatliv). Så holder vi dem private og bruger dem kun som tema for en pod. Tilføj kun noget om dig selv."
  binds
    shows    the Off card when the member holds no private interest, has not given the consent, and their profile has loaded
    events   Agree to sensitive interests and Sensitive interests: give consent open "/settings/sensitive-consent"
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (the Off card, the consent message), "apps/mobile/src/features/interests/useAddInterest.ts", "packages/core/src/interests/sensitivity.ts", "packages/core/src/legal/consent-texts.ts" (the notice, interest-notice-en-v2 and interest-notice-da-v2; not an i18n key)
    Design: DESIGN F18, Q23, §3.1 steps 7–8, §5.2 (0); PRIVACY §3.2 (the notice, verbatim), §3.8
    Screens: app-interests-no-consent ("apps/mobile/preview/screens.json"); driven in the web preview, world this-week-no-consent, in English and Danish, on 27 November 2026
```
