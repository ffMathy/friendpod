# Info pages

The transparency pages: how matching works, meeting safely, private interests,
and the legal texts (the Terms, the privacy notice, licences). They open from
many places, signed in or out, and each is a child view. This node holds how a
reader reaches them, leaves them, and follows their one link back into the app.

```ail
node InfoPages : flow   level: experience
  why   Members and people who have not signed up yet can read, at any time, how matching decides,
        how to meet safely, how private interests are protected, and the legal texts (DESIGN §11:
        transparency pages; PRIVACY §4.4).                                          <- Friendpod
  what
    Scenario: How matching works opens from Me and goes back
      Given a member this week, on Me
      When they press How matching works under Good to know
      Then How matching works opens, with Back above its title and the tab bar under it
      When they press Back
      Then Me shows again

    Scenario: Pause matching leads to Me
      Given a member this week, on How matching works
      When they press Pause matching
      Then Me shows, with Weekly drops and its Pause matching button

    Scenario: Signed out, the page only says matching can be paused
      Given someone signed out, on How matching works
      Then it says You can pause matching at any time.
      And there is no Pause matching link and no tab bar

    Scenario: The Terms open from the welcome screen and go back
      Given someone signed out, on the welcome screen
      When they press Terms
      Then the Terms open, marked Draft, with no tab bar
      When they press Back
      Then the welcome screen shows, with Continue with email

    Scenario: The privacy notice from the welcome screen in Danish
      Given someone signed out whose app is in Danish, on the welcome screen
      When they press privatlivserklæringen
      Then Privatlivserklæring opens, marked Udkast, Version fra november 2026

    Scenario: Read more on the consent step opens Private interests full screen
      Given a member choosing about private interests
      When they press Read more about sensitive interests
      Then Private interests opens, with no tab bar

  how
    decide every page can be read signed in or signed out
      because they are the transparency pages of Arts. 13 and 22, readable signed in or out ("apps/mobile/app/info/_layout.tsx")
    decide signed in, a page keeps the tab bar of the tab it was opened from; opened on its own it belongs to Me; opened from the welcome screen, onboarding or a full-screen step it has no tab bar
      because pages opened from a tab keep that tab's bar, as Settings keeps Me's, and full-screen flows stay full screen ("apps/mobile/app/info/_layout.tsx", "apps/mobile/src/features/shell/MainTabBar.tsx")
    decide each page draws its own header: Back above a display title, no eyebrow; Back shows only when there is a screen to go back to
      because the pages follow priv-delete's header and open from anywhere, so no eyebrow says where they live ("apps/mobile/app/info/_layout.tsx", "apps/mobile/app/info/legal/[doc].tsx")
    decide Pause matching does not pause anything here: it returns to Me, where Weekly drops has Pause matching
      because the pause control lives on Me ("apps/mobile/app/info/how-matching-works.tsx"); PRIVACY §4.4 asks the page to say matching can be paused
  look
    Every page: Paper (color.page), side padding space.gutter.compact, blocks space.gap apart; Back (a size.hit chevron) on top when there is somewhere to go back to,
      then the title in font.display, type.title, 800, color.text.
    Signed in and opened from the app, Friendpod's four-tab bar is drawn under the page, size.tab.bar tall, with the tab it came from selected.
  copy
    common.back   "Back"   da "Tilbage"
  binds
    route    "/me" or "/info/how-matching-works" or "/" (the welcome screen, signed out) or "/sensitive-consent"
    routes   "/info/how-matching-works", "/info/safety", "/info/sensitive-interests", "/info/legal/[doc]" with doc "terms", "privacy" or "licences"
    events   Back returns to the screen the page was opened from; Pause matching returns to Me, closing what lies between
  uses InfoHowMatchingWorks, InfoMeetingSafely, InfoPrivateInterests, InfoLegalText, InfoLicences
  children InfoHowMatchingWorks, InfoMeetingSafely, InfoPrivateInterests, InfoLegalText, InfoLicences
  sources
    Code: "apps/mobile/app/info/_layout.tsx", "apps/mobile/app/info/how-matching-works.tsx", "apps/mobile/src/features/shell/parts.tsx" (ShellPage, back), "apps/mobile/src/features/shell/MainTabBar.tsx" (which tab)
    Entry points: Me's Good to know rows, Settings' Terms, Privacy notice and Licences rows, Privacy settings, the welcome screen's links, the consent steps' Read more,
      Why this pod, This week, a pod's safety note and plan card, the private proposal's link (searched in "apps/mobile/app" and "apps/mobile/src")
    Design: DESIGN §11 (screens: info pages), PRIVACY §4.4 (transparency)
    Screens: driven in the web preview on 27 November 2026, worlds this-week, signed-out and onboarding-consent, in English and Danish
    No tickets: friendpod has no issues; pull requests #1–#8 say nothing more about these pages
```
