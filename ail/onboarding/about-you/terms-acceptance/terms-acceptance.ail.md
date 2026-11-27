# Terms acceptance

The Terms tick on About you, with links to the Terms and the privacy notice.

```ail
node TermsAcceptance : view   level: experience
  why   The Terms are a contract, so a member accepts them explicitly; the
        privacy notice is information, not consent (DESIGN §3.1 step 3).      <- AboutYou
  what
    Scenario: Continue waits for the Terms
      Given a new member on About you with the first name Emil and the birth date 14 03 1991
      When they tick I accept the Terms and then untick it
      Then Continue cannot be pressed

    Scenario: The Terms link opens the Terms
      Given a new member on About you
      When they press Terms in Read the Terms
      Then the Terms open

  how
    decide an explicit tick that starts unticked
      because the Terms are a contract (DESIGN §3.1 step 3); the storyboard has no tick, and this is an accepted deviation from it ("apps/mobile/preview/screens.json", onb-about)
      rejected "By continuing you accept the Terms", as the storyboard's welcome says, because acceptance must be explicit
    decide the privacy notice is only linked, never ticked
      because it is information, not consent (DESIGN §3.1 step 3)
  look
    A size.checkbox box with radius.checkbox: a border.field color.field border when unticked; filled color.primary with a white tick when ticked;
      "I accept the Terms" 12px to its right in font.body, color.text.
    Under it, lined up with the label, "Read the Terms. How we handle your data is in the privacy notice." in type.caption, color.text.muted,
      with "Terms" and "privacy notice" as underlined, bold color.link links.
  copy
    onboarding.about.acceptTerms  "I accept the Terms"   da "Jeg accepterer vilkårene"
    onboarding.about.legalLinks   "Read the <terms>Terms</terms>. How we handle your data is in the <privacy>privacy notice</privacy>."   da "Læs <terms>vilkårene</terms>. Hvordan vi behandler dine data, kan du læse i <privacy>privatlivserklæringen</privacy>."
  binds
    props    accepted: boolean, onChange(accepted: boolean)
    role     a checkbox named "I accept the Terms"
    events   Terms and privacy notice open the legal text route with doc "terms" or "privacy"
  sources
    Code: "apps/mobile/src/features/onboarding/TermsAcceptance.tsx", "apps/mobile/src/components/Controls.tsx"
    Design: DESIGN §3.1 step 3
    Pull request: "https://github.com/ffMathy/friendpod/pull/4" ("the explicit terms tick … kept")
    Screens: driven in the web preview, world onboarding-start, on 27 November 2026
```
