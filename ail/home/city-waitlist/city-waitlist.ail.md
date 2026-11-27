# City waitlist

Home while the member's city is not open yet (storyboard city-waitlist): how many have signed up in the city,
a way to share the city's invite link, and what to do while waiting. It stands alone, without the tab bar.

```ail
node CityWaitlist : flow   level: experience
  why   People install and onboard normally in a city that is not open yet; until it opens,
        Home is a waitlist with the city's count, what happens next and a way to bring others,
        with nothing in the link about who shared it (DESIGN F34, §3.1 step 13).       <- Home
  what
    The share card lets the member share or copy the city's invite link.
    It shows on every app open while the member's city is on its waitlist or in beta, and gives way to this week as soon as the city opens.
    The count is the city's exact total from 10 up, and "<10" below; the bar fills to the city's goal and stops there.

    Scenario: The waitlist instead of this week
      Given a member in a city on the waitlist: Odense, 186 of 250
      When Home opens
      Then it reads You're on the list, Odense opens soon, Odense waitlist, 186 and of 250
      And the progress bar People on the Odense waitlist is shown
      And it reads Help Odense open sooner, Share invite link and friendpod.dk/c/odense
      And While you wait offers Add a few more interests, and Profile and settings is the last link
      And there is no tab bar

    Scenario: Copy copies the invite link
      Given a member in a city on the waitlist, on Home
      When they press Copy
      Then the button reads Copied

    Scenario: The interests while you wait
      Given a member in a city on the waitlist, on Home
      When they press Add a few more interests
      Then the Interests tab opens, with the tab bar

    Scenario: Profile and settings opens Me
      Given a member in a city on the waitlist, on Home
      When they press Profile and settings
      Then the Me tab opens, with Weekly drops and the tab bar

    Scenario: The waitlist in Danish
      Given a member in a city on the waitlist whose app is in Danish
      When Home opens
      Then it reads Du er på listen, Odense åbner snart, Venteliste for Odense and af 250
      And Hjælp Odense med at åbne hurtigere, Del invitationslink, Kopiér, Mens du venter and Profil og indstillinger

  how
    decide the screen is calm: no poster field, no mark
      because it is not a poster moment, as the storyboard draws it ("apps/mobile/preview/screens.json", city-waitlist)
    decide no tab bar while the city is closed, with a quiet Profile and settings link to Me instead
      because "this screen stays until then", and the profile, privacy settings, notices and account deletion must stay reachable ("apps/mobile/src/features/waitlist/WaitlistScreen.tsx"); the link sits where the storyboard has its prototype link (screens.json)
    decide the next-step text says the goal is a target, not a promise
      because the app's wording is kept over the storyboard's (screens.json, city-waitlist)
  look
    Paper page (color.page), side padding space.gutter.compact, blocks space.gap apart, the top 40px down; the WaitlistShareCard under the count card.
    "You're on the list" in type.small.text, 600, color.text.muted over "Odense opens soon" in font.display, type.title, 800, color.text, 4px apart.
    The count card: white (color.surface, radius.card, border.hairline color.border, padding space.card); the eyebrow "ODENSE WAITLIST" in type.eyebrow, 700, upper case, color.text.muted;
      "186" in font.display, type.display.l, 800 with "of 250" in type.card.title, 600, color.text.muted on its baseline; a 10px bar, color.primary on color.track, radius.pill; the text in type.small.text, line height 21px, color.text.secondary.
    "While you wait" in type.heading, 700, then a white row (radius.card, border.hairline color.border, min 52px) "Add a few more interests" in type.body, 600 with a chevron.
    "Profile and settings" centred, type.caption, 600, color.text.muted, underlined, size.hit tall.
  copy
    waitlist.eyebrow           "You're on the list"                       da "Du er på listen"
    waitlist.title             "{{city}} opens soon"                      da "{{city}} åbner snart"
    waitlist.cardTitle         "{{city}} waitlist"                        da "Venteliste for {{city}}"
    waitlist.ofGoal            "of {{goal}}"                              da "af {{goal}}"
    waitlist.counter           "{{n}} of {{goal}} signed up"              da "{{n}} af {{goal}} tilmeldt"
    waitlist.progressLabel     "People on the {{city}} waitlist"          da "Tilmeldte på ventelisten for {{city}}"
    waitlist.next              "We're aiming for {{goal}} people in {{city}} before we open the city. Your first drop is the Thursday after, at 18:00. We'll send you a notification."   da "Målet er {{goal}} tilmeldte i {{city}}, før vi åbner byen. Dit første drop kommer torsdagen efter kl. 18.00, og vi sender dig en notifikation."
    waitlist.whileYouWait      "While you wait"                           da "Mens du venter"
    waitlist.moreInterests     "Add a few more interests"                 da "Tilføj et par interesser mere"
    waitlist.profileAndSettings "Profile and settings"                    da "Profil og indstillinger"
  binds
    route    "/" (Home, while the member's city is on the waitlist)
    props    city: text (the city's name in the app's language), count: integer (the city's exact total), goal: integer, the city's area id
    role     the count is one element named waitlist.counter; the bar is a progress bar named waitlist.progressLabel, from 0 to the goal
    events   Add a few more interests opens "/interests"; Profile and settings opens "/me"
  uses CityWaitlistRules, WaitlistShareCard
  children CityWaitlistRules, WaitlistShareCard
  sources
    Code: "apps/mobile/src/features/waitlist/WaitlistScreen.tsx", "apps/mobile/src/features/waitlist/cityLink.ts", "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/src/i18n/en/onboarding.json", "apps/mobile/src/i18n/da/onboarding.json"
    Design: DESIGN F34, §3.1 steps 12–13, §8.1 (areas); pull request 4 ("plus the city waitlist")
    Storyboard: city-waitlist ("apps/mobile/preview/screens.json": calm, no field; the app's next-step wording; Profile and settings)
    Screens: driven in the web preview, world waitlist-odense, in English and Danish, on 27 November 2026; the share sheet is a fake there
```
