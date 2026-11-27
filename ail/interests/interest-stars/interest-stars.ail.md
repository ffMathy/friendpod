# Main interests

The star at the start of each interest row: up to three main interests.

```ail
node InterestStars : flow   level: experience
  why   A member says which few interests matter most to them, without making the rest
        disappear (DESIGN A21: at most 3 starred).                                           <- Interests
  what
    Pressing an interest's star makes it a main interest (a filled star); pressing it again makes it an ordinary one (an outline star).
    Up to 3 interests are main interests at a time, private ones included.
    A private interest shows a star only while it is a main interest, so it can be unstarred but never starred.

    Scenario: A fourth main interest is refused
      Given a member this week whose only main interest is brætspil
      When they star sourdough and then trail running
      Then brætspil, sourdough and trail running have filled stars
      When they star far på barsel
      Then the tab says You can star up to 3 interests.
      And far på barsel keeps its outline star

    Scenario: Unstarring makes room, and the message stays
      Given a member this week with the main interests brætspil, sourdough and trail running, told You can star up to 3 interests.
      When they unstar brætspil and star far på barsel
      Then far på barsel has a filled star and brætspil an outline one
      And the tab still says You can star up to 3 interests.

    Scenario: The star limit in Danish
      Given a member this week whose app is in Danish, with brætspil as their only main interest
      When they star sourdough, trail running and far på barsel
      Then the tab says Du kan stjernemarkere op til 3 interesser.

  how
    decide at most 3 main interests, checked on the phone before anything is sent
      because DESIGN A21 sets max 3 starred ("apps/mobile/src/features/interests/InterestManager.tsx")
    decide the limit message stays after a later star succeeds, until another message replaces it
      because "unknown, confirm with the owner: the message You can star up to 3 interests. stays on screen after the member makes room and stars another; should a successful star clear it?"
    decide a private interest gets no star unless it already has one
      because the design shows no star on private holdings, and one starred before can still be unstarred ("apps/mobile/src/features/interests/InterestManager.tsx", citing the design system §8.1)
  look
    A size.hit target at the start of the row, its 20px star lined up with the card's space.card inset: color.ink, filled for a main interest, an outline otherwise.
    The message is the add row's white note (color.surface, border.hairline color.border, radius.lg) with an info icon, in type.caption.text, color.text.secondary.
  copy
    interests.starNamed     "Star {{name}}"                        da "Stjernemarkér {{name}}"
    interests.starLimit     "You can star up to 3 interests."      da "Du kan stjernemarkere op til 3 interesser."
  binds
    route    "/interests" (the stars on the interest rows of the Interests tab)
    role     each star is a toggle button named "Star <interest>"; whether it is on is read from its filled star
    events   a star on an interest that is not a main interest, while 3 are, shows the limit message and changes nothing; any other press flips it
  sources
    Code: "apps/mobile/src/features/interests/InterestManager.tsx" (its star handler and limit), "apps/mobile/src/features/interests/parts.tsx" (the star button), "apps/mobile/preview/runtime/callables.ts" (the star call)
    Design: DESIGN A21
    Screens: driven in the web preview, world this-week, in English and Danish, on 27 November 2026
```
