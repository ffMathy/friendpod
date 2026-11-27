# Messages from Friendpod

Me → Messages from Friendpod (`/settings/notices`): the account's notices,
newest first, one card each (a child): pauses with their statements of
reasons, report receipts, a member leaving, "your data is ready" and the
inactivity warning. Each is kept for a year.

```ail
node FriendpodMessages : flow   level: experience
  why   Automated decisions about a member come with a statement of reasons they can read later, and
        news about their account reaches them in the app, since Friendpod sends no email (DESIGN §5.2, §8.1 notices, F39; PRIVACY §13).   <- Me
  what
    Scenario: One message of each kind, newest first
      Given a member with messages from Friendpod
      When Messages from Friendpod opens
      Then it reads Pauses, report receipts and other news about your account. Each message is kept for a year.
      And the messages read, in this order: Your Friendpod data (Mon 9 Nov, 09:12), Thanks for your report (Sun 1 Nov, 22:40),
        Your pod changed (Sat 31 Oct, 21:00), Welcome back (Mon 26 Oct, 09:00) and Matching paused (Mon 12 Oct, 09:00)

    Scenario: No messages yet
      Given a new member with nothing yet
      When Messages from Friendpod opens
      Then it says No messages from Friendpod.
      And If we pause matching, receive your report or have your data ready, you'll find it here.

    Scenario: Messages in Danish
      Given a member with messages from Friendpod whose app is in Danish
      When Messages from Friendpod opens
      Then it reads Beskeder fra Friendpod, Dine Friendpod-data, man. 9. nov., 09.12 and Matchning sat på pause

  how
    decide newest first, one white card each, with the time it was sent
      because they are statements and receipts the member may look back on ("apps/mobile/app/settings/notices.tsx")
    decide each message is kept for a year, and the page says so
      because notices have a 12-month time to live (DESIGN §8.1)
    decide the page is reached from Me, and a push about a message opens it
      because Me lists it under Your account, and a notice push leads here ("apps/mobile/src/features/notifications/routing.ts")
    decide an empty page is a calm card with a quiet chat disc
      because nothing here needs the member ("apps/mobile/app/settings/notices.tsx")
  look
    Paper page with the Settings header: "Me" eyebrow over "Messages from Friendpod" in font.display, type.title, 800; blocks space.gap apart; Me's tab bar at the foot.
    The lede under the title in type.body, color.text.secondary. Then the message cards, newest first.
    Empty: one white card (color.surface, border.hairline color.border, radius.card, padding space.card), its content in a row 14px apart: a 40px color.page disc with a
      color.text.secondary chat icon, then "No messages from Friendpod." in type.label, 700, color.text over the line in type.caption, color.text.muted.
  copy
    notices.title      "Messages from Friendpod"   da "Beskeder fra Friendpod"
    notices.lede       "Pauses, report receipts and other news about your account. Each message is kept for a year."   da "Pauser, kvitteringer for anmeldelser og andet nyt om din konto. Hver besked gemmes i et år."
    notices.none       "No messages from Friendpod."   da "Ingen beskeder fra Friendpod."
    notices.noneBody   "If we pause matching, receive your report or have your data ready, you'll find it here."   da "Hvis vi sætter matchning på pause, modtager din anmeldelse eller har dine data klar, finder du det her."
    common.loadFailed  "This could not be loaded. Try again later."   da "Det kunne ikke indlæses. Prøv igen senere."
  binds
    route    "/settings/notices"
    shows    Loading while the messages load; a card with common.loadFailed if they cannot be
    shows    for each message, newest first, a FriendpodMessageCard; the download is offered when the message's export is ready and has not expired
  uses FriendpodMessageCard
  children FriendpodMessageCard
  sources
    Code: "apps/mobile/app/settings/notices.tsx", "apps/mobile/src/features/notifications/routing.ts", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: DESIGN §5.2 (statements of reasons), §8.1 (notices, 12 months), F39; PRIVACY §13 (DSA); "apps/mobile/preview/screens.json" app-settings-notices, app-settings-notices-empty
    Screens: driven in the web preview on 27 November 2026, worlds me-notices and me-new, in English and Danish
```
