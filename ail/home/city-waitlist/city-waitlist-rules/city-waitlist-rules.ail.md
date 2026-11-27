# City waitlist rules

When Home is the city waitlist, what its counter and bar show, and the path of the city's public page. They are
in `packages/core` (`geo/waitlist.ts`), which the app and the server share.

```ail
node CityWaitlistRules : fn   level: system
  why   The waitlist must show while a city is not matched, show an exact city total only
        from 10 up, and share a link that names the city and nothing else (DESIGN F34,
        §3.1 step 13, §6.4).                                                          <- CityWaitlist
  what
    type AreaStatus = "waitlist" | "beta" | "live"
    WAITLIST_EXACT_FROM: integer = 10

    isWaitlisted(status: AreaStatus or nothing) -> boolean
      True for "waitlist" and "beta", the statuses that are not matched; false for "live" and for nothing.

    waitlistDisplay(count: integer) -> integer or "<10"
      The counter's number: the count itself from WAITLIST_EXACT_FROM up, "<10" below it.

    waitlistProgress(count: integer, goal: integer) -> number
      count / goal, kept between 0 and 1; 1 when the goal is 0 or less.

    cityLinkPath(areaId: text) -> text
      "/c/" followed by the area id. The area id must be a lower-case letter followed by 1 to 31 lower-case
      letters, digits or hyphens; any other id is refused with the error "invalid area id".

    examples
      isWaitlisted("waitlist") => true
      isWaitlisted("beta") => true
      isWaitlisted("live") => false
      isWaitlisted(nothing) => false
      waitlistDisplay(0) => "<10"
      waitlistDisplay(9) => "<10"
      waitlistDisplay(10) => 10
      waitlistDisplay(186) => 186
      waitlistProgress(186, 250) => 0.744
      waitlistProgress(125, 250) => 0.5
      waitlistProgress(0, 250) => 0
      waitlistProgress(300, 250) => 1
      waitlistProgress(-3, 250) => 0
      waitlistProgress(5, 0) => 1
      cityLinkPath("odense") => "/c/odense"
      cityLinkPath("copenhagen") => "/c/copenhagen"

    probes
      cityLinkPath("Odense")

  how
    decide "<10" below 10, the exact total from 10 up
      because an exact city total is fine, but not below 10 (DESIGN F34; founder decision 2026-11-05, "packages/core/src/schemas/documents.ts")
    decide beta counts as waitlisted
      because waitlist and beta areas are not matched (DESIGN §6.4; "packages/core/src/geo/waitlist.ts")
    decide the link's path carries the area id only
      because no referral code, no user id, nothing to track who shared it (DESIGN F34, §3.1 step 13)
    decide a goal of 0 or less counts as full
      because "unknown, confirm with the owner: a goal of 0 shows a full bar; is that intended, or should such an area never be on the waitlist?"
  free [ helper names ]
  sources
    Code: packages/core/src/geo/waitlist.ts (WAITLIST_EXACT_FROM, waitlistDisplay, waitlistProgress, isWaitlisted, cityLinkPath), packages/core/src/types/domain.ts (LaunchAreaStatus)
    Examples: run against the existing code on 27 November 2026 with tsx; cityLinkPath("Odense") throws "invalid area id"
    Design: docs/DESIGN.md F34, §3.1 steps 12–13, §6.4
```
