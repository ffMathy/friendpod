# Pod menu

The "⋯" at the top right of a confirmed pod's page: a sheet with the safety
tips and Leave pod.

```ail
node PodMenu : flow   level: experience
  why   Leaving a pod and the safety tips are always within reach, but kept out of the page's one
        obvious next step (DESIGN §3.8 "From the pod menu", §4.5).                          <- PodPage
  what
    A confirmed member's pod page (the reveal and the pod band) has a More options button at the top right.
    It opens a sheet titled More options with Meeting safely and Leave pod; Close shuts it.
    Leave pod asks first (Leave this pod? The others will only see that a member left., with Cancel and Leave pod);
    after leaving, the page goes back. An archived pod's menu has no Leave pod.

    Scenario: The menu offers the safety tips and Leave pod
      Given a member the day before a meetup, on the brætspil pod
      When they press More options
      Then a sheet titled More options shows Meeting safely and Leave pod

    Scenario: Meeting safely in the menu opens the safety tips
      Given a member the day before a meetup, with the pod menu open
      When they press Meeting safely in the sheet
      Then the Meeting safely page opens, with Before you go

    Scenario: Close shuts the menu
      Given a member the day before a meetup, with the pod menu open
      When they press Close
      Then the sheet is gone and the pod page shows Still coming tomorrow at 14:00?

    Scenario: The reveal has the same menu
      Given a member of a confirmed pod, on the brætspil reveal
      When they press More options
      Then the sheet shows Meeting safely and Leave pod

    Scenario: The menu in Danish
      Given a member the day before a meetup whose app is in Danish
      When they press Flere muligheder
      Then the sheet shows Mød hinanden trygt and Forlad poden

  how
    decide Leave pod and the safety tips live in a menu, not on the page
      because the pod page is one next-step card plus Plan, Chat and Members and nothing more ("app/pod/[podId]/index.tsx"; DESIGN §3.8)
    decide Leave pod is a danger outline button with its icon, never red text alone
      because decision 4 ("apps/mobile/src/features/pods/parts.tsx")
    decide leaving asks first, and the others see only that a member left
      because DESIGN §3.8: "The others see A member left"
  look
    The button: a size.hit "⋯" icon at the right of the back chevron, in the band's text colour (on a reveal field: the field's text colour).
    The sheet rises from the bottom over a color.scrim: white (color.surface), top corners radius.card, a grab handle, the title
      "More options" in type.headline, 700 with a close cross at its right; a white list row with a border.hairline color.border
      border and radius.lg: a shield, "Meeting safely" in type.body, 600, and a chevron; under it "Leave pod" full width,
      size.button.medium tall, radius.pill, white with a border.control color.danger border, a leave icon and the words in color.danger.
  copy
    pod.menu           "More options"                                    da "Flere muligheder"
    pod.safety.title   "Meeting safely"                                  da "Mød hinanden trygt"
    pod.leave          "Leave pod"                                       da "Forlad poden"
    pod.leaveTitle     "Leave this pod?"                                 da "Vil du forlade poden?"
    pod.leaveBody      "The others will only see that a member left."    da "De andre ser kun, at et medlem er gået."
    common.cancel      "Cancel"                                          da "Annullér"
  binds
    route    "/pod/braetspilpodaarhus46" (the "⋯" at the top right of the pod page)
    state    open: boolean, starting at false
    events   More options opens the sheet; Close closes it; Meeting safely closes it and opens the safety page (/info/safety)
    events   Leave pod asks; Leave pod in the question closes the sheet, leaves the pod and, once that succeeds, goes back; a failure shows its message on the page
  uses InfoMeetingSafely
  sources
    Code: "apps/mobile/src/features/pods/parts.tsx" (PodMenu), "apps/mobile/src/features/pods/PodSheet.tsx", "apps/mobile/app/pod/[podId]/index.tsx"
    Design: DESIGN §3.8, §4.5
    Screens: driven in the web preview on 27 November 2026, worlds pod-scheduled and pod-confirmed, in English and Danish (screens.json app-pod-menu)
```
