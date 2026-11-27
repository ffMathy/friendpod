# Data export

"Download my data" on Privacy: ask for a file of everything Friendpod holds about the member, see it being
prepared, and download it once it is ready. Delete account offers the same export first (see DeleteAccount).

```ail
node DataExport : flow   level: experience
  why   A member can get a copy of their data to keep or take elsewhere, the rights of access and portability
        (PRIVACY §6, DESIGN §3.9).                                                               <- PrivacyAndData
  what
    Scenario: Asking for the data
      Given a member in privacy settings, with no data export in progress
      When they press Download my data, which reads A file you can keep, ready within minutes
      Then under it: We're preparing your file and will let you know when it's ready.

    Scenario: A ready file shows until when it can be downloaded
      Given a member this week, whose data export is ready until Tuesday 10 November 2026 21:12
      When Privacy opens
      Then under Download my data: Your file is ready until Tue 10 Nov, 21:12.
      And a Download the file button

    Scenario: A download that does not work says so
      Given a member this week, whose data export is ready, and a download that fails
      When they press Download the file
      Then under it: The download didn't work. Try again.

    Scenario: The data export in Danish
      Given a member this week whose app is in Danish
      When Privacy opens
      Then it reads Hent mine data with En fil, du kan gemme, klar på få minutter, then Din fil er klar indtil tirs. 10. nov., 21.12. and Hent filen
      When they press Hent mine data
      Then it reads Vi laver din fil og giver besked, når den er klar.

    Asking first confirms it is the member: a sign-in in the last 4 minutes is enough, else Apple or Google asks again.
      An account that signs in with an email link gets a new link instead, and the line reads To confirm it's you, we sent a sign-in link to your email. Open it, then try again.
    While the request is sent, the row shows a spinner and ignores presses; if it fails, the reason shows under it.
    While the file is prepared, the line reads We're preparing your file.; if preparing fails, Preparing your file didn't work. You can ask again tomorrow.
    Only the newest file is shown, and only until it expires. The download needs the member's own sign-in; the file is kept only in the app's cache
      (the previous download is removed first) and opens in the phone's viewer, titled Your Friendpod data, from where it can be saved or shared.

  how
    decide asking for the file needs a recent sign-in
      because the export holds all of the member's data, and the server requires a sign-in from the last 5 minutes (DESIGN §3.9, §9); the app keeps a minute's margin ("apps/mobile/src/features/auth/reauth.ts")
    decide the file is prepared in the background and the member is told when it is ready
      because DESIGN §3.9: a background task builds the file and a notice says when it is ready
    decide the download is authenticated, with no public link, and the file is available for a limited time
      because DESIGN §3.9: the file is kept 24 hours, and only its owner may read it (DESIGN §9 storage rules)
    decide the downloaded file stays only in the app's cache, and only the latest one
      because it is the member's whole data; the cache is cleared on sign-out and deletion ("apps/mobile/src/features/account/exportDownload.ts")
    decide the export's state sits right under Download my data
      because "apps/mobile/app/settings/privacy.tsx": the request's outcome and the latest export's state are shown under the row
  look
    Download my data is a row of the data card: a color.text.secondary download icon, the label in type.body 600 color.text over its line in type.caption, color.text.muted.
    The state lines sit under it, lined up with its text, 8px apart: in type.caption, color.text.secondary (color.text.muted while preparing); a failure in type.small, 700, color.danger.
    Download the file: a size.button.compact primary pill (color.primary, color.on.primary download icon and type.label 700 text), left aligned.
  copy
    privacy.export                         "Download my data"                                                   da "Hent mine data"
    privacy.exportDetail                   "A file you can keep, ready within minutes"                          da "En fil, du kan gemme, klar på få minutter"
    settings.privacy.exportRequested       "We're preparing your file and will let you know when it's ready."   da "Vi laver din fil og giver besked, når den er klar."
    settings.reauthLinkSent                "To confirm it's you, we sent a sign-in link to your email. Open it, then try again."   da "For at bekræfte, at det er dig, har vi sendt et login-link til din e-mail. Åbn det, og prøv igen."
    settings.privacy.exportPending         "We're preparing your file."                                         da "Vi gør din fil klar."
    settings.privacy.exportFailed          "Preparing your file didn't work. You can ask again tomorrow."       da "Det lykkedes ikke at gøre din fil klar. Du kan spørge igen i morgen."
    settings.privacy.exportReady           "Your file is ready until {{when}}."                                 da "Din fil er klar indtil {{when}}."
    settings.privacy.exportDownload        "Download the file"                                                  da "Hent filen"
    settings.privacy.exportDownloadFailed  "The download didn't work. Try again."                               da "Filen kunne ikke hentes. Prøv igen."
    settings.privacy.exportFileTitle       "Your Friendpod data"                                                da "Dine Friendpod-data"
    common.loading                         "Loading"                                                            da "Indlæser"
  binds
    route    "/settings/privacy" (Download my data on Privacy)
    state    request: "idle" | "working" | "requested" | "link sent" | an error text, starting at "idle"
    shows    the newest export while its expiry is later than now: preparing, ready until its expiry (day, date and time in the app's language), or failed
    events   Download my data re-authenticates, then asks the server for an export; Download the file fetches the file with the member's sign-in and opens it
  sources
    Code: "apps/mobile/src/features/account/ExportStatus.tsx", "apps/mobile/src/features/account/account.ts", "apps/mobile/src/features/account/exportDownload.ts", "apps/mobile/src/features/auth/reauth.ts", "apps/mobile/app/settings/privacy.tsx"
    Design: DESIGN §3.9, §9; PRIVACY §6 (access and portability, export contents)
    Screens: "apps/mobile/preview/screens.json" app-settings-privacy-export; driven in the web preview, worlds privacy-settings and this-week (10 November 2026 12:00), in English and Danish, on 27 November 2026; the preview cannot save files, so every download fails there
```
