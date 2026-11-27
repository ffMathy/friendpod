# Sensitive interests (step 3)

Step 3 of 6: the one blanket consent for private (sensitive) interests, asked once, on its own screen, right after
the basics are sent. Saying no keeps the app usable. The consent text itself is `PrivateInterestConsentText`, which
the settings screen shows the same way.

```ail
node SensitiveInterestsStep : flow   level: experience
  why   Interests about health, faith or sexuality are only kept with explicit consent, given once and
        freely: a member can say no and still use Friendpod (DESIGN F18, §3.1 step 7, PRIVACY §3.1).   <- Onboarding
  what
    Under the header: the consent text in its box, then the unticked tick, I agree, and Not now.
    I agree can be pressed only while the box is ticked; it sends the proof of which text was shown, and while that is sent
      it is busy and Not now cannot be pressed. If it fails, the reason shows above I agree and the step stays.
    I agree and Not now go back to the screen before when there is one (the interests step that asked for the consent),
      else open step 4. Not now records nothing.

    Scenario: The consent starts unticked and I agree waits
      Given a member choosing about private interests
      When the private-interests step opens
      Then it reads Step 3 of 6, Private interests and Sensitive interests, with no Back
      And the box I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, for the purposes above. is not ticked
      And I agree cannot be pressed, and Not now can

    Scenario: I agree gives the consent and opens the interests
      Given a member choosing about private interests, on the private-interests step
      When they tick the box
      Then I agree can be pressed
      When they press I agree
      Then step 4 opens, reading Step 4 of 6 and What are you into?

    Scenario: Not now carries on without the consent
      Given a member choosing about private interests, on the private-interests step
      When they press Not now
      Then step 4 opens, reading What are you into?

    Scenario: Asked for from the interests, it returns there
      Given a member choosing about private interests, on What are you into?, whose interest diabetes was refused as sensitive
      When they press Sensitive interests: give consent
      Then the private-interests step opens, with Back
      When they press Not now
      Then What are you into? shows again, still saying the interest may be sensitive

    Scenario: The step in Danish
      Given a member choosing about private interests whose app is in Danish
      When the private-interests step opens
      Then it reads Trin 3 af 6 and Følsomme interesser
      And Jeg siger ja cannot be pressed, and Ikke nu can

  how
    decide its own step, after the basics are sent and before the interests
      because recording the consent needs the profile the basics create, and the interests need the answer (DESIGN F18, §3.1 step 7; "apps/mobile/app/(onboarding)/sensitive-consent.tsx")
    decide an explicit tick that starts unticked, and I agree waits for it
      because consent to special category data must be explicit (DESIGN F18: "unticked checkbox"; PRIVACY §3.1)
    decide Not now records nothing and carries on; the consent can be given later in Settings → Privacy
      because refusing keeps the app usable, so the consent stays freely given (DESIGN F18, PRIVACY §3.9)
    decide the step shows even when the consent was already given, with the box unticked
      because "unknown, confirm with the owner: going back to this step after giving the consent offers it again; should it say the consent is given instead?"
    decide the page does not scroll: the text scrolls in its box, and the tick and buttons are pinned under it; below 160px of room the page scrolls as one column
      because "apps/mobile/preview/screens.json" onb-consent: the storyboard's look, not its wording
  look
    The onboarding header, then the consent text's eyebrow, title and box filling the room down to the actions, 12px above them.
    The tick in a white card (color.surface, border.hairline color.border, radius.lg): a size.checkbox box, radius.checkbox, border.field color.field
      when unticked, color.primary with a white tick when ticked; its text in type.small.text, 700, color.text.
    I agree: full width, size.button, radius.pill, type.button 700, color.primary with color.on.primary text, color.disabled with color.disabled.text while it waits.
    Not now: centred, size.hit tall, type.label 700, color.text.secondary, underlined.
  binds
    state    ticked: boolean, starting at false
    role     a checkbox named with the consent's tick text; buttons "I agree" and "Not now" (Danish "Jeg siger ja" and "Ikke nu"), from the locked consent text
    events   I agree records the consent with the text's version, checksum and the app's version, then goes on; Not now goes on
  uses PrivateInterestConsentText
  sources
    Code: "apps/mobile/app/(onboarding)/sensitive-consent.tsx", "apps/mobile/src/features/consent/Art9BlanketConsent.tsx", "apps/mobile/src/features/consent/art9.ts", "packages/core/src/legal/consent-texts.ts"
    Design: DESIGN F18, §3.1 step 7; PRIVACY §3.1, §3.3, §3.4, §3.9
    Screens: "apps/mobile/preview/screens.json" onb-consent; driven in the web preview, worlds onboarding-consent and onboarding-interests, in English and Danish, on 27 November 2026 (the preview does not record the consent)
```
