# Licences

`/info/legal/licences`: the credits for the postcode data, the two bundled
fonts with their full licences, and the open-source software and on-device
model the app ships. Opened from Settings.

```ail
node InfoLicences : view   level: experience
  why   The open data, fonts and software the app is built with ask to be credited, and the font
        licence asks that its notice and licence travel with the font.                 <- InfoPages
  what
    Scenario: The licences credit postcodes, fonts and software
      Given a member this week, on Licences
      Then it reads Friendpod is built with open data and open-source software. Thank you to the people behind them.
      And POSTCODES has the links GeoNames (www.geonames.org) and CC BY 4.0
      And FONTS lists Plus Jakarta Sans, SIL Open Font License 1.1 and Bricolage Grotesque, SIL Open Font License 1.1, each with its copyright line
      And OPEN-SOURCE SOFTWARE lists 13 rows, from "React and React Native", MIT to "EmbeddingGemma 2 (the on-device model)", Apache-2.0
      And the page ends Each package's full licence text comes with its source code.

    Scenario: A font's licence opens and closes
      Given a member this week, on Licences
      When they press Show the licence for Plus Jakarta Sans
      Then the full licence shows under it, from its copyright line to SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007 and on
      And the link reads Hide the licence
      When they press Hide the licence for Plus Jakarta Sans
      Then the licence text is gone

    Scenario: The GeoNames link opens its website
      Given a member this week, on Licences
      When they press GeoNames (www.geonames.org)
      Then www.geonames.org opens outside the app

    Scenario: Licences in Danish
      Given a member this week whose app is in Danish, on Licences
      Then it reads Licenser, POSTNUMRE, SKRIFTTYPER and OPEN SOURCE-SOFTWARE
      And the rows read "React og React Native" and EmbeddingGemma 2 (modellen på telefonen), and each font has Vis licensen

  how
    decide each font's full licence is behind its own Show the licence link, and its spoken name says which font
      because the font licence asks that notice and licence travel with the font, and there are two fonts ("apps/mobile/app/info/legal/[doc].tsx", "apps/mobile/src/features/shell/licences.ts")
    decide licence texts, names and licence ids stay in English; only the joining word and the model's description follow the app's language
      because translations are not the licence, and no English prose should show in the Danish app ("apps/mobile/src/features/shell/licences.ts")
    decide GeoNames and CC BY 4.0 are standalone links side by side, each 44px tall, opening the website outside the app
      because an inline link in a 14px line would be about 20px tall ("apps/mobile/app/info/legal/[doc].tsx")
    decide the model's licence is read from the model the app bundles
      because it then cannot drift ("apps/mobile/src/features/shell/licences.ts")
  look
    Under the title, the intro in type.body, color.text.secondary. Then two white cards (color.surface, border.hairline color.border, radius.card, padding space.card):
      POSTCODES (type.eyebrow, 800, upper case, color.text.muted), the use in type.small.text, color.text, and the two underlined color.link links, size.hit tall, 24px apart;
      FONTS, then each font: its name and licence in type.small.text, color.text, the copyright in type.caption.text, color.text.muted, and the link in type.body.small, 700, color.link;
      the second font under a border.hairline color.separator line. An open licence sits in a Paper (color.page) box, radius.md, in type.micro, color.text.secondary.
    OPEN-SOURCE SOFTWARE: the eyebrow over a white list card, one row per entry, the names in type.body, 700, color.text, the licence on the right in type.caption, 700.
    Last, the note in type.caption.text, color.text.muted.
  copy
    info.legal.licences.title  "Licences"   da "Licenser"
    info.legal.licences.body   "Friendpod is built with open data and open-source software. Thank you to the people behind them."   da "Friendpod er bygget med åbne data og open source-software. Tak til folkene bag."
    info.legalPostcodes        "Postcodes"   da "Postnumre"
    info.legalPostcodesUse     "Danish postcodes and where they are, used when you choose your area."   da "Danske postnumre og deres placering, som vi bruger, når du vælger dit område."
    info.legalFonts            "Fonts"   da "Skrifttyper"
    info.legalShowLicence      "Show the licence"   da "Vis licensen"
    info.legalHideLicence      "Hide the licence"   da "Skjul licensen"
    info.legalShowLicenceFor   "Show the licence for {{name}}"   da "Vis licensen for {{name}}"
    info.legalHideLicenceFor   "Hide the licence for {{name}}"   da "Skjul licensen for {{name}}"
    info.legalSoftware         "Open-source software"   da "Open source-software"
    info.legalAnd              "{{list}} and {{last}}"   da "{{list}} og {{last}}"
    info.legalOnDeviceModel    "{{name}} (the on-device model)"   da "{{name}} (modellen på telefonen)"
    info.legalSoftwareNote     "Each package's full licence text comes with its source code."   da "Den fulde licenstekst følger med hver pakkes kildekode."
  binds
    route    "/info/legal/licences"
    links    "GeoNames (www.geonames.org)" opens "https://www.geonames.org"; "CC BY 4.0" opens "https://creativecommons.org/licenses/by/4.0/"
    rows     "React and React Native", MIT; "Expo, Expo Router and Expo Modules", MIT; "React Native Firebase", Apache-2.0; "React Native Google Sign-In", MIT; TanStack Query, MIT;
             "i18next and react-i18next", MIT; "React Hook Form", MIT; Zod, MIT; "react-native-svg", MIT; "React Native Screens, Gesture Handler and Safe Area Context", MIT;
             ONNX Runtime, MIT; Hugging Face Tokenizers, Apache-2.0; EmbeddingGemma 2 (the on-device model), Apache-2.0
    state    open: boolean per font, starting at false; its link toggles it
  sources
    Code: "apps/mobile/app/info/legal/[doc].tsx" (Licences, FontLicence), "apps/mobile/src/features/shell/licences.ts" (credits, OFL texts), "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Screens: driven in the web preview (app-info-legal-licences, world this-week) on 27 November 2026, in English and Danish
```
