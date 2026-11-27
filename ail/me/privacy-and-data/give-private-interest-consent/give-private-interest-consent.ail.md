# Give private-interest consent

Privacy → Private interests, for a member who has not given the consent (`/settings/sensitive-consent`): the
consent text, an unticked box, "I agree" and "Not now". The same consent as onboarding's step, given later.

```ail
node GivePrivateInterestConsent : flow   level: experience
  why   Private interests are only saved with explicit consent, which a member who said no at first can give
        later, in Settings → Privacy, with the same text and tick (DESIGN F18, PRIVACY §3.1).   <- PrivacyAndData
  what
    Scenario: The consent starts unticked and I agree waits
      Given a member without private-interest consent
      When the private-interest consent opens
      Then the box I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, for the purposes above. is not ticked
      And I agree cannot be pressed
      And Not now can be pressed

    Scenario: Agreeing returns to Privacy
      Given a member without private-interest consent, on Privacy
      When they press Private interests
      And they tick the box
      Then I agree can be pressed
      When they press I agree
      Then Privacy shows again

    Scenario: Not now returns to Privacy with nothing given
      Given a member without private-interest consent, on Privacy
      When they press Private interests and then Not now
      Then Privacy shows again, and Private interests still reads Not given, so nothing sensitive is saved

    Scenario: Back with no earlier screen opens Privacy
      Given a member without private-interest consent, who opened the private-interest consent directly
      When they press Back
      Then Privacy opens

    Scenario: Giving consent in Danish
      Given a member without private-interest consent whose app is in Danish
      When the private-interest consent opens
      Then Jeg siger ja cannot be pressed, and Ikke nu can
      When they tick Jeg giver udtrykkeligt samtykke til, at Friendpod behandler interesser, der kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.
      Then Jeg siger ja can be pressed

    I agree sends the proof of which text was shown, its version and checksum, with the app's version; while it is sent it is busy and Not now cannot be pressed.
    If it fails, the reason shows above I agree and the screen stays.

  how
    decide an explicit tick that starts unticked, and I agree waits for it
      because consent to special category data must be explicit (PRIVACY §3.1, DESIGN F18: "unticked checkbox")
    decide Not now leaves with nothing recorded, and the app stays usable
      because refusing keeps the app usable: sensitive interests are then refused when added, so the consent stays freely given (DESIGN F18)
    decide the same text, tick and buttons as onboarding's consent step
      because it is one blanket consent, given once, in onboarding or later in Settings (DESIGN F18, §3.1 step 7)
    decide I agree, Not now and Back all return to the screen before, or to Privacy when there is none
      because "apps/mobile/app/settings/sensitive-consent.tsx" (back)
    decide the tick and buttons stay pinned under the text box while it has room to be read in
      because "apps/mobile/preview/screens.json" app-settings-sensitive-consent: "the actions pinned under it", as onb-consent draws them
  look
    Paper page (color.page), side padding space.gutter, a size.hit back chevron at the top left, blocks 14px apart.
    Under the consent text box, 12px below it, the tick, I agree and Not now 8px apart: the tick in a white card (color.surface, border.hairline color.border, radius.lg) with a size.checkbox box with radius.checkbox
      (border.field color.field when unticked; color.primary with a white tick when ticked) and the tick text in type.small.text 600 color.text.
    I agree: full width, size.button, radius.pill, type.button 700; color.primary with color.on.primary text when it can be pressed, color.disabled with color.disabled.text when it cannot.
    Not now: centred, size.hit tall, type.label 700 color.text.secondary, underlined.
  copy
    common.back   "Back"   da "Tilbage"
  binds
    route    "/settings/sensitive-consent" or "/settings/privacy"
    state    ticked: boolean, starting at false
    role     a checkbox named with the tick text; buttons "I agree" and "Not now"
    events   I agree records the consent, then goes back; Not now and Back go back without recording
  uses PrivateInterestConsentText
  children PrivateInterestConsentText
  sources
    Code: "apps/mobile/app/settings/sensitive-consent.tsx", "apps/mobile/src/features/consent/Art9BlanketConsent.tsx", "apps/mobile/src/features/consent/art9.ts"
    Design: DESIGN F18, §3.1 step 7, §10.1 (the consent call); PRIVACY §3.1, §3.4
    Screens: "apps/mobile/preview/screens.json" app-settings-sensitive-consent; driven in the web preview, world this-week-no-consent, in English and Danish, on 27 November 2026 (the preview does not record the consent, so Privacy still reads Not given afterwards)
```
