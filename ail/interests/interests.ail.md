# Interests

The Interests tab: a member's interests in their own words, how many they
have of the 20 allowed, which are main interests, and the private ones in a
quiet card of their own. Adding, starring, the row's actions, the private
card and the tab without consent to private interests are children.

```ail
node Interests : flow   level: experience
  why   Pods are formed around what members care about, written in their own words; private
        interests are only ever shown inside a pod about them (DESIGN §3.1 step 8, §11, F18).   <- Friendpod
  what
    The count reads how many interests the member holds, private ones included, of 20.
    Under fewer than 5 interests the tab nudges towards more; 3 are needed to be matched at all.
    While the phone gets its interest check ready, the tab says so; if the phone cannot run it, adding is blocked with a message saying why and Try again.
      The web preview's check is always ready at once, so neither shows there.

    Scenario: The tab shows every interest and the private one apart
      Given a member this week with the interests brætspil (a main interest), sourdough, far på barsel and trail running, and the private interest gravid
      When the Interests tab opens
      Then it reads Interests and 5 of 20
      And under Interests it lists brætspil, sourdough, far på barsel and trail running, in that order
      And under Private interests it shows gravid with Consent given 4 Nov 2026
      And How private interests work is under the cards
      And there is no nudge to add more

    Scenario: Fewer than five interests show the nudge
      Given a member without private-interest consent, with the four interests brætspil, sourdough, far på barsel and trail running
      When the Interests tab opens
      Then it reads 4 of 20
      And it says Add at least 3. 5 or more gives better pods.

    Scenario: How private interests work opens its page
      Given a member this week on the Interests tab
      When they press How private interests work
      Then the Private interests page opens

    Scenario: The tab in Danish
      Given a member this week whose app is in Danish
      When the Interests tab opens
      Then it reads Interesser, 5 af 20, Private interesser and Du sagde ja 4. nov. 2026
      And the link reads Sådan fungerer private interesser

  how
    decide one list for ordinary interests in the order they were added, and the private ones in their own quiet card under it
      because private items stay quiet: no colour, an ink border and a lock (pull request 5; "apps/mobile/src/features/interests/InterestManager.tsx")
    decide the count includes private interests and reads against 20
      because the server holds at most 20 interests per member, private ones included, as DESIGN A21 sets ("functions/src/interests/config.ts")
    decide the nudge shows under 5 interests
      because onboarding asks for at least 3 and nudges towards 5 (DESIGN §3.1 step 8)
    decide the interest check runs on the phone and adding waits until it is ready
      because sensitivity is decided by the model on the phone alone, before anything is sent (DESIGN F38, §5.2 (0))
  look
    Paper page (color.page), side padding space.gutter.compact, space.tab.top above the title, blocks space.gap apart; the tab bar under it.
    Title row: "Interests" in font.display, type.title, 800, color.text on the left; "5 of 20" in type.small.text, 600, color.text.muted on the right.
    The add row under it (AddInterest), then the white (color.surface) list card with a border.hairline color.border border and radius.card.
    The nudge under the list card in type.caption, color.text.muted.
    The private card (PrivateInterestsCard) under it, and "How private interests work" last: an underlined type.body, 700, color.link link.
  copy
    tabs.interests               "Interests"                                       da "Interesser"
    interests.countOf            "{{count}} of {{max}}"                            da "{{count}} af {{max}}"
    interests.nudge              "Add at least 3. 5 or more gives better pods."    da "Tilføj mindst 3. Med 5 eller flere får du bedre pods."
    interests.howPrivate         "How private interests work"                      da "Sådan fungerer private interesser"
    interests.model.preparing    "Getting interests ready on your phone…"          da "Gør interesser klar på din telefon …"
    interests.model.notBundled   "This version of the app doesn't include what your phone needs to understand interests. Install the app from the App Store or Google Play."   da "Denne version af appen indeholder ikke det, din telefon skal bruge for at forstå interesser. Installér appen fra App Store eller Google Play."
    interests.model.storage      "Your phone needs about 260 MB of free space to get interests ready, once. Free up some space, then try again."   da "Din telefon skal have ca. 260 MB ledig plads én gang for at gøre interesser klar. Frigør noget plads, og prøv igen."
    interests.model.integrity    "Something went wrong getting interests ready, so we deleted it. Please try again. If it keeps happening, reinstall the app."   da "Noget gik galt, da interesser blev gjort klar, så vi har slettet det. Prøv igen. Sker det igen, så geninstallér appen."
    interests.model.runtime      "This phone can't run the interest check right now (it may need more free memory). Close other apps and try again."   da "Telefonen kan ikke køre tjekket af interesser lige nu (den mangler måske ledig hukommelse). Luk andre apps, og prøv igen."
    interests.model.notPinned    "Adding interests isn't available in this version yet."   da "Du kan ikke tilføje interesser i denne version endnu."
    common.loadFailed            "This could not be loaded. Try again later."      da "Det kunne ikke indlæses. Prøv igen senere."
    common.retry                 "Try again"                                       da "Prøv igen"
  binds
    route    the Interests tab, "/interests"
    shows    the count of ordinary and private interests together, against 20; the nudge when there are fewer than 5 and the lists have loaded
    events   How private interests work opens "/info/sensitive-interests"; it is hidden while the private card is Off
  uses AddInterest, InterestList, InterestStars, PrivateInterestsCard
  children AddInterest, InterestList, InterestStars, PrivateInterestsCard, InterestsWithoutConsent, InterestRules
  sources
    Code: "apps/mobile/app/(tabs)/interests.tsx", "apps/mobile/src/features/interests/InterestManager.tsx", "apps/mobile/src/features/interests/useEmbedder.ts", "functions/src/interests/config.ts"
    Design: DESIGN §3.1 step 8, §5.2, §11 (the Interests tab), F18, F38, A21; PRIVACY §3–4
    Screens: priv-interests, app-interests-no-consent ("apps/mobile/preview/screens.json"); driven in the web preview, worlds this-week and this-week-no-consent (10 November 2026 12:00), in English and Danish, on 27 November 2026
    Pull requests: "https://github.com/ffMathy/friendpod/pull/5" (quiet private items), "https://github.com/ffMathy/friendpod/pull/6" (colours from the word)
```
