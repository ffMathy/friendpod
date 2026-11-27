# Private-interest consent: the text

The blanket consent text for private (sensitive) interests, shown word for word in its own box, on the settings
screen whether the consent is given or not. Onboarding's consent step shows the same text the same way.

```ail
node PrivateInterestConsentText : view   level: experience
  why   Consent counts only for the exact text the member saw, so the text is fixed, versioned and shown
        word for word, never reworded or translated on the fly (PRIVACY §3.3, §3.4).          <- GivePrivateInterestConsent
  what
    Scenario: The consent text is shown word for word
      Given a member without private-interest consent
      When the private-interest consent opens
      Then the eyebrow reads Private interests, with a lock, over the title Sensitive interests
      And the box starts Some interests can reveal your health, religion or beliefs
      And it ends You can withdraw your consent at any time in Settings → Privacy. We then delete all your sensitive interests at once and take you out of pods built around them. Your other interests are not affected.
      And under it the link Read more about sensitive interests

    Scenario: Read more opens the page on private interests
      Given a member without private-interest consent, on the private-interest consent
      When they press Read more about sensitive interests
      Then the page Private interests opens, reading Some interests say more about you than others. This is how we look after them.

    Scenario: The consent text in Danish
      Given a member without private-interest consent whose app is in Danish
      When the private-interest consent opens
      Then the eyebrow reads Private interesser, over the title Følsomme interesser
      And the box starts Nogle interesser kan afsløre noget om dit helbred
      And under it the link Læs mere om følsomme interesser

    The text is the current blanket consent text in the app's language, versions "art9-blanket-en-v2" and "art9-blanket-da-v2",
      in this order: the intro, the list intro in bold, six bullets, the note with its bold label (Please note: / Vær opmærksom på:),
      what This isn't sensitive for me does, how to withdraw, then the read-more link. Its title, tick text and buttons are part of the same text.
    The text is hash-locked: each version's checksum is fixed in the shared core, a test compares it with PRIVACY §3.3,
      and any change of wording needs a new version, never an edit.

  how
    decide the text lives with the legal texts in the shared core, not with the app's translations
      because the server records the version and checksum of the text shown, and accepts only a known pair (PRIVACY §3.4, DESIGN §11 i18n)
    decide nothing in the text is reworded, added or emphasised beyond its own structure
      because "apps/mobile/src/features/consent/Art9BlanketConsent.tsx": "Nothing reworded, nothing added"
    decide the text scrolls inside its box, which fills the room between the title and what follows; when that room is under 160px, the page scrolls as one column instead
      because the title above and the actions below stay in view, and too small a box cannot be read in ("apps/mobile/app/settings/sensitive-consent.tsx", MIN_BOX)
    decide private stays quiet: text colours and white only, no colour anywhere
      because "apps/mobile/src/features/consent/Art9BlanketConsent.tsx": "Private stays quiet"
  look
    The eyebrow: a small color.text lock and "PRIVATE INTERESTS" in type.eyebrow, color.text; the title 4px under it in font.display, type.title, 800, color.text.
    The box: white (color.private.bg), a border.control color.private.border border, radius.card, the text 14px from its sides.
    Prose in type.small.text with a 22px line, color.text.secondary; the list intro in type.small.text 700 color.text; bullets with a small dot;
      the note in a color.page inset with radius.md; the read-more link underlined, bold, color.link.
  copy
    onboarding.consent.badge   "Private interests"   da "Private interesser"
  binds
    route    "/settings/sensitive-consent" (the consent text on the private-interest consent)
    props    language: "en" | "da"
    events   Read more about sensitive interests opens the page on private interests
  sources
    Code: "packages/core/src/legal/consent-texts.ts", "packages/core/src/legal/hashes.ts", "apps/mobile/src/features/consent/Art9BlanketConsent.tsx", "apps/mobile/src/features/consent/art9.ts"
    Design: PRIVACY §3.3 (the text), §3.4 (recording); DESIGN F18, §11
    Screens: "apps/mobile/preview/screens.json" app-settings-sensitive-consent ("Consent copy is hash-locked in packages/core"); driven in the web preview, world this-week-no-consent, in English and Danish, on 27 November 2026
```
