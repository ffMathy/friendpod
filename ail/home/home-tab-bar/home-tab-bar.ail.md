# Home tab bar

The bar at the bottom of the four tabs: This week, Pods, Interests and Me. Home owns it because This week is
its first tab; the city waitlist hides it.

```ail
node HomeTabBar : view   level: experience
  why   The storyboards draw one bottom bar with four tabs, and the weekly drop is the
        first of them ("app/(tabs)/_layout.tsx").                                   <- Home
  what
    The bar shows on every tab page, except while Home is the city waitlist.
    The tab of the page on show is selected; pressing a tab opens its page.

    Scenario: This week is the active tab on Home
      Given a member this week
      When Home opens
      Then the tab bar shows This week, Pods, Interests and Me, in that order
      And This week is the selected tab

    Scenario: The tab bar in Danish
      Given a member this week whose app is in Danish
      When Home opens
      Then the tab bar shows Denne uge, Pods, Interesser and Mig
      And Denne uge is the selected tab

  how
    decide four tabs: This week, Pods, Interests, Me
      because they are the four tabs of the storyboards' bottom nav ("app/(tabs)/_layout.tsx")
    decide the active tab is marked by a tinted pill behind its icon and a heavier label, not by colour alone
      because the storyboards draw the active tab so ("apps/mobile/src/components/navigation.tsx": "on a 56 × 30 Skov-tint pill when the tab is active", "Bold when selected")
  look
    A white (color.surface) bar size.tab.bar tall plus the bottom safe area (at least 16px), with a border.hairline color.border top edge and 8px top padding.
    Four equal tabs, each a size.icon icon (calendar, people, tag, person) centred in a 56×30 pill with radius.pill, over its label in type.micro.
    The selected tab: the pill filled color.tab.active.bg, icon and label color.tab.active, the label 800.
    The others: no pill fill, icon and label color.tab.inactive, the label 600.
  copy
    tabs.thisWeek    "This week"   da "Denne uge"
    tabs.pods        "Pods"        da "Pods"
    tabs.interests   "Interests"   da "Interesser"
    tabs.me          "Me"          da "Mig"
  binds
    route    "/" (the bar at the bottom of Home)
    role     a tab list with four tabs, named by their labels; the page on show is the selected one
    events   pressing a tab opens its page: the routes "/", "/pods", "/interests" and "/me", in the tabs' order
  sources
    Code: "apps/mobile/app/(tabs)/_layout.tsx", "apps/mobile/src/components/navigation.tsx", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Screens: driven in the web preview, world this-week, in English and Danish, on 27 November 2026
```
