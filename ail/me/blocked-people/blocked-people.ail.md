# Blocked people

`/settings/blocked`, opened from Privacy's "Blocked people" row: everyone the
member has blocked, with the first name they saw in that pod and when, and
Unblock beside each. How to block someone is said either way.

```ail
node BlockedPeople : flow   level: experience
  why   A member is never matched again with someone they blocked, and can see and undo each block
        (DESIGN §3.7, §8.1 blocks).   <- Me
  what
    Scenario: One blocked person
      Given a member this week, who blocked Rasmus on 31 October
      When Blocked people opens
      Then it reads You're never matched with someone you've blocked.
      And it lists Rasmus, Blocked 31 Oct, with Unblock
      And under the list To block someone, tap their name in a pod.

    Scenario: Unblocking takes the block away at once
      Given a member this week, on Blocked people
      When they press Unblock beside Rasmus
      Then it says You haven't blocked anyone.

    Scenario: Nobody blocked
      Given a new member with nothing yet
      When Blocked people opens
      Then it says You haven't blocked anyone. and To block someone, tap their name in a pod.

    Scenario: Blocked people in Danish
      Given a member this week whose app is in Danish
      When Blocked people opens
      Then it reads Blokerede personer, Rasmus, Blokeret 31. okt. and Fjern blokering

  how
    decide each row names the person by the first name the member saw in that pod; someone from a pod that was never confirmed is "Someone from an unconfirmed pod"
      because a block keeps the first name as shown in the shared pod's roster, empty if it was never confirmed (DESIGN §8.1 blocks)
    decide the date reads day and month, with the year only before this year, in Copenhagen time
      because every date in the app is in the drop time zone ("apps/mobile/src/features/shell/parts.tsx")
    decide Unblock acts at once, with no question first, and is a white secondary button
      because it undoes a block and deletes nothing ("apps/mobile/app/settings/blocked.tsx")
    decide the avatar is the initial on a dark disc, with no pod colour
      because outside a pod there is no pod colour ("apps/mobile/app/settings/blocked.tsx")
    decide the page is opened from Privacy, not from Me or Settings
      because blocked people are under Privacy ("apps/mobile/app/settings/index.tsx"), the way priv-settings draws it
  look
    Paper page with the Settings header: "Me" eyebrow over "Blocked people" in font.display, type.title, 800; blocks space.gap apart; Me's tab bar at the foot.
    The lede in type.body, color.text.secondary. The people in a white list card (color.surface, border.hairline color.border, radius.card), rows at least 64px tall,
      12px apart inside: a 32px avatar with the initial, the name in type.body, 600, color.text over "Blocked 31 Oct" in type.caption, color.text.muted,
      and Unblock at the right as a small white secondary button (size.button.small, radius.pill, border.control color.border.strong); border.hairline color.separator between rows.
    The how-to under the list in type.caption, color.text.muted.
    Empty: one white card, its content in a row 14px apart: a 40px color.page disc with a color.text.secondary block icon, then
      "You haven't blocked anyone." in type.label, 700, color.text over the how-to in type.caption, color.text.muted.
  copy
    settings.blocked.title        "Blocked people"   da "Blokerede personer"
    settings.blocked.lede         "You're never matched with someone you've blocked."   da "Du bliver aldrig matchet med nogen, du har blokeret."
    settings.blocked.since        "Blocked {{date}}"   da "Blokeret {{date}}"
    settings.blocked.unblock      "Unblock"   da "Fjern blokering"
    settings.blocked.unblockName  "Unblock {{name}}"   da "Fjern blokering af {{name}}"
    settings.blocked.unnamed      "Someone from an unconfirmed pod"   da "En person fra en ikke-bekræftet pod"
    settings.blocked.none         "You haven't blocked anyone."   da "Du har ikke blokeret nogen."
    settings.blocked.howTo        "To block someone, tap their name in a pod."   da "Du blokerer nogen ved at trykke på deres navn i en pod."
    common.loadFailed             "This could not be loaded. Try again later."   da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    route    "/settings/blocked"
    role     each Unblock is a button named "Unblock" followed by the person's name
    shows    Loading while the list loads; a card with common.loadFailed if it cannot be
    events   Unblock takes the block away; the pressed button shows it is busy; the row goes when the block is gone; a failure shows its error under the page
  sources
    Code: "apps/mobile/app/settings/blocked.tsx", "apps/mobile/src/features/shell/parts.tsx" (the date), "apps/mobile/app/settings/privacy.tsx" (the row that opens it), "apps/mobile/src/i18n/en/shell.json"
    Design: DESIGN §3.7 (block), §8.1 (blocks); "apps/mobile/preview/screens.json" app-settings-blocked, app-settings-blocked-empty
    Screens: driven in the web preview on 27 November 2026, worlds this-week and me-new, in English and Danish
```
