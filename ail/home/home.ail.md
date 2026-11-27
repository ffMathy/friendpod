# Home

The This week tab (route `/` for an onboarded member) and the tab bar under it. Home has one state at a time:
the city waitlist while the member's city is not open, the drop's answer on Thursday evening (a proposal, the
wait for the others, or no pod), and otherwise this week before the next drop. Each state is a child.

```ail
node Home : flow   level: experience
  why   Friendpod is a weekly ritual: every Thursday at 18:00 the drop brings a pod, or says
        why there is none, and Home is where a member meets it (DESIGN §3.2), or waits for
        their city to open (DESIGN F34).                                                    <- Friendpod
  what
    Home shows exactly one of these, checked in this order:
      the city waitlist, while the member's city is on its waitlist or in beta;
      a message that it could not be loaded, when the member's profile or pods cannot be read;
      the drop's answer, while a proposal waits for the member's answer, or the member said yes and the pod waits for the others;
      no pod this week, from the drop that left the member out until the end of that week;
      otherwise this week before the next drop.
    While any of it is loading, Home shows only a spinner named Loading.

    Scenario: The no-pod answer ends with its week
      Given a new member with nothing yet, on Tuesday 10 November 2026 in week 46, whom last week's drop left without a pod
      When Home opens
      Then it reads This week, Next drop and Thursday 18:00
      And No pod for you this week is not shown

    Scenario: The tabs lead to Pods, Interests and Me
      Given a member this week, on Home
      When they press the Pods tab
      Then the Pods tab opens, with Active and Past
      When they press the Interests tab
      Then the Interests tab opens
      When they press the Me tab
      Then the Me tab opens, with Weekly drops
      When they press the This week tab
      Then Home shows again, with What we'll match on

  how
    decide the waitlist comes before everything else, and is read live
      because Home is the waitlist screen on every app open until the city's status turns live, and the live read switches it without a restart (DESIGN §3.1 step 13)
    decide a waiting proposal comes before the no-pod answer
      because a proposal is the drop's answer the member can act on (DESIGN §3.2; "app/(tabs)/index.tsx")
    decide the no-pod answer stands from Thursday's release to the end of that week; from Monday the next drop is ahead
      because the code says so ("app/(tabs)/index.tsx": "The no-pod answer stands from Thursday's release to the end of that week")
  copy
    common.loading     "Loading"                                       da "Indlæser"
    common.loadFailed  "This could not be loaded. Try again later."    da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    state    which state shows, decided from the member's profile (city and its status, last drop), their pod cards and the clock
    shows    the load-failed message on a white card under the This week title, when the profile is missing or the pods could not be read
  uses HomeTabBar, CityWaitlist, DropProposal, DropWaiting, PrivatePodProposal, NoPodThisWeek, DropHome
  children HomeTabBar, CityWaitlist, DropProposal, DropWaiting, PrivatePodProposal, NoPodThisWeek, DropHome, DropReasons
  sources
    Code: "apps/mobile/app/(tabs)/index.tsx", "apps/mobile/app/(tabs)/_layout.tsx", "packages/core/src/geo/waitlist.ts"
    Design: DESIGN §3.1 step 13, §3.2, §4.1 (drop schedule), F34
    Screens: driven in the web preview, worlds me-new, this-week and the drop worlds, in English and Danish, on 27 November 2026
    Storyboards: "apps/mobile/preview/screens.json" (drop-home, drop-proposal, drop-waiting, drop-none, priv-sensitive, city-waitlist)
    No tickets: friendpod has no issues, and Asana has no Friendpod project
```
