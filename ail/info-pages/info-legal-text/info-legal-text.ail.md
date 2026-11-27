# Legal texts: the Terms and the privacy notice

`/info/legal/terms` and `/info/legal/privacy`: while the documents are drafts
waiting for the lawyer, each page shows that it is a draft, the month of the
draft, and a line saying when the text will be published. Any other document
name shows that the page does not exist. Opened from the welcome screen, About
you and Settings.

```ail
node InfoLegalText : view   level: experience
  why   The Terms are a contract a member accepts and the privacy notice is the information owed to
        them; both must be readable before signing up, and both are still drafts (PRIVACY §16–17).   <- InfoPages
  what
    Scenario: The Terms are marked as a draft
      Given someone signed out, on the Terms
      Then the title reads Terms
      And under it Draft and Version of November 2026
      And then The Terms are being reviewed by our lawyer and will be published here before launch.

    Scenario: The privacy notice is marked as a draft
      Given someone signed out, on the privacy notice
      Then the title reads Privacy notice, with Draft and Version of November 2026
      And then The layered privacy notice is being reviewed by our lawyer and will be published here before launch.

    Scenario: The Terms in Danish
      Given someone signed out whose app is in Danish, on the Terms
      Then it reads Vilkår, Udkast and Version fra november 2026

    Scenario: A legal page that does not exist
      Given someone signed out, on the legal page called nope
      Then the title reads Legal
      And it says This page does not exist.

  how
    decide while the documents are drafts, each page shows its outline line, a Draft status pill and the month of the draft, never the version's raw name
      because the legal documents are drafts awaiting counsel (PRIVACY §16–17), and the month is what a reader understands ("apps/mobile/app/info/legal/[doc].tsx")
    decide the month comes from the version onboarding records for each text: terms of November 2026, first draft, and privacy of November 2026, first draft
      because the version shown and the version a member accepts must be the same ("packages/core/src/legal/index.ts": bump it when the published text changes)
    decide the Draft pill is the Ink status pill
      because it is a state of the document, not an action or a warning ("apps/mobile/app/info/legal/[doc].tsx")
    decide an unknown document name shows Legal and This page does not exist., not an error screen
      because "unknown, confirm with the owner: is a plain not-found card the wanted answer to a wrong legal link?"
  look
    Under the title, one white card (color.surface, border.hairline color.border, radius.card, padding space.card), its rows 12px apart:
      first a row with the Draft pill (color.ink with color.on.ink text, size.badge tall, radius.pill, type.caption, 700) and, 8px after it,
      "Version of …" in type.caption.text, color.text.muted; then the text in font.body, type.body, color.text.
    A page that does not exist: the title "Legal" and a white card with the sentence in type.body, color.text.
  copy
    info.legal.terms.title     "Terms"   da "Vilkår"
    info.legal.terms.body      "The Terms are being reviewed by our lawyer and will be published here before launch."   da "Vilkårene gennemgås af vores advokat og offentliggøres her før lanceringen."
    info.legal.privacy.title   "Privacy notice"   da "Privatlivserklæring"
    info.legal.privacy.body    "The layered privacy notice is being reviewed by our lawyer and will be published here before launch."   da "Den lagdelte privatlivserklæring gennemgås af vores advokat og offentliggøres her før lanceringen."
    info.legalDraft            "Draft"   da "Udkast"
    info.legalVersion          "Version of {{month}}"   da "Version fra {{month}}"
    info.legalTitle            "Legal"   da "Juridisk"
    info.legalUnknown          "This page does not exist."   da "Siden findes ikke."
  binds
    route    "/info/legal/terms" or "/info/legal/privacy" or "/info/legal/nope"
    props    doc: text, from the route
    shows    for doc "terms" or "privacy": its title, Draft, the version line with the draft's month and year in the app's language, written out ("November 2026", "november 2026"), and its text
    shows    for doc "licences": the Licences page; for any other doc: Legal and This page does not exist.
  sources
    Code: "apps/mobile/app/info/legal/[doc].tsx", "packages/core/src/legal/index.ts" (the versions), "apps/mobile/src/components/Chip.tsx" (the status pill), "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: PRIVACY §16 (privacy notice outline), §17 (lawyer review); DESIGN §3.1 step 3, §11
    Screens: driven in the web preview (app-info-legal-terms and app-info-legal-privacy, world signed-out; and /info/legal/nope) on 27 November 2026, in English and Danish
```
