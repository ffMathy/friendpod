# Privacy: what you've agreed to

The first card on Privacy: the private-interest consent, same-gender pods and the photo, each with its state and
the screen where it is changed.

```ail
node PrivacyAgreements : flow   level: experience
  why   Each thing the member has agreed to that uses sensitive or personal data is listed with its state, one
        tap from where it is given, changed or withdrawn (PRIVACY §6, F18).                         <- PrivacyAndData
  what
    Scenario: The agreements of a member with private-interest consent
      Given a member in privacy settings, with consent and 1 private interest, same-gender pods off and a photo
      When Privacy opens
      Then What you've agreed to lists Private interests with 1 interest, consent given
      And Same-gender pods with Off, no gender stored
      And Photo with Shown to confirmed pods

    Scenario: Without private-interest consent nothing sensitive is saved
      Given a member without private-interest consent
      When Privacy opens
      Then Private interests reads Not given, so nothing sensitive is saved

    Scenario: Private interests opens the private-interest consent
      Given a member in privacy settings, on Privacy
      When they press Private interests
      Then the private-interest consent opens, titled Sensitive interests, with You agreed on 4 Nov 2026.

    Scenario: Same-gender pods opens the pod preferences
      Given a member in privacy settings, on Privacy
      When they press Same-gender pods
      Then Pod preferences opens, with Same-gender pods only

    Scenario: Photo opens Me
      Given a member in privacy settings, on Privacy
      When they press Photo
      Then Me opens, with Change photo

    Scenario: The agreements in Danish
      Given a member in privacy settings whose app is in Danish
      When Privacy opens
      Then it reads Private interesser with 1 interesse, samtykke givet, Pods med samme køn with Fra – vi gemmer ikke dit køn, and Billede with Vises for bekræftede pods

    When same-gender pods are on, the row reads On, uses your gender, and under it a small danger button, Turn off and delete my gender, turns them off at once, without asking again.
    Without a photo, Photo reads No photo.

  how
    decide the private-interest consent is given or withdrawn on a screen of its own, opened from this row
      because withdrawing must be as easy as giving, in the same place (PRIVACY §3.5, GDPR Article 7.3); F18
    decide while same-gender pods are on, turning them off and deleting the gender is offered right here
      because the gender is stored only for this setting and is deleted when it is turned off (PRIVACY §3.6; "apps/mobile/app/settings/privacy.tsx")
    decide the photo row opens Me, where the photo is changed or deleted
      because "apps/mobile/app/settings/privacy.tsx": the photo is "changed or deleted under Me"
    decide Private interests carries a small lock before its label, in the text colour
      because private stays quiet: no colour for what is private ("apps/mobile/src/features/consent/Art9BlanketConsent.tsx")
  look
    A white card (color.surface, border.hairline color.border, radius.card) headed "WHAT YOU'VE AGREED TO" in type.eyebrow, color.text.muted.
    Three rows, each a label in type.body 600 color.text over its state in type.caption, color.text.muted, with a chevron (color.text.muted) at the right;
      rows are split by border.hairline color.separator lines. Private interests has a small color.text lock before its label.
    Turn off and delete my gender, when shown: a size.button.compact danger outline (color.surface, border.control color.danger, color.danger trash icon and type.label 700 text).
  copy
    privacy.agreedTo            "What you've agreed to"                       da "Det har du sagt ja til"
    privacy.privateInterests    "Private interests"                           da "Private interesser"
    privacy.privateOn_one       "{{count}} interest, consent given"           da "{{count}} interesse, samtykke givet"
    privacy.privateOn_other     "{{count}} interests, consent given"          da "{{count}} interesser, samtykke givet"
    privacy.privateOff          "Not given, so nothing sensitive is saved"    da "Fra – vi gemmer intet følsomt"
    privacy.sameGender          "Same-gender pods"                            da "Pods med samme køn"
    privacy.sameGenderOn        "On, uses your gender"                        da "Slået til, bruger dit køn"
    privacy.sameGenderOff       "Off, no gender stored"                       da "Fra – vi gemmer ikke dit køn"
    privacy.sameGenderWithdraw  "Turn off and delete my gender"               da "Slå fra og slet mit køn"
    privacy.photo               "Photo"                                       da "Billede"
    privacy.photoOn             "Shown to confirmed pods"                     da "Vises for bekræftede pods"
    privacy.photoOff            "No photo"                                    da "Intet billede"
  binds
    route    "/settings/privacy" (the first card on Privacy)
    shows    the private count is the number of the member's private interests; consent counts as given while the profile records it
    events   Private interests opens the private-interest consent route; Same-gender pods the preferences route; Photo the Me tab
    events   Turn off and delete my gender updates the profile with same-gender pods off, busy while it is sent
  sources
    Code: "apps/mobile/app/settings/privacy.tsx", "apps/mobile/src/i18n/en/privacy.json", "apps/mobile/src/i18n/da/privacy.json"
    Design: PRIVACY §3.5, §3.6, §6; DESIGN F18
    Screens: driven in the web preview, worlds privacy-settings and this-week-no-consent, in English and Danish, on 27 November 2026; no world has same-gender pods on or no photo
```
