# Me: your interests

"Your interests" on Me: the member's ordinary interests as pod-coloured chips,
the main ones starred, and the private ones only as a count with a lock. Edit
opens the Interests tab, where interests are managed.

```ail
node MeInterestsCard : view   level: experience
  why   A member sees at a glance what they will be matched on, while private interests are never named
        on the page that looks most like a profile (PRIVACY §3; DESIGN §11).   <- Me
  what
    Scenario: Interests as chips, the private one only counted
      Given a member this week
      When Me opens
      Then Your interests shows brætspil, sourdough, far på barsel and trail running, brætspil marked Main interest
      And it says 1 private interest, and gravid is nowhere on the page

    Scenario: Edit opens the Interests tab
      Given a member this week, on Me
      When they press Edit your interests
      Then the Interests tab opens

    Scenario: Your interests in Danish
      Given a member this week whose app is in Danish
      When Me opens
      Then the card reads Dine interesser, Ret and 1 privat interesse

  how
    decide each chip has the colour of its word, the same for everyone and everywhere
      because colours come from the word shown, not the concept (pull request 6, "apps/mobile/src/lib/podColor.ts")
    decide private interests are a count with the lock, never named
      because Me is the member's own summary but looks most like a profile, and private interests are never on one ("apps/mobile/src/features/shell/InterestsCard.tsx")
    decide the card appears once the interests have loaded, and not at all when they cannot be
      because Me works without it ("apps/mobile/src/features/shell/InterestsCard.tsx")
    decide interests are managed on the Interests tab, not here
      because "unknown, confirm with the owner: is a read-only summary with Edit the wanted design, rather than editing on Me?"
  look
    A white card (color.surface, border.hairline color.border, radius.card, padding space.card), its parts 12px apart.
    The header row: "Your interests" in type.eyebrow, 800, upper case, color.text.muted, and "Edit" at the right as a compact underlined link in type.label, 700, color.link.
    The chips in a wrapping row, 8px apart: size.tag tall, radius.pill, each in its word's pod colour (a pod.*.tint fill, a dot in pod.*.base, the word in type.chip, 600, color.text),
      a main interest with a small color.ink star after the word.
    The private count: a lock and the text in type.caption, 700, color.text.
    With no interests: "No interests yet. Add a few so we can find you a pod." in type.small.text, color.text.secondary.
  copy
    me.interestsTitle          "Your interests"   da "Dine interesser"
    me.editInterests           "Edit"             da "Ret"
    me.editInterestsLabel      "Edit your interests"   da "Ret dine interesser"
    me.noInterests             "No interests yet. Add a few so we can find you a pod."   da "Ingen interesser endnu. Tilføj et par stykker, så vi kan finde en pod til dig."
    me.privateInterests_one    "{{count}} private interest"    da "{{count}} privat interesse"
    me.privateInterests_other  "{{count}} private interests"   da "{{count}} private interesser"
    common.mainInterest        "Main interest"    da "Hovedinteresse"
  binds
    route    "/me" (Your interests on Me)
    props    the member's interests (word, starred) and the number of private ones
    role     Edit is a link named "Edit your interests"; a star is an image named "Main interest"
    events   Edit opens "/interests"
  uses Interests
  sources
    Code: "apps/mobile/src/features/shell/InterestsCard.tsx", "apps/mobile/src/lib/podColor.ts", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: PRIVACY §3 (private interests), DESIGN §11; pull request 6 ("Colour interests and pods from the word shown"); "apps/mobile/preview/screens.json" app-me
    Screens: driven in the web preview on 27 November 2026, world this-week, in English and Danish
```
