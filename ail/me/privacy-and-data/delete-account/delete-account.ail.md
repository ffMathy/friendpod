# Delete account

Privacy → Delete account (`/settings/delete-account`, storyboard priv-delete): what is deleted and what is kept,
the data export first, then "Sign in again and delete", confirmed once more.

```ail
node DeleteAccount : flow   level: experience
  why   A member can erase their account themselves, knowing first what goes at once, what lingers for a while
        and what is kept without their name (PRIVACY §6 erasure, DESIGN §3.10).                  <- PrivacyAndData
  what
    Scenario: The screen says what happens
      Given a member in privacy settings, on Privacy
      When they press Delete account
      Then it reads Delete your account? and This can't be undone. If you just need a break, you can pause matching instead.
      And What happens lists five points, from Your profile, interests, private interests, photo and votes are deleted now. to A few records we must keep, such as proof of consent and reports, are kept without your name.
      And then Download my data first, To keep your account safe, we'll ask you to sign in again first., Sign in again and delete, and Cancel

    Scenario: Download my data first asks for the file
      Given a member in privacy settings, with no data export in progress, on Delete account
      When they press Download my data first
      Then under it: We're preparing your file and will let you know when it's ready.

    Scenario: With a ready file, Download my data first downloads it
      Given a member this week, whose data export is ready until Tuesday 10 November 2026 21:12, on Delete account
      Then under Download my data first: Your file is ready until Tue 10 Nov, 21:12.
      When they press Download my data first, and the download fails
      Then it says The download didn't work. Try again. and asks for no new file

    Scenario: Deleting waits for a confirmation
      Given a member in privacy settings, on Delete account
      When they press Sign in again and delete
      Then nothing is deleted yet: the screen still asks Delete your account?

    Scenario: Cancel and Back return to Privacy
      Given a member in privacy settings, who opened Delete account directly
      When they press Cancel, or Back
      Then Privacy opens

    Scenario: Delete account in Danish
      Given a member this week whose app is in Danish, on Delete account
      Then it reads Vil du slette din konto?, Hvad sker der?, Hent mine data først, Din fil er klar indtil tirs. 10. nov., 21.12., Log ind igen og slet and Annullér

    Sign in again and delete asks first, in the phone's own dialog: Delete your account for good? / Next, you sign in again to confirm it's you. Then your account is deleted. / Cancel / Delete (destructive).
    Delete: the member signs in again (Apple always; with Apple, its token is revoked, retried once and never blocking), the account is deleted, the phone signs out
      and clears its caches, and the welcome screen says Your account has been deleted. Thanks for trying Friendpod. Meanwhile the button is busy and Cancel is hidden.
    An email-link account gets a sign-in link instead: To confirm it's you, we sent a sign-in link to your email. Open it, then try again. Cancelling the sign-in changes nothing; any other failure shows its reason.
  how
    decide the screen states what is deleted now, the backup window (7 days), the sign-in record window (up to 180 days, at Google) and what is kept without a name
      because DESIGN §3.10 step 1 and PRIVACY §6 (residual windows, pseudonymised records); the sign-in service is Google's for every account, Apple ones too
    decide the member signs in again before deleting, and confirms once more first
      because deletion needs a recent sign-in (DESIGN §3.10 step 2, §9), and priv-delete asks once more with a native alert ("apps/mobile/preview/screens.json")
    decide with a ready file, Download my data first downloads it rather than asking for another
      because "apps/mobile/preview/screens.json" app-settings-delete-export
    decide Sign in again and delete is the danger outline with a trash icon, never a red fill, and Cancel a quiet link
      because "apps/mobile/app/settings/delete-account.tsx" (priv-delete)
    decide the actions sit at the bottom while everything fits, and scroll with the page when not
      because nothing may hide behind a pinned footer ("apps/mobile/preview/screens.json" app-settings-delete-export)
  look
    Paper page (color.page), side padding space.gutter.compact, a size.hit back chevron, blocks 14px apart. Title in font.display, type.title, 800; the lede in type.body.small, color.text.secondary.
    A white card (color.surface, border.hairline color.border, radius.card): "What happens" in type.body.small 700, then five points with small color.text dots, in type.body.small color.text, 8px apart.
    Download my data first: full width, size.button.medium, radius.pill, color.surface, border.control color.border.strong, a download icon and type.button 700 color.text; its state 8px under it in type.caption.
    At the bottom, 14px apart: the note centred in type.caption, color.text.muted; Sign in again and delete full width, size.button, color.surface with a border.control color.danger border, a trash icon and type.button 700 color.danger; Cancel centred, underlined, type.label 700 color.text.secondary.
  copy
    deleteAccount.title         "Delete your account?"   da "Vil du slette din konto?"
    deleteAccount.lede          "This can't be undone. If you just need a break, you can pause matching instead."   da "Det kan ikke fortrydes. Har du bare brug for lidt luft, kan du sætte matchning på pause i stedet."
    deleteAccount.whatHappens   "What happens"   da "Hvad sker der?"
    deleteAccount.deletedNow    "Your profile, interests, private interests, photo and votes are deleted now."   da "Din profil, dine interesser og private interesser, dit billede og dine stemmer slettes med det samme."
    deleteAccount.leavePods     "You leave every pod. The others only see “A member left”."   da "Du forlader alle dine pods. De andre ser kun, at et medlem er gået."
    deleteAccount.backups       "Copies in our backups disappear within 7 days."   da "Vores sikkerhedskopier af dine data slettes inden for 7 dage."
    deleteAccount.signInRecord  "Your sign-in record at Google's login service can take up to 180 days to clear."   da "Hos Googles login-tjeneste kan det tage op til 180 dage, før dit login er helt væk."
    deleteAccount.keptRecords   "A few records we must keep, such as proof of consent and reports, are kept without your name."   da "Nogle få ting skal vi gemme, fx bevis for samtykke og anmeldelser. Dem gemmer vi uden dit navn."
    deleteAccount.downloadFirst "Download my data first"   da "Hent mine data først"
    deleteAccount.reauthNote    "To keep your account safe, we'll ask you to sign in again first."   da "For at passe på din konto beder vi dig logge ind igen først."
    deleteAccount.confirm       "Sign in again and delete"   da "Log ind igen og slet"
    deleteAccount.confirmTitle  "Delete your account for good?"   da "Vil du slette din konto for altid?"
    deleteAccount.confirmBody   "Next, you sign in again to confirm it's you. Then your account is deleted."   da "Du logger ind igen for at bekræfte, at det er dig. Derefter slettes din konto."
    deleteAccount.confirmButton "Delete"   da "Slet"
    settings.delete.done        "Your account has been deleted. Thanks for trying Friendpod."   da "Din konto er slettet. Tak, fordi du prøvede Friendpod."
    common.cancel               "Cancel"   da "Annullér"
  binds
    state    deletion: "idle" | "working" | "link sent" | an error text, starting at "idle"
    events   Cancel and Back go back, or to Privacy when there is no earlier screen; the export button follows DataExport
  uses DataExport
  sources
    Code: "apps/mobile/app/settings/delete-account.tsx", "apps/mobile/src/features/account/account.ts", "apps/mobile/src/features/account/ExportStatus.tsx", "apps/mobile/app/(auth)/index.tsx"
    Design: DESIGN §3.10, §9; PRIVACY §6 (erasure sequence, residual windows). Screens: "apps/mobile/preview/screens.json" priv-delete, app-settings-delete-export; driven in the web preview, worlds privacy-settings and this-week, in English and Danish, on 27 November 2026; the preview's dialogs do nothing, so deletion itself could not be driven
```
