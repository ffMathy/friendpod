# Pod page

One pod, at `/pod/<pod id>`, from the Thursday proposal to the meetup and
after. The page takes one of three shapes, each a child: the proposal (before
the viewer is a confirmed member), the reveal (while the pod plans its
meetup), and the pod band with its next step, plan, chat and members (from the
locked plan on). The planner, the chat and what follows the meetup are
children of their own, written by other areas.

```ail
node PodPage : flow   level: experience
  why   A pod is the whole point of Friendpod: one page carries it from the Thursday proposal to the meetup
        and after, with one obvious thing to do at any time (DESIGN §3.3–3.6, F28).        <- Friendpod
  what
    The page has one of three shapes, chosen by where the viewer stands in the pod:
      not a confirmed member yet (invited, said yes and waiting, or said no): the proposal (PodProposal);
      a confirmed member while the pod plans its meetup: the reveal (PodReveal);
      a confirmed member from the locked plan on, the meetup and after included: the pod band (PodScheduled).
    Every shape ends with the main tab bar, Pods selected; a tab opens that tab.
    While the pod loads, the page shows only a spinner named Loading.
    On a pod about a private interest, screen capture is blocked where the phone allows it.

    Scenario: A pod that no longer exists
      Given a member of a confirmed pod
      When they open a pod that does not exist
      Then the page says This pod no longer exists.
      And the tab bar shows This week, Pods, Interests and Me, with Pods selected

    Scenario: Back from a pod opened on its own goes to the Pods tab
      Given a member the day before a meetup, who opened the brætspil pod directly
      When they press Back
      Then the Pods tab shows, with brætspil under Active

    Scenario: A tab leaves the pod
      Given a member of a confirmed pod, on the brætspil pod
      When they press the This week tab
      Then This week shows

    Scenario: A pod that no longer exists, in Danish
      Given a member of a confirmed pod whose app is in Danish
      When they open a pod that does not exist
      Then the page says Denne pod findes ikke længere.

  how
    decide one page for every state of a pod
      because the pod screen starts with one primary next step derived from state, then calm sections (DESIGN §3.4, F28)
    decide before confirmation the page shows the same proposal card as This week
      because the shared pod record is readable only by confirmed members ("apps/mobile/src/features/pods/membership.ts", DESIGN §9), and the page draws the card "as This week draws it" ("app/pod/[podId]/index.tsx")
    decide Back returns to the previous screen, or to the Pods tab when there is none
      because a pod page can be opened from a notification ("apps/mobile/src/features/pods/parts.tsx": "goBack")
    decide the page draws its own tab bar with Pods selected
      because the pod routes sit above the tabs, and the storyboards pod-confirmed and pod-scheduled draw the bar ("apps/mobile/src/features/pods/PodTabBar.tsx")
    decide screen capture is blocked on a pod about a private interest
      because PRIVACY §4.3 (Copying): Android screen capture can be blocked on sensitive-themed pod screens
    decide the page reads the clock once, when it opens: deadlines and the next step do not move while it stays open
      because "unknown, confirm with the owner: should the pod page refresh its next step when a deadline passes while it is open?"
  look
    Paper page (color.page) with the tab bar (size.tab.bar) at its foot: four tabs, each an icon over its label
      ("This week", "Pods", "Interests", "Me"); "Pods" selected, in color.tab.active on a color.tab.active.bg pill.
    A pod that no longer exists: a back chevron at the top left, then the message in type.body, color.text.secondary,
      space.gutter.compact from the sides.
  copy
    pod.title          "Pod"                                  da "Pod"
    pod.gone           "This pod no longer exists."           da "Denne pod findes ikke længere."
    common.loading     "Loading"                              da "Indlæser"
    common.loadFailed  "This could not be loaded. Try again later."   da "Det kunne ikke indlæses. Prøv igen senere."
    common.back        "Back"                                 da "Tilbage"
  binds
    route    /pod/{podId}, inside a stack whose planner, suggest-a-time and chat draw their own headers, and whose feedback and member sheet keep the stack header
    route    "/pod/braetspilpodaarhus46" or "/pod/doesnotexist"
    state    now: time, read once when the page opens
    shows    PodProposal unless the viewer's card says accepted and the pod is planning, scheduled, happened or archived; else PodReveal while both the card and the pod are planning; else PodScheduled
    shows    common.loadFailed over the page's blocks when the shared pod record cannot be read
    events   Back: the previous screen, else the Pods tab; a tab: that tab
  uses PodProposal, PodReveal, PodScheduled, PrivatePodPage, PodMenu, PodNextStep, PodColors
  children PodProposal, PodReveal, PodScheduled, PrivatePodPage, PodMenu, PodNextStep, PodColors, PlanMeetup, MeetupChat, AfterTheMeetup
  sources
    Code: "apps/mobile/app/pod/[podId]/index.tsx", "apps/mobile/app/pod/[podId]/_layout.tsx", "apps/mobile/src/features/pods/parts.tsx", "apps/mobile/src/features/pods/membership.ts", "apps/mobile/src/features/pods/PodTabBar.tsx", "apps/mobile/src/features/pods/ScreenCaptureGuard.tsx"
    Design: DESIGN §3.3–3.6, §4.6, F28; PRIVACY §4.3
    Screens: driven in the web preview on 27 November 2026, every pod world in English and Danish (screens.json app-pod-*, pod-confirmed, pod-scheduled)
    No tickets: friendpod has no issues, and Asana has no Friendpod project
```
