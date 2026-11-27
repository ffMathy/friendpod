# Privacy and data

Me → Privacy (`/settings/privacy`, storyboard priv-settings): what the member has agreed to, their data and
matching, and the way out (delete account), closed by the right to complain. Each card and each screen it opens is
a child: the private-interest consent (given or withdrawn), the data export, and delete account.

```ail
node PrivacyAndData : flow   level: experience
  why   A member can see what they have agreed to, get their data, pause, withdraw a consent and delete their
        account from one place, as the law gives them those rights (PRIVACY §6, DESIGN §11 settings).   <- Me
  what
    Scenario: Privacy opens on what you have agreed to and your data
      Given a member in privacy settings, who opened Privacy directly
      When Privacy opens
      Then it reads Me over the title Privacy, with no way back, as there is no earlier screen
      And it shows What you've agreed to, then Your data and matching, then Delete account
      And it ends with Unhappy with how we handle your data? You can complain to the Danish Data Protection Agency (datatilsynet.dk), with datatilsynet.dk as a link
      And the tab bar shows, with Me

    Scenario: Coming from Me, Me leads back
      Given a member in privacy settings, on Me
      When they press Privacy
      Then the Privacy screen shows Me as a way back
      When they press it
      Then Me shows again, with its Privacy row

    Scenario: Delete account opens the delete screen
      Given a member in privacy settings, on Privacy
      When they press Delete account
      Then the screen asks Delete your account?

    Scenario: Privacy in Danish
      Given a member in privacy settings whose app is in Danish
      When Privacy opens
      Then it reads Mig, Privatliv, Det har du sagt ja til, Dine data og matchning and Slet konto
      And it ends with Utilfreds med, hvordan vi behandler dine data? Du kan klage til Datatilsynet (datatilsynet.dk).

    While the member's profile loads, the screen shows only a loading sign; if it cannot load, it says This could not be loaded. Try again later. above the cards.
    An error from pausing or from turning off same-gender pods is shown under the cards.

  how
    decide the Me eyebrow above the title is the way back when there is an earlier screen, and plain text when there is none
      because the storyboard draws no separate back chevron: the parent's name is the way back ("apps/mobile/app/settings/privacy.tsx", ParentLink)
    decide Delete account is an outlined danger button, never a red fill
      because destructive actions are the danger outline across the app ("apps/mobile/src/components/Button.tsx", danger)
    decide the complaint line with a link to datatilsynet.dk closes the page
      because PRIVACY §6 requires the complaint path, and priv-settings draws it under Delete account
    decide the link opens datatilsynet.dk outside the app, and a failure to open it is ignored
      because "unknown, confirm with the owner: should the member be told when the complaint link cannot be opened?"
  look
    Paper page (color.page) with side padding space.gutter.compact, under it the tab bar (size.tab.bar) with Me active.
    Header: "ME" in type.eyebrow (800, capitals, color.text.muted), with a small back chevron before it when it leads back; the title "Privacy" 4px under it in font.display, type.title, 800, color.text.
    Two white cards (color.surface, border.hairline color.border, radius.card, 16px side padding), space.gap apart; each opens with its heading in type.eyebrow, color.text.muted.
    Delete account: full width, size.button.medium, radius.pill, color.surface with a border.control color.danger border, a trash icon and type.button 700 in color.danger.
    The complaint line centred under it in type.caption, color.text.muted, with datatilsynet.dk an underlined bold color.link link.
  copy
    tabs.me                 "Me"                                                          da "Mig"
    common.back             "Back"                                                        da "Tilbage"
    common.loading          "Loading"                                                     da "Indlæser"
    common.loadFailed       "This could not be loaded. Try again later."                  da "Det kunne ikke indlæses. Prøv igen senere."
    privacy.title           "Privacy"                                                     da "Privatliv"
    privacy.deleteAccount   "Delete account"                                              da "Slet konto"
    privacy.complaint       "Unhappy with how we handle your data? You can complain to the Danish Data Protection Agency (<a>datatilsynet.dk</a>)."   da "Utilfreds med, hvordan vi behandler dine data? Du kan klage til Datatilsynet (<a>datatilsynet.dk</a>)."
  binds
    role     the eyebrow, with an earlier screen, is a button named "Back: Me"; without one, plain text
    events   Delete account opens the delete account route; datatilsynet.dk opens "https://www.datatilsynet.dk" outside the app
  uses PrivacyAgreements, PrivacyDataAndMatching, DataExport, DeleteAccount
  children PrivacyAgreements, PrivacyDataAndMatching, DataExport, GivePrivateInterestConsent, WithdrawPrivateInterestConsent, DeleteAccount
  sources
    Code: "apps/mobile/app/settings/privacy.tsx", "apps/mobile/src/i18n/en/privacy.json", "apps/mobile/src/i18n/da/privacy.json"
    Design: PRIVACY §6 (rights in the app, complaint); DESIGN §11 (settings routes)
    Screens: "apps/mobile/preview/screens.json" priv-settings; driven in the web preview, world privacy-settings (10 November 2026 12:00), in English and Danish, on 27 November 2026
```
