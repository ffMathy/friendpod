# Meetup place picker

The Place search on "Suggest a time": the member types, public places come up
as cards ("name" over "Café · Aarhus C"), and the one they pick is marked. In
the web preview the search answers from the world's fixed list of placeholder
places instead of Google.

```ail
node MeetupPlacePicker : view   level: experience
  why   A meetup is always at a public place, so the place is picked from a search
        that only finds public places: no free text, no home address, and no
        "is this public?" tick (DESIGN F23, §3.5, D8).                         <- SuggestMeetupOption
  what
    Scenario: Searching shows public places
      Given a member planning a meetup, on Suggest a time, whose search finds [Café name], Latin Quarter and [Café bar name], cafés in Aarhus C, and [Bakery café name], a bakery in Aarhus C
      When they type café in Place
      Then the results read [Café name], Latin Quarter over Café · Aarhus C, [Café bar name] over Café · Aarhus C and [Bakery café name] over Bakery · Aarhus C
      And under them Places from Google Maps.

    Scenario: One letter searches nothing
      Given a member planning a meetup, on Suggest a time
      When they type c in Place
      Then no places and no message are shown

    Scenario: A picked place is marked and stays on top
      Given a member planning a meetup, on Suggest a time, with café typed in Place
      When they pick [Café bar name]
      Then it is marked Selected
      When they change the search to zzz
      Then [Café bar name] is still shown, marked Selected, and no other place

    Scenario: Nothing found
      Given a member planning a meetup, on Suggest a time, with no place picked
      When they type zzz in Place
      Then it says No public places found. Try another name.

    Scenario: The place search in Danish
      Given a member planning a meetup whose app is in Danish, on Foreslå et tidspunkt
      When they type café in Sted
      Then the results include [Bagericafénavn] over Bageri · Aarhus C, under them Steder fra Google Maps.
      When they type zzz
      Then it says Ingen offentlige steder fundet. Prøv et andet navn.

  how
    decide the search starts at 2 characters, 300 ms after the last key
      because "PlacePicker.tsx" (300 ms debounce, 2 characters)
      because "unknown, confirm with the owner: DESIGN §11 and COSTS §3.2 say Places is searched from 3 characters; which is right?"
    decide only public place types are offered, and a picked place that turns out not to be public is refused with a message
      because public places by construction (DESIGN F23, the public place types of §3.5)
    decide one place search session per pick: the typing and the final details request are billed together
      because Places is the largest running cost, and a session that ends in the basic details is cheapest (COSTS §3.2)
    decide Google's attribution line sits under the results
      because Places data shown without a map requires it ("PlacePicker.tsx")
    decide the search is biased towards the member's own area, which is never sent to Friendpod's servers
      because the bias needs only the member's rough area cell (DESIGN F23; "PlacePicker.tsx")
  look
    "Place" (type.label, 700, color.text) 6px over a size.input.compact search field with a search icon, radius.md and a border.field color.field border,
      and the helper under it in type.caption, color.text.muted. Results 18px below, 8px apart: cards at least 64px tall with radius.lg,
      white with a border.control color.border.strong border, a pin (color.text.secondary), the name in type.label 700 and "kind · area" in type.caption, color.text.muted;
      the picked card has a border.strong color.primary border and a color.primary tick at the right. The attribution in type.micro, color.text.muted, right-aligned.
    Messages: "No public places found" in type.caption, color.text.muted; a refusal in type.small.text, 600, color.danger.
  copy
    plan.place            "Place"   da "Sted"
    plan.placeHint        "Search for a café, library, park…"   da "Søg efter en café, et bibliotek, en park …"
    plan.placeHelper      "Cafés, bars, libraries, parks and other public places near the pod."   da "Caféer, barer, biblioteker, parker og andre offentlige steder i nærheden af poden."
    plan.places           "Places"   da "Steder"
    plan.selected         "Selected"   da "Valgt"
    plan.placeAttribution "Places from Google Maps."   da "Steder fra Google Maps."
    plan.placeNoResults   "No public places found. Try another name."   da "Ingen offentlige steder fundet. Prøv et andet navn."
    plan.placeNotPublic   "That isn't a public place. Pick a café, library, park or similar."   da "Det er ikke et offentligt sted. Vælg en café, et bibliotek, en park eller lignende."
    plan.placeFailed      "Places couldn't be searched right now. Try again."   da "Vi kan ikke søge efter steder lige nu. Prøv igen."
    plan.placeTypes.cafe  "Café"   da "Café"
    plan.placeTypes.bakery "Bakery"   da "Bageri"
    plan.placeTypes.library "Library"   da "Bibliotek"
    plan.placeTypes.park  "Park"   da "Park"
  binds
    route    "/pod/braetspilpodaarhus46/propose" (Place on Suggest a time)
    props    language: "da" | "en", value: a picked place or nothing, onChange(place)
    role     the search is a text box named "Place"; each result is a button named "name, kind, area"; the picked one holds an image named "Selected"
    shows    each place's kind from plan.placeTypes, one text for each of the 25 public place types
  sources
    Code: "apps/mobile/src/features/places/PlacePicker.tsx", "apps/mobile/src/features/places/google.ts", "packages/core/src/types/domain.ts" (the public place types), "apps/mobile/preview/scenarios/_pod.ts" (the preview's places), "apps/mobile/preview/runtime/network.ts"
    Design: DESIGN F23, D8, §3.5, §11 (Places); COSTS §3.2
    Screens: pod-propose storyboard; driven in the web preview, world pod-planning, in English and Danish, on 27 November 2026
```
