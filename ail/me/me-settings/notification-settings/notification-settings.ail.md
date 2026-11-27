# Notifications

Settings → Notifications (`/settings/notifications`): whether pushes are on,
the way to turn them on or off, what a push is about, and what a push never
says.

```ail
node NotificationSettings : flow   level: experience
  why   Pushes are how a member hears about the drop, their pod and Friendpod's messages, since
        Friendpod sends no email; a push never says anything personal (DESIGN F39, §6.1 S4).   <- MeSettings
  what
    Scenario: Notifications that are on
      Given a member this week, whose phone allows Friendpod's notifications
      When Notifications opens
      Then it reads Know when your drop arrives and Notifications only say things like “Your weekly drop is here”.
      And it says Notifications are on, with Turn off in phone settings
      And What we notify you about lists Your weekly drop is here, Your pod is confirmed or changes, or your meetup is coming up,
        There's a new message in your pod's chat and There's a message from Friendpod about your account
      And What a notification never says reads Who is in a pod, what it's about, your interests or what anyone wrote.

    Scenario: Turning notifications on
      Given a new member with nothing yet, who has not been asked about notifications
      When Notifications opens
      Then it offers Turn on notifications
      When they press it and allow notifications
      Then it says Notifications are on, with Turn off in phone settings

    Scenario: When the phone's settings cannot be opened
      Given a member this week, on Notifications, on a phone whose settings cannot be opened from the app
      When they press Turn off in phone settings
      Then it says That did not work. You can change notifications in your phone's settings.
      And it still says Notifications are on

    Scenario: Notifications in Danish
      Given a member this week whose app is in Danish
      When Notifications opens
      Then it reads Få besked, når dit drop lander, Notifikationer er slået til and Slå fra i telefonens indstillinger

  how
    decide pushes are generic: no theme, name or message text
      because of S4 (DESIGN §6.1): chat pushes say only that there is a new message
    decide turning on asks the phone for permission and registers this phone; if the member refuses, the phone's settings open instead
      because a refused permission can only be changed there ("apps/mobile/app/settings/notifications.tsx")
    decide turning off forgets this phone's push token and opens the phone's settings, where the permission itself is changed
      because an app cannot take back its own notification permission ("apps/mobile/app/settings/notifications.tsx")
    decide the page reads the permission when it opens and does not read it again after Turn off
      because "unknown, confirm with the owner: after Turn off, the page still says Notifications are on until it is opened again; is that wanted?"
    decide the card copies onb-final's "Know when your drop arrives"; the lists copy drop-why's bullets and its info note
      because these pages have no storyboard of their own ("apps/mobile/app/settings/notifications.tsx")
  look
    Paper page with the Settings header: "Me" eyebrow over "Notifications" in font.display, type.title, 800; blocks space.gap apart; Me's tab bar at the foot.
    First a white card (color.surface, border.hairline color.border, radius.card, padding space.card), parts 10px apart: a bell and "Know when your drop arrives" in type.label, 700;
      the line in type.caption, color.text.secondary; then either a quiet check with "Notifications are on" (type.caption, 700, color.text.secondary) over a small white secondary
      "Turn off in phone settings", or a small white secondary "Turn on notifications" with a bell (size.button.small, radius.pill, border.control color.border.strong); a failure in type.small, 700, color.danger.
    Then a white card with "What we notify you about" in type.label, 700 and the four lines as bullets: a check on a small color.page disc and the text in type.body.small, color.text.
    Then an info note (color.surface, border.hairline color.border, radius.lg): an info icon, "What a notification never says" in type.label, 700, and the text in type.caption, color.text.secondary.
  copy
    settings.notifications.title       "Notifications"                        da "Notifikationer"
    settings.notifications.cardTitle   "Know when your drop arrives"          da "Få besked, når dit drop lander"
    settings.notifications.body        "Notifications only say things like “Your weekly drop is here”."   da "Notifikationer siger kun noget i stil med »Dit ugentlige drop er her«."
    settings.notifications.on          "Notifications are on"                 da "Notifikationer er slået til"
    settings.notifications.turnOff     "Turn off in phone settings"           da "Slå fra i telefonens indstillinger"
    settings.notifications.turnOn      "Turn on notifications"                da "Slå notifikationer til"
    settings.notifications.failed      "That did not work. You can change notifications in your phone's settings."   da "Det virkede ikke. Du kan ændre notifikationer i telefonens indstillinger."
    settings.notifications.sentTitle   "What we notify you about"             da "Det giver vi besked om"
    settings.notifications.sent.drop     "Your weekly drop is here"           da "Dit ugentlige drop er her"
    settings.notifications.sent.pod      "Your pod is confirmed or changes, or your meetup is coming up"   da "Din pod er bekræftet eller ændret, eller jeres møde nærmer sig"
    settings.notifications.sent.message  "There's a new message in your pod's chat"   da "Der er en ny besked i jeres pod-chat"
    settings.notifications.sent.notice   "There's a message from Friendpod about your account"   da "Der er en besked fra Friendpod om din konto"
    settings.notifications.neverTitle  "What a notification never says"       da "Det står der aldrig i en notifikation"
    settings.notifications.never       "Who is in a pod, what it's about, your interests or what anyone wrote."   da "Hvem der er i en pod, hvad den handler om, dine interesser eller hvad nogen har skrevet."
  binds
    route    "/settings/notifications"
    state    allowed: boolean or nothing, read from the phone when the page opens; failed: boolean, starting at false
    events   Turn on notifications asks for permission; allowed: registers this phone and shows on; refused: opens the phone's settings
    events   Turn off in phone settings forgets this phone's push token, then opens the phone's settings; anything that goes wrong shows the failure line
  sources
    Code: "apps/mobile/app/settings/notifications.tsx", "apps/mobile/src/features/notifications/push.ts", "apps/mobile/preview/mocks/firebase-messaging.ts" (the worlds' permission)
    Design: DESIGN F39, §6.1 S4, §3.1 step 11; "apps/mobile/preview/screens.json" app-settings-notifications, app-settings-notifications-off
    Screens: driven in the web preview on 27 November 2026, worlds this-week (permission granted) and me-new (not asked yet), in English and Danish;
      the web preview cannot open the phone's settings, so Turn off always shows the failure line there
```
