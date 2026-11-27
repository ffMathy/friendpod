# Proposal facts

The middle of a proposal card: the seats, the facts about the pod, and when names and photos appear.

```ail
node ProposalFacts : view   level: experience
  why   A member decides on a pod from its size, area, distance, ages and what else they
        share, never from who is in it (DESIGN §3.2 "The card shows" and "never shows").   <- DropProposal
  what
    The seats are You and one open seat for each other person the pod is for; a proposal never lights a seat for anyone else.
    The facts are: the size, with the age span for an ordinary theme; the area, with everyone within about N km when the drop sent a distance;
    and, for an ordinary theme, the interests the member also shares, in their own words, bold, joined with and.
    The note says names and photos appear when the city's confirming number have said yes, or once the pod is confirmed when that number
    is not known, or, for a pod that is already confirmed, once the member joins.

    Scenario: The facts of the brætspil proposal
      Given a member with a pod proposal: brætspil for 5 people aged 29–38, near Aarhus C within about 10 km, sharing sourdough and trail running, in a city that confirms at 4
      When Home opens
      Then the card shows You and four open seats
      And 5 people, ages 29–38
      And Near Aarhus C · everyone within about 10 km of you
      And Some of you also share sourdough and trail running
      And Names and photos appear when 4 people have said yes.

  how
    decide the distance reads "about", never exact
      because distances compare cell centroids, so they are approximate (DESIGN §3.2)
    decide shared interests are only the member's own wordings, at most 3
      because ALSO_SHARE carries only the viewer's own wording (DESIGN §6.7)
  look
    Under the band, padding space.hero, 16px apart: the seats (size.seat circles: You filled color.ink with "You" in color.on.ink, the open ones dashed color.field);
      three fact lines (18px icons in the pod's deep tone, type.body.small, color.text) with the shared interests bold; a color.inset note (radius.md, padding 10px 12px) with a dashed ring and type.caption, color.text.secondary.
  copy
    common.you            "You"                                  da "Dig"
    pods.people_one       "{{count}} person"                     da "{{count}} person"
    pods.people_other     "{{count}} people"                     da "{{count}} personer"
    pods.peopleAges_one   "{{count}} person, ages {{min}}–{{max}}"   da "{{count}} person, {{min}}–{{max}} år"
    pods.peopleAges_other "{{count}} people, ages {{min}}–{{max}}"   da "{{count}} personer, {{min}}–{{max}} år"
    pods.near             "Near {{area}}"                        da "Tæt på {{area}}"
    pods.nearWithin       "Near {{area}} · everyone within about {{km}} km of you"   da "Tæt på {{area}} · alle bor højst ca. {{km}} km fra dig"
    pods.alsoShare        "Some of you also share {{list}}"      da "Nogle af jer deler også {{list}}"
    pods.and              "and"                                  da "og"
    pods.revealAt         "Names and photos appear when {{count}} people have said yes."   da "Navne og billeder vises, når {{count}} har sagt ja."
    pods.revealOnConfirm  "Names and photos appear once the pod is confirmed."             da "Navne og billeder vises, når poden er bekræftet."
    pods.revealOnJoin     "This pod is already confirmed. You'll see names and photos once you join."   da "Poden er allerede bekræftet. Du ser navne og billeder, når du siger ja."
  binds
    props    the pod's card (size, age span, area, reasons, state, private or not), the confirming number or nothing, the pod's colour
    role     the seats are hidden from screen readers
  uses DropReasons
  sources
    Code: "apps/mobile/src/features/pods/ProposalCard.tsx", "apps/mobile/src/features/drop/parts.tsx", "apps/mobile/src/features/drop/richText.tsx", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §3.2, §6.7
    Screens: driven in the web preview, worlds drop-proposal and pod-open-proposal, in English and Danish, on 27 November 2026
```
