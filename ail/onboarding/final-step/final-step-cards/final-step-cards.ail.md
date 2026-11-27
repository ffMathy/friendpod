# Almost done: the cards

The photo, notifications and safety pledge cards on step 6, as onb-final draws them: calm white cards on Paper.

```ail
node FinalStepCards : view   level: experience
  why   A photo helps a pod recognise each other, a notification brings the weekly drop, and the pledge
        sets how members meet; only the pledge is needed (DESIGN §3.1 steps 10–11).              <- FinalStep
  what
    The photo card: an open seat (or the photo once the server has published it), A photo, so your pod recognises you (optional), who sees it,
      and Add a photo, which opens the phone's picker and uploads; then Change photo. After an upload it says Thanks! Your photo will appear shortly.;
      a failed one The upload did not work. You can add a photo later.
    The notifications card: Know when your drop arrives, what notifications say, and Turn on notifications, which asks the phone.
      Allowed, it becomes the pill Notifications are on; refused, Notifications are off. You can turn them on later in Settings. Already allowed, it starts as the pill.
    The pledge card: Our safety pledge and its unticked box.

    Scenario: The cards before anything is chosen
      Given a member on the last onboarding step, with no photo and notifications not asked yet
      Then it shows A photo, so your pod recognises you (optional) with Add a photo
      And Know when your drop arrives with Turn on notifications
      And Our safety pledge

    Scenario: Turning on notifications
      Given a member on the last onboarding step, with notifications not asked yet
      When they press Turn on notifications and the phone allows them
      Then the card says Notifications are on

    Scenario: The cards in Danish
      Given a member on the last onboarding step whose app is in Danish
      Then it shows Et billede, så din pod kan genkende dig (valgfrit) with Tilføj billede, Få besked, når dit drop lander with Slå notifikationer til, and Vores sikkerhedsløfte

  how
    decide the photo is seen only by confirmed pod members, and chosen per pod in private pods
      because DESIGN §3.1 step 10: "In pods about a sensitive interest, you choose per pod whether to show it"
    decide notifications never name a theme, a person or what anyone wrote
      because the card says so, and pushes are written that way (DESIGN S4; "apps/mobile/src/features/onboarding/FinalStepCards.tsx")
    decide saying no to notifications is fine
      because Settings can turn them on later ("apps/mobile/src/features/onboarding/FinalStepCards.tsx")
  look
    Each card white (color.surface), radius.card, 14px by 16px padding. Titles in type.label, 700, color.text with a 20px line; texts in type.caption, color.text.secondary with an 18px line.
    The photo card is a row: a 56px open seat (a color.inset disc with a dashed color.field ring and a color.text.secondary camera), 14px from the text; Add a photo is a small secondary button with a camera.
    Notifications: a bell before the title; Turn on notifications a small secondary button with a bell; on, the color.ink pill with a check and color.on.ink text.
    The pledge: a shield before the title; the box a size.checkbox, radius.checkbox, unticked border.field color.field, ticked color.primary with a white tick, its text in type.body, color.text.
  copy
    onboarding.final.photoTitle   "A photo, so your pod recognises you"   da "Et billede, så din pod kan genkende dig"
    onboarding.final.photoBody    "Only people in a confirmed pod with you can see it. In pods about a private interest, you choose per pod."   da "Kun dem i en bekræftet pod med dig kan se det. I pods om en privat interesse vælger du selv for hver pod."
    onboarding.final.addPhoto     "Add a photo"     da "Tilføj billede"
    onboarding.final.changePhoto  "Change photo"    da "Skift billede"
    onboarding.final.yourPhoto    "Your photo"      da "Dit billede"
    onboarding.photo.uploaded     "Thanks! Your photo will appear shortly."   da "Tak! Dit billede dukker op om lidt."
    onboarding.photo.failed       "The upload did not work. You can add a photo later."   da "Billedet kunne ikke uploades. Du kan tilføje et senere."
    onboarding.final.notifTitle   "Know when your drop arrives"   da "Få besked, når dit drop lander"
    onboarding.final.notifBody    "Notifications only say things like “Your weekly drop is here”. Never who is in a pod or what it is about."   da "Vi skriver fx »Dit ugentlige drop er her« – aldrig hvem der er i en pod, eller hvad den handler om."
    onboarding.final.notifEnable  "Turn on notifications"   da "Slå notifikationer til"
    onboarding.final.notifOn      "Notifications are on"    da "Notifikationer er slået til"
    onboarding.final.notifOff     "Notifications are off. You can turn them on later in Settings."   da "Notifikationer er slået fra. Du kan slå dem til senere under Indstillinger."
    onboarding.final.pledgeTitle  "Our safety pledge"       da "Vores sikkerhedsløfte"
    onboarding.final.pledge       "I'll meet in public places, treat people with respect, and use Report if something feels wrong."   da "Jeg mødes på offentlige steder, behandler andre med respekt og bruger Anmeld, hvis noget føles forkert."
    common.optional               "(optional)"   da "(valgfrit)"
  binds
    route    "/almost-done" (the photo, notifications and pledge cards on Almost done)
    props    pledged: boolean, onPledge(pledged: boolean)
    state    notifications: "ask" | "on" | "off", starting at "on" when the phone already allows them, else "ask"
    role     the pledge is a checkbox named with its text
  sources
    Code: "apps/mobile/src/features/onboarding/FinalStepCards.tsx", "apps/mobile/src/features/photos/upload.ts", "apps/mobile/src/features/notifications/push.ts"
    Design: DESIGN §3.1 steps 10–11, S4
    Screens: "apps/mobile/preview/screens.json" onb-final; driven in the web preview, world onboarding-final, in English and Danish, on 27 November 2026 (the preview's photo picker returns nothing, and its phone allows notifications when asked)
```
