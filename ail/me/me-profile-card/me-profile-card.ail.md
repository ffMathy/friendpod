# Me: the profile card

The top of Me: the member's photo (or an empty photo slot), first name, area
and their own meetup record, then who can see the photo and the actions to
add, change or delete it.

```ail
node MeProfileCard : view   level: experience
  why   A member sees what pod members will see of them, and alone decides on their photo;
        their own attendance record is shown to them and never to others (DESIGN §3.1 step 10, §4.4).   <- Me
  what
    Scenario: A member with a photo
      Given a member this week
      When Me opens
      Then the card shows their photo, Emil, Aarhus C and Attended 2 of 2 meetups
      And it says Only people in a confirmed pod with you can see your photo. In pods about a private interest, you choose per pod.
      And it offers Change photo and Delete photo

    Scenario: A new member has no photo and no meetups yet
      Given a new member with nothing yet
      When Me opens
      Then the card shows an empty photo slot, No meetups yet and Add a photo, and no Delete photo

    Scenario: Adding a photo thanks the member
      Given a new member with nothing yet, on Me
      When they press Add a photo and choose a picture
      Then the card says Thanks! Your photo will appear shortly.
      And the button reads Change photo

    Scenario: The card in Danish
      Given a new member with nothing yet whose app is in Danish
      When Me opens
      Then the card reads Ingen møder endnu and Tilføj et billede

  how
    decide the record reads "Attended N of M meetups", counting no-shows in M, or "No meetups yet" before the first
      because users see their own record ("4/4 attended"), and reliability is never shown to others (DESIGN §4.4)
    decide outside a pod there is no pod colour: without a photo the slot is a dashed ring with a camera, and the photo is drawn on a dark disc
      because these pages belong to no pod ("apps/mobile/src/features/shell/ProfileCard.tsx", "apps/mobile/src/features/shell/parts.tsx")
    decide a new photo is picked, resized and uploaded, then thanked; it shows once the server has checked it
      because the server strips its metadata and validates it before publishing a new version (DESIGN §9 Photos, §11 Media)
    decide deleting the photo asks first: Delete your photo?, Cancel or Delete photo; then the photo caches on the phone are cleared
      because members of the member's pods must stop seeing it (DESIGN §9 Photos); the question is a system alert, which the web preview cannot show, so no scenario plays it
  look
    A white card (color.surface, border.hairline color.border, radius.card, padding space.card), its parts 14px apart.
    Top row, 16px apart: the photo, a 72px circle, or the empty slot (a 72px circle with a 2px dashed color.field ring, color.surface inside and a color.text.secondary camera);
      then the first name in font.display, type.headline, 700, color.text; the area with a pin in type.small.text, color.text.secondary;
      the record as a quiet status (a calendar or check icon and the text in type.caption, 700, color.text.secondary).
    Who can see it in type.caption.text, color.text.muted. The actions in a wrapping row 8px apart:
      Add a photo or Change photo, a small white secondary button (size.button.small, radius.pill, border.control color.border.strong) with a camera icon;
      Delete photo, a small danger outline button (color.surface, border.control color.danger, color.danger text and bin icon).
    After an upload, the thanks in type.small.text, color.text.secondary; a failed upload in type.small, 700, color.danger.
  copy
    me.attended          "Attended {{attended}} of {{total}} meetups"   da "Mødt op til {{attended}} af {{total}} møder"
    me.noMeetupsYet      "No meetups yet"                               da "Ingen møder endnu"
    me.yourPhoto         "Your photo"                                   da "Dit billede"
    me.photoWho          "Only people in a confirmed pod with you can see your photo. In pods about a private interest, you choose per pod."   da "Kun folk i en bekræftet pod med dig kan se dit billede. I pods om en privat interesse vælger du selv for hver pod."
    me.addPhoto          "Add a photo"                                  da "Tilføj et billede"
    me.changePhoto       "Change photo"                                 da "Skift billede"
    me.deletePhoto       "Delete photo"                                 da "Slet billede"
    me.deletePhotoTitle  "Delete your photo?"                           da "Vil du slette dit billede?"
    me.deletePhotoBody   "Your photo is deleted and members of your pods stop seeing it."   da "Dit billede bliver slettet, og medlemmerne af dine pods kan ikke længere se det."
    me.photoUploaded     "Thanks! Your photo will appear shortly."      da "Tak! Dit billede dukker op om lidt."
    me.photoFailed       "The upload didn't work. Try again."           da "Billedet kunne ikke uploades. Prøv igen."
    common.cancel        "Cancel"                                       da "Annullér"
  binds
    props    the member's first name, area label, photo version (or none) and meetup counts (attended, no-shows)
    shows    the record: total meetups is attended plus no-shows; none yet when that is 0
    events   Add a photo or Change photo opens the phone's photo library (square crop); a chosen picture is uploaded at 1080 px and 256 px, then the thanks shows; cancelling changes nothing
    events   Delete photo asks first, then deletes the photo and clears the image caches
  sources
    Code: "apps/mobile/src/features/shell/ProfileCard.tsx", "apps/mobile/src/features/photos/upload.ts", "apps/mobile/src/i18n/en/shell.json", "apps/mobile/src/i18n/da/shell.json"
    Design: DESIGN §3.1 step 10, §4.4, §9 Photos, §11 Media; "apps/mobile/preview/screens.json" app-me, app-me-new
    Screens: driven in the web preview on 27 November 2026, worlds this-week and me-new, in English and Danish (a picture chosen through the browser's file picker)
```
