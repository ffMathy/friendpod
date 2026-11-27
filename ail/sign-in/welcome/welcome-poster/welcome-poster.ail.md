# Welcome poster

The top of the welcome screen, on the Skov house field: the friendpod lockup,
the language switch, the poster mark with "18+ only", the headline and the
tagline.

```ail
node WelcomePoster : view   level: experience
  why   The welcome is one of the three ritual poster moments, and it says in a few words who Friendpod is for:
        small groups, real meetups, adults only (DESIGN §3.1 step 1).                                     <- Welcome
  what
    The language starts as the phone's: Danish for a Danish phone, English for any other.
    Pressing Dansk or English switches every text on the screen at once, the buttons and the Terms line included.

    Scenario: The welcome in English
      Given someone signed out whose app is in English
      When the welcome screen opens
      Then it reads friendpod, 18+ only, Small groups. Real meetups. and There’s room for you.
      And the Language switch offers Dansk and English

    Scenario: Switching the welcome to Danish
      Given someone signed out whose app is in English, on the welcome screen
      When they press Dansk
      Then it reads Små grupper. Rigtige møder., Kun 18+ and Fortsæt med e-mail
      When they press English
      Then it reads Small groups. Real meetups. again

    Scenario: The welcome in Danish
      Given someone signed out whose app is in Danish
      When the welcome screen opens
      Then it reads Kun 18+, Små grupper. Rigtige møder. and Der er plads til dig.
      And the Sprog switch offers Dansk and English

  how
    decide the language follows the phone and can be switched here
      because the welcome's language follows the device, da or en, switchable (DESIGN §3.1 step 1)
    decide a poster field on the welcome
      because poster fields are kept for the three rituals: the welcome, the Thursday drop and the pod reveal (pull request 5; "apps/mobile/README.md" Rules)
    decide the in-app tagline is There’s room for you, not the posters' line about a seat
      because the identity keeps "Der er plads til dig" in the app and "Der er en plads til dig" for the brand and posters (pull request 5; "apps/mobile/README.md" Copy)
    decide 18+ only on the poster
      because the welcome copy says the app is for adults (DESIGN §3.1 step 1: "Small groups. Real meetups. 18+.")
    decide the switch is drawn for the welcome only
      because the shared segmented control is the white, bordered control for Paper grounds, and this one sits on the Skov field ("apps/mobile/src/features/auth/LanguageSwitch.tsx")
  look
    A Skov field (color.house) from the very top of the screen, side padding space.gutter; its top row starts 52px down on an 844 frame.
    Top row: the friendpod lockup (the mark with Paper people and a sun, and "friendpod" in font.display 800, white) on the left;
      on the right the language switch: a color.page pill, radius.pill, 2px inside it two size.hit segments with 14px side padding,
      the chosen one color.ink with color.on.ink text in type.small.text 700, the other transparent with color.text.secondary text in type.small.text 600.
    8px under it the poster mark, 202px tall and 220px wide: people around a pod.solsikke.base sun, with one seat drawn dashed (your seat, saved);
      the "18+ only" pill at its bottom left: color.field.pill, size.tag tall, radius.lg, 12px side padding, color.on.field.pill text in type.caption, 800.
    12px under the mark the headline on two lines in font.display, type.display.l, 800, color.on.house; 10px under it the tagline in font.display, type.headline, 700, color.on.house.
    The field ends about 25px under the tagline.
  copy
    welcome.language    "Language"                    da "Sprog"
    languages.da        "Dansk"                       da "Dansk"
    languages.en        "English"                     da "English"
    welcome.adultsOnly  "18+ only"                    da "Kun 18+"
    welcome.headline    "Small groups.\nReal meetups."   da "Små grupper.\nRigtige møder."
    welcome.tagline     "There’s room for you."       da "Der er plads til dig."
  binds
    route    "/" (the top of the welcome screen, signed out)
    props    locale: "da" | "en", onChange(locale: "da" | "en")
    role     a radio group named "Language" with two radios, "Dansk" and "English"
    role     the lockup is an image named "Friendpod"; the headline is a level-1 heading; the mark is decorative
    events   pressing a radio sets the app's language to it
  sources
    Code: "apps/mobile/app/(auth)/index.tsx", "apps/mobile/src/features/auth/LanguageSwitch.tsx", "apps/mobile/src/components/Logo.tsx", "apps/mobile/src/i18n/index.ts",
          "apps/mobile/src/i18n/en/auth.json", "apps/mobile/src/i18n/da/auth.json"
    Design: DESIGN §3.1 step 1; storyboard Main ("apps/mobile/preview/screens.json"); pull request 5 ("https://github.com/ffMathy/friendpod/pull/5")
    Screens: driven in the web preview, world signed-out, in English and Danish, on 27 November 2026
```
