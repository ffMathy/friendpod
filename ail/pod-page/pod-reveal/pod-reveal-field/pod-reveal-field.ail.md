# Pod reveal: the field

The top of the reveal: the pod's base colour as a poster field with the pod's
name, and the white foot with every member. Each pod colour has its own type
colour on the field.

```ail
node PodRevealField : view   level: experience
  why   Colour grows with commitment: a confirmed pod gets its full base colour as a field, the third
        poster moment, and its members' names appear for the first time (DESIGN §3.4).    <- PodReveal
  what
    Members show in roster order with the viewer last, as You over their first name; the others' initials sit
    on the pod's deep tone, with their photo on top when they have one. Six members get smaller avatars.

    Scenario: A Fjord pod's reveal
      Given a member of a confirmed Fjord pod, far på barsel, with Anders, Jakob, Mikkel and Rune
      When they open the far på barsel pod
      Then far på barsel is white on the Fjord base field
      And Anders's initial is on Fjord deep

    Scenario: A Solsikke pod's reveal
      Given a member of a confirmed Solsikke pod, sourdough, with Laura
      When they open the sourdough pod
      Then sourdough is Ink on the Solsikke base field, and Laura's initial is on Solsikke deep

    Scenario: A Blad pod's reveal
      Given a member of a confirmed Blad pod, trail running, with Ida
      When they open the trail running pod
      Then trail running is Ink on the Blad base field, and Ida's initial is on Blad deep

    Scenario: An open pod's reveal
      Given a member of a confirmed open pod, with Camilla
      When they open the open pod
      Then Open to anyone is white on the Blomme base field, and Camilla's initial is on Blomme deep

    Scenario: The brætspil reveal is Tomat
      Given a member of a confirmed pod, brætspil, with Mette
      When they open the brætspil pod
      Then brætspil is Ink on the Tomat base field, and Mette's initial is on Tomat deep

  how
    decide white type on Fjord and Blomme, Ink type on Solsikke, Blad, Bær and Tomat
      because each pod colour names the type colour that goes on its base ("apps/mobile/src/components/theme.ts"; screens.json app-pod-fjord-confirmed, app-pod-solsikke-confirmed, app-pod-blad-confirmed)
    decide the pod's name fits the field at the largest display size that keeps each word whole, wrapping only at spaces, on at most two lines
      because screens.json app-pod-fjord-confirmed: "at the fit-rule step that keeps barsel whole (56, 52 or 48)"
    decide the viewer is last, and is not a link
      because the storyboards put the viewer last ("apps/mobile/src/features/pods/PodMembers.tsx"), and the viewer has no sheet of their own (Reveal.tsx)
  look
    The field (full width, from the top edge): the pod's base (pod.fjord.base, pod.solsikke.base, pod.blad.base, pod.blomme.base,
      pod.tomat.base); in its top right corner the 176px reveal mark (people around a sun, the viewer's figure solid); the back
      chevron and "⋯" in the field's type colour; the white "Confirmed" pill with a tick (radius.pill, type.caption, 700, color.text);
      the name in font.display, type.display.xl, 700, white (color.on.primary) on Fjord and Blomme, color.ink on the others.
    The foot: a white card (color.surface, border.hairline color.border, radius.card) overlapping the field's bottom by 28px,
      space.gutter.compact from the sides: "5 people near Aarhus C" in type.small.text, 600, color.text.secondary, then one row of
      members, each a 52px disc (44px for six) over the first name in type.caption, 700; the viewer's disc color.ink with "You"
      in color.on.ink and a ring.
  copy
    pod.confirmed          "Confirmed"                           da "Bekræftet"
    pod.peopleNear_one     "{{count}} person near {{area}}"      da "{{count}} person i nærheden af {{area}}"
    pod.peopleNear_other   "{{count}} people near {{area}}"      da "{{count}} personer i nærheden af {{area}}"
    pod.you                "{{name}} (you)"                      da "{{name}} (dig)"
    pod.photoOf            "Photo of {{name}}"                   da "Billede af {{name}}"
    common.you             "You"                                 da "Dig"
  binds
    route    "/pod/farpaabarselpod46aaa" or "/pod/sourdoughpodwk46aaaa" or "/pod/trailrunpodwk46aaaaa" or "/pod/openpodaarhusweek46a" or "/pod/braetspilpodaarhus46" (the top of the reveal)
    props    the theme in the viewer's words (or Open to anyone), the pod's colour from PodColors, "5 people near Aarhus C", the members
    events   a member (not the viewer) opens their sheet
  uses PodColors
  sources
    Code: "apps/mobile/src/features/pods/Reveal.tsx", "apps/mobile/src/features/pods/MemberAvatar.tsx", "apps/mobile/src/components/Pod.tsx" (PosterField, PosterFoot)
    Screens: driven in the web preview on 27 November 2026, worlds pod-confirmed, pod-fjord-confirmed, pod-solsikke-confirmed, pod-blad-confirmed, pod-open-confirmed (screens.json)
```
