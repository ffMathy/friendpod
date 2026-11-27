# Why this pod

The bottom sheet behind Why this pod? on a proposal (storyboard drop-why, route
`/sheets/why-this-pod?podId=…`): the reasons the drop sent, what Friendpod never uses, and how matching works.

```ail
node DropWhy : flow   level: experience
  why   A member can see why the drop proposed this pod, in their own words and nothing
        about anyone else (DESIGN §3.2 "Why this pod renders server reason codes", §6.7).   <- DropProposal
  what
    The lines are the pod's reasons, each led by a disc in the pod's tint: a tick for why the pod fits, a clock for priority.
    The theme, shared interests and a related interest say only the member's own wording, in bold. Distance and area read
    as one line when both are there. Priority is about the member, not the pod, so it comes last.
    Until the card has loaded, the sheet shows a spinner named Loading under its title.

    Scenario: The reasons for the brætspil pod
      Given a member with a pod proposal: brætspil, sharing sourdough and trail running, within about 10 km of Aarhus C, ages 29–38, after waiting 2 weeks
      When Why this pod opens
      Then it reads, in this order, Everyone added brætspil, or something that means the same.,
        You also share sourdough and trail running with some of them., Everyone lives about 10 km or less from you, near Aarhus C.,
        Ages 29–38: everyone is inside everyone else's age range. and You waited 2 weeks, so you got priority this time.
      And What we never use, with Photos, looks, or anything you haven't told us. Gender only if you chose same-gender pods. Private interests only as the theme of a pod about them.
      And How matching works

    Scenario: Close returns to the proposal
      Given a member with a pod proposal who pressed Why this pod? on Home
      When they press Close
      Then the sheet is gone and the proposal shows, with I'm in

    Scenario: Tapping beside the sheet closes it
      Given a member with a pod proposal who pressed Why this pod? on Home
      When they tap the dimmed proposal above the sheet
      Then the sheet is gone

    Scenario: How matching works from the sheet
      Given a member with a pod proposal, on Why this pod
      When they press How matching works
      Then How matching works opens

    Scenario: Why this pod in Danish
      Given a member with a pod proposal whose app is in Danish
      When Why this pod opens
      Then it reads Hvorfor denne pod, Alle har tilføjet brætspil eller noget, der betyder det samme. and Du har ventet 2 uger, så du fik forrang denne gang.
      And Det bruger vi aldrig and Sådan matcher vi

  how
    decide only the server's reason codes are rendered: no blocks, reliability or anyone's private interests
      because DESIGN §6.7 never mentions sensitive concepts other than the theme, or reliability ("app/sheets/why-this-pod.tsx")
    decide a bottom sheet over the dimmed screen it was opened from, as tall as its content; the dimmed part closes it on touch, the cross for everyone
      because the storyboard drop-why draws it so, and the close cross is the accessible way out ("app/sheets/why-this-pod.tsx", "apps/mobile/src/features/after/parts.tsx")
  look
    The screen behind dimmed with color.scrim; a white (color.surface) sheet from the bottom with radius.hero top corners, a 4px color.border.strong handle,
      side padding space.gutter.compact, blocks 16px apart.
    Title "Why this pod" in font.display, type.title.modal, 800, with a close cross (size.hit) at its right.
    The lines 14px apart: a 36px disc in the pod's tint (pod.tomat.tint for brætspil) with a tick or clock in its deep tone, 12px from the text in type.body.small, color.text.secondary, the words in bold color.text.
    The note: white with a border.hairline color.border border, radius.lg, an info icon; "What we never use" in type.small.text, 700 over the text in type.caption, color.text.secondary.
    "How matching works" at the left, underlined, bold, color.link.
  copy
    pods.whyThisPod       "Why this pod"                                                  da "Hvorfor denne pod"
    common.close          "Close"                                                         da "Luk"
    pods.why.THEME        "Everyone added {{wording}}, or something that means the same."  da "Alle har tilføjet {{wording}} eller noget, der betyder det samme."
    pods.why.SOFT_THEME   "Your {{yourTag}} is close to this pod's {{podTheme}}."          da "Din interesse {{yourTag}} ligger tæt på podens {{podTheme}}."
    pods.why.ALSO_SHARE   "You also share {{list}} with some of them."                     da "Du deler også {{list}} med nogle af dem."
    pods.why.NEAR_AREA    "Everyone lives about {{km}} km or less from you, near {{label}}."   da "Alle bor højst ca. {{km}} km fra dig, omkring {{label}}."
    pods.why.NEAR_YOU     "Everyone lives about {{km}} km or less from you."               da "Alle bor højst ca. {{km}} km fra dig."
    pods.why.AREA         "Everyone lives near {{label}}."                                 da "Alle bor i nærheden af {{label}}."
    pods.why.AGE_SPAN     "Ages {{min}}–{{max}}: everyone is inside everyone else's age range."   da "{{min}}–{{max}} år: alle er inden for hinandens aldersinterval."
    pods.why.OPEN_TO_ANYONE "You're open to meeting anyone near you."                      da "Du er åben for at møde hvem som helst i nærheden."
    pods.why.PRIORITY_one   "You waited {{count}} week, so you got priority this time."    da "Du har ventet {{count}} uge, så du fik forrang denne gang."
    pods.why.PRIORITY_other "You waited {{count}} weeks, so you got priority this time."   da "Du har ventet {{count}} uger, så du fik forrang denne gang."
    pods.why.neverTitle   "What we never use"                                             da "Det bruger vi aldrig"
    pods.why.neverBody    "Photos, looks, or anything you haven't told us. Gender only if you chose same-gender pods. Private interests only as the theme of a pod about them."   da "Billeder, udseende eller noget, du ikke har fortalt os. Køn kun, hvis du har valgt pods for samme køn. Private interesser kun som tema for en pod om netop dem."
    home.howMatching      "How matching works"                                            da "Sådan matcher vi"
  binds
    route    "/sheets/why-this-pod?podId=braetspilpodaarhus46" or "/" (Why this pod? on the proposal card on Home)
    props    podId: text, from the route
    shows    one line per reason from DropReasons, in the order the server sent them, PRIORITY moved last and AREA left out when NEAR_YOU is there
    events   Close and the dimmed part go back; How matching works opens "/info/how-matching-works"
  uses DropReasons
  sources
    Code: "apps/mobile/app/sheets/why-this-pod.tsx", "apps/mobile/app/sheets/_layout.tsx", "apps/mobile/src/features/after/parts.tsx", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2, §6.7
    Storyboard: drop-why ("apps/mobile/preview/screens.json": "Server reason codes only")
    Screens: driven in the web preview, world drop-proposal, in English and Danish, on 27 November 2026
```
