# Withdraw private-interest consent

Privacy → Private interests, for a member who has given the consent (`/settings/sensitive-consent`): when it was
given, how many interests are private, the text it covers, and "Withdraw consent", confirmed with the locked
withdrawal text.

```ail
node WithdrawPrivateInterestConsent : flow   level: experience
  why   Withdrawing the consent must be as easy as giving it, in the same place, and it deletes every private
        interest at once (PRIVACY §3.5, DESIGN F18).                                             <- PrivacyAndData
  what
    Scenario: The consent shows when it was given and what it covers
      Given a member this week, who agreed on 4 November 2026 and has 1 private interest
      When the private-interest consent opens
      Then it reads You agreed on 4 Nov 2026. and 1 of your interests is private.
      And the link See them under Interests, then the consent text, and the button Withdraw consent
      And there is no box to tick and no I agree

    Scenario: See them under Interests opens Interests
      Given a member this week, on the private-interest consent
      When they press See them under Interests
      Then the Interests tab opens, with the private interest gravid

    Scenario: Withdrawing waits for a confirmation
      Given a member this week, on the private-interest consent
      When they press Withdraw consent
      Then nothing is withdrawn yet: the screen still reads You agreed on 4 Nov 2026.

    Scenario: The given consent in Danish
      Given a member this week whose app is in Danish
      When the private-interest consent opens
      Then it reads Du sagde ja den 4. nov. 2026., 1 af dine interesser er privat., Se dem under Interesser and Træk samtykket tilbage

    Withdraw consent asks first, in the phone's own dialog: titled Withdraw consent for sensitive interests, with the locked withdrawal text
      (versions "art9-withdraw-all-en-v2" and "art9-withdraw-all-da-v2", hash-locked like the consent text), Cancel, and Withdraw consent for sensitive interests as the destructive choice.
      English: "Withdraw your consent for sensitive interests? We'll delete all your sensitive interests now and take you out of pods built around them. Other members will only see that a member left. You can keep using Friendpod with your other interests."
      Danish: "Vil du trække dit samtykke til følsomme interesser tilbage? Vi sletter alle dine følsomme interesser nu og tager dig ud af pods, der er bygget op om dem. De andre medlemmer ser kun, at et medlem er gået. Du kan fortsat bruge Friendpod med dine andre interesser."
    Confirming withdraws the consent and deletes every private interest; the button is busy meanwhile, then the screen goes back. If it fails, the reason shows above the button.

  how
    decide the withdrawal is on the same screen the consent is given on, and in Privacy
      because withdrawal must be as easy as giving consent, in the same place (PRIVACY §3.5, F18)
    decide one withdrawal covers every private interest; removing just one is done on that interest
      because the consent is one blanket consent (PRIVACY §3.5: "Remove" on each sensitive interest, or the full withdrawal in Settings → Privacy)
    decide it is confirmed first, with the locked withdrawal text
      because PRIVACY §3.5 gives the confirmation copy, and the deletion is immediate and cannot be undone
    decide the screen shows the given date with a plain check, no colour
      because private stays quiet: "a plain white card, a check for the given consent, no colour" ("apps/mobile/app/settings/sensitive-consent.tsx")
    decide Withdraw consent is the danger outline with a trash icon, pinned at the bottom
      because destructive actions are the danger outline across the app, never a red fill ("apps/mobile/src/components/Button.tsx")
  look
    As the give screen: back chevron, the eyebrow and title, then a white card (color.surface, border.hairline color.border, radius.card, space.card padding, 4px gaps):
      a small color.text check before "You agreed on …" in type.body.small 700 color.text; under it, in line with the text, the count in type.small.text color.text.secondary and the link "See them under Interests" (underlined, bold, color.link).
    Then the consent text box, filling the room down to the button.
    Withdraw consent pinned at the bottom: full width, size.button, radius.pill, color.surface with a border.control color.danger border, a color.danger trash icon and type.button 700 in color.danger.
  copy
    sensitiveConsent.givenOn            "You agreed on {{date}}."                     da "Du sagde ja den {{date}}."
    sensitiveConsent.privateCount_one   "{{count}} of your interests is private."     da "{{count}} af dine interesser er privat."
    sensitiveConsent.privateCount_other "{{count}} of your interests are private."    da "{{count}} af dine interesser er private."
    sensitiveConsent.seeThem            "See them under Interests"                    da "Se dem under Interesser"
    sensitiveConsent.withdraw           "Withdraw consent"                            da "Træk samtykket tilbage"
    settings.privacy.withdrawSensitive  "Withdraw consent for sensitive interests"    da "Træk samtykket til følsomme interesser tilbage"
    common.cancel                       "Cancel"                                      da "Annullér"
  binds
    shows    the date the consent was given, as day, short month and year in the app's language; the count of private interests
    events   the see-them link opens the interests tab; Withdraw consent opens the confirmation; its confirm withdraws, then goes back (or to Privacy)
  uses PrivateInterestConsentText
  sources
    Code: "apps/mobile/app/settings/sensitive-consent.tsx", "apps/mobile/src/features/consent/art9.ts", "packages/core/src/legal/consent-texts.ts"
    Design: PRIVACY §3.5 (withdrawal and its copy); DESIGN F18, §10.1 (the withdrawal call)
    Screens: "apps/mobile/preview/screens.json" app-settings-sensitive-consent-given; driven in the web preview, world this-week, in English and Danish, on 27 November 2026; the preview's dialogs do nothing, so the confirmation could not be driven
```
