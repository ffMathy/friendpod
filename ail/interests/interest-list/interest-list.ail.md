# Interest list

The card of ordinary interests on the Interests tab: each row with its star,
the dot in its word's pod colour, the interest in the member's own words and
"…", which opens the row's actions under it.

```ail
node InterestList : flow   level: experience
  why   A member keeps their interests current, and can make any of them private, from one
        list (DESIGN §11: the Interests tab; §5.2 (5)).                                     <- Interests
  what
    Each row shows the star, a dot in the pod colour of the interest's word, the interest as the member wrote it, and "…".
    Pressing "…" or the interest's name opens Keep this private and Remove under the row; pressing it again closes them. One row is open at a time.
    An interest the member once made ordinary with This isn't sensitive for me shows Keep this private in place of "…", and its name opens Remove.
    There is no way to change an interest's wording: the member removes it and adds the new wording.
    With consent to private interests, Keep this private moves the interest to the private card and says This interest is now private.
      The web preview cannot play this: its server adds the text again as a new ordinary interest.
    With no interests at all, the card says No interests yet.

    Scenario: "…" opens the row's actions
      Given a member this week on the Interests tab
      When they press More for sourdough
      Then Keep this private and Remove show under sourdough
      When they press More for sourdough again
      Then neither shows under sourdough any more

    Scenario: Remove takes an interest off the list at once
      Given a member this week with 5 interests
      When they press More for sourdough and then Remove
      Then sourdough is no longer listed and the count reads 4 of 20
      And the tab says Add at least 3. 5 or more gives better pods.

    Scenario: An interest made ordinary keeps Keep this private at hand
      Given a member this week who said far på barsel isn't sensitive for them
      When the Interests tab opens
      Then the far på barsel row shows Keep this private and no "…"
      When they press far på barsel
      Then Remove far på barsel shows under it, and no second Keep this private

    Scenario: The row's actions in Danish
      Given a member this week whose app is in Danish
      When they press Flere valg for brætspil
      Then Hold den privat and Fjern show under brætspil

  how
    decide Remove acts at once, with no confirmation
      because "unknown, confirm with the owner: Remove deletes an interest without asking; is that intended, and should it be undoable?"
    decide Keep this private is offered on every ordinary interest, and goes through the same check as adding
      because a member can make any interest private, at add time or later, always through the same call (DESIGN §5.2 (5) row 3)
    decide an interest made ordinary shows Keep this private in its row instead of "…"
      because the storyboard draws it so: the way back to private stays at hand (priv-interests; "apps/mobile/src/features/interests/InterestManager.tsx")
    decide each word has its own pod colour, the same everywhere and for everyone
      because the founder decided colours come from the word shown (pull request 6)
    decide no edit action
      because "unknown, confirm with the owner: the app has no way to edit an interest's wording; should it?"
  look
    The white list card (color.surface, border.hairline color.border, radius.card, space.card side padding); its eyebrow "INTERESTS" in type.eyebrow, 800, upper case, color.text.muted, 10px from the top.
    Rows at least 52px tall, split by border.hairline color.separator lines: the star (a size.hit target with a 20px star in color.ink, filled for a main interest),
      a 10px dot in the word's pod colour (pod.*.base, with a ring), the interest in type.body, 600, color.text, and "…" (a size.hit target, 20px dots in color.text.muted) at the end.
    The actions open under the row, lined up with the dot, 8px apart: Keep this private (size.hit tall, radius.pill, color.surface with a border.control color.border.strong border, a 14px lock and type.caption, 700, color.text)
      and Remove (the same pill with a border.control color.danger border, a 16px trash and type.chip, 700, color.danger).
  copy
    interests.listTitle      "Interests"                       da "Interesser"
    interests.moreNamed      "More for {{name}}"               da "Flere valg for {{name}}"
    interests.keepPrivate    "Keep this private"               da "Hold den privat"
    interests.remove         "Remove"                          da "Fjern"
    interests.removeNamed    "Remove {{name}}"                 da "Fjern {{name}}"
    interests.madePrivate    "This interest is now private."   da "Interessen er nu privat."
    interests.empty          "No interests yet."               da "Ingen interesser endnu."
  binds
    state    open: the row whose actions show, or nothing, starting at nothing
    role     "…" is a button named "More for <interest>"; Remove is a button named "Remove <interest>"
    events   Keep this private sends the interest again as private and closes the row; Remove deletes the interest
  uses InterestStars, PodColors
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (OrdinaryRow), "apps/mobile/src/features/interests/parts.tsx" (RowAction, MoreButton), "apps/mobile/src/lib/podColor.ts", "apps/mobile/preview/runtime/callables.ts"
    Design: DESIGN §5.2 (5), §11; PRIVACY §4.3 (self-flagging)
    Screens: priv-interests, app-interests-more ("apps/mobile/preview/screens.json"); driven in the web preview, world this-week, in English and Danish, on 27 November 2026
    Pull request: "https://github.com/ffMathy/friendpod/pull/6" (colours from the word)
```
