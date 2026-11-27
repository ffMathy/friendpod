# Settings

Me → Settings (`/settings`): the app's language, notifications, privacy, the
legal documents and sign out. Notifications has a page of its own (a child);
Privacy belongs to PrivacyAndData, and the legal documents to InfoPages.

```ail
node MeSettings : flow   level: experience
  why   A member chooses the app's language, controls notifications, reaches privacy and the legal
        texts, and signs out, all in one place under Me (DESIGN §3.1 step 1, §11 settings).   <- Me
  what
    Scenario: Settings lists what Me's row promises
      Given a member this week
      When Settings opens
      Then it reads Me above Settings
      And General lists Language with Dansk and English, Notifications and Privacy
      And Legal lists Terms, Privacy notice and Licences, followed by Sign out

    Scenario: Choosing Dansk switches the app to Danish
      Given a member this week, on Settings
      When they choose Dansk under Language
      Then the page reads Indstillinger, Generelt, Sprog, Notifikationer, Juridisk and Log ud

    Scenario: Signing out returns to the welcome screen
      Given a member this week, on Settings
      When they press Sign out
      Then the welcome screen shows, with Continue with email

    Scenario: The rows open their pages
      Given a member this week, on Settings
      When they press Notifications, Privacy or Terms
      Then that page opens: Notifications, Privacy, or the Terms marked Draft

    Scenario: Settings in Danish
      Given a member this week whose app is in Danish
      When Settings opens
      Then it reads Mig above Indstillinger, with Vilkår, Privatlivserklæring, Licenser and Log ud

  how
    decide the language is a choice of Dansk and English, each named in its own language, and the choice is saved on the profile before the app switches
      because pushes and the drop use the profile's language too ("apps/mobile/app/settings/index.tsx"); the UI language follows the phone and can be switched (DESIGN §3.1 step 1)
    decide Privacy is listed here as a plain row, and on Me with its summary
      because the locked consent texts send people to "Settings → Privacy" ("apps/mobile/app/settings/index.tsx")
    decide Sign out is a white secondary button, not a destructive one
      because nothing is deleted ("apps/mobile/app/settings/index.tsx")
    decide signing out clears what the phone keeps of the account and returns to the welcome screen
      because the offline cache is cleared on sign-out (DESIGN §11 Data, §9 Photos)
    decide the page keeps Me's tab bar
      because Settings lives under Me, as on priv-settings ("apps/mobile/app/settings/_layout.tsx")
  look
    Paper page (color.page), side padding space.gutter.compact, blocks space.gap apart. The header: Back (a size.hit chevron) when there is somewhere to go back to,
      "Me" in type.eyebrow, 800, upper case, color.text.muted, then "Settings" in font.display, type.title, 800, color.text.
    General and Legal: white list cards (color.surface, border.hairline color.border, radius.card) with their eyebrow in type.eyebrow, 800, upper case, color.text.muted;
      rows at least 56px tall, label in type.body, 600, color.text, border.hairline color.separator between them; General's rows each with a color.text.secondary icon (globe, bell, lock), Legal's none.
    Language: a segmented control at the right of its row, a color.surface pill with a border.hairline color.border ring; the chosen one color.ink with color.on.ink text, type.label, 700.
    Sign out: full width, size.button.medium, radius.pill, color.surface with border.control color.border.strong and type.button, 700, color.text.
    Friendpod's four-tab bar at the foot with Me selected.
  copy
    settings.title         "Settings"          da "Indstillinger"
    tabs.me                "Me"                da "Mig"
    settings.general       "General"           da "Generelt"
    me.language            "Language"          da "Sprog"
    languages.da           "Dansk"             da "Dansk"
    languages.en           "English"           da "English"
    settings.notifications.title  "Notifications"   da "Notifikationer"
    settings.privacy.title "Privacy"           da "Privatliv"
    info.legalTitle        "Legal"             da "Juridisk"
    info.legalTerms        "Terms"             da "Vilkår"
    info.legalPrivacy      "Privacy notice"    da "Privatlivserklæring"
    info.legalLicences     "Licences"          da "Licenser"
    settings.signOut       "Sign out"          da "Log ud"
  binds
    route    "/settings"
    role     Language is a radio group named "Language" with Dansk and English
    events   choosing a language saves it on the profile, then switches the app to it; a failure shows its error under General
    events   Notifications opens "/settings/notifications"; Privacy "/settings/privacy"; Terms, Privacy notice and Licences open "/info/legal/[doc]" with doc "terms", "privacy" or "licences"
    events   Sign out shows it is busy, signs out and returns to the welcome screen
  uses NotificationSettings, PrivacyAndData, InfoPages, SignIn
  children NotificationSettings
  sources
    Code: "apps/mobile/app/settings/index.tsx", "apps/mobile/app/settings/_layout.tsx", "apps/mobile/src/features/shell/parts.tsx", "apps/mobile/src/features/account/account.ts", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: DESIGN §3.1 step 1, §11; "apps/mobile/preview/screens.json" app-settings
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
