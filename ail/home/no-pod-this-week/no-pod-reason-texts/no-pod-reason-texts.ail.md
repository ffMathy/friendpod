# No-pod reason texts

What No pod this week says for each reason the drop can send, and the tip that names a setting.

```ail
node NoPodReasonTexts : view   level: experience
  why   The reason is the server's, said in plain words; a reason that names one of the
        member's own settings gets a tip that opens it (DESIGN §6.7).               <- NoPodThisWeek
  what
    The text under No pod for you this week is the reason's text below, word for word.
    A reason that names a setting (distance, age range, same-gender pods, meetup languages, times) leads the tips with its own tip,
    except distance when a larger distance exists: then Try about N km leads instead.

    Scenario: The reason in English and Danish
      Given a member with no pod this week, because not enough people shared an interest
      When Home opens in English, and again in Danish
      Then it reads Not enough people near you shared one of your interests and fit everyone's settings this time.
      And in Danish Der var ikke nok folk i nærheden, der delte en af dine interesser og passede til alles indstillinger denne gang.

  how
    decide reasons for private interests say only that pods about them are not open yet, or that too few near you added it
      because each user sees their own, and no shared count of private-interest holders exists (PRIVACY §4.3; "packages/core/src/reasons.ts")
    decide the full pod count names the number 2 in its text
      because "unknown, confirm with the owner: the text says 2 active pods while the most is a matching-profile setting; should it follow the setting?"
  look
    The reason in type.body.small, color.text.secondary; a setting's tip as a tip row like the others.
  copy
    unmatched.NO_THEME_BUCKET       "Not enough people near you shared one of your interests and fit everyone's settings this time."   da "Der var ikke nok folk i nærheden, der delte en af dine interesser og passede til alles indstillinger denne gang."
    unmatched.RADIUS                "Your distance setting leaves too few people near you to form a pod."   da "Med den afstand, du har valgt, er der for få i nærheden til at samle en pod."
    unmatched.AGE                   "Your age range leaves too few people near you to form a pod."          da "Med det aldersinterval, du har valgt, er der for få i nærheden til at samle en pod."
    unmatched.GENDER                "With same-gender pods, too few people near you had the same setting this time."   da "Med pods for samme køn var der for få i nærheden med samme indstilling denne gang."
    unmatched.GENDER_POOL           "There are too few people near you for same-gender pods right now."     da "Der er for få i nærheden til pods for samme køn lige nu."
    unmatched.LANGUAGE              "Too few people near you share your meetup languages."                   da "For få i nærheden deler dine sprog til møderne."
    unmatched.AVAILABILITY          "Too few people near you can meet at the times you picked."             da "For få i nærheden kan mødes på de tidspunkter, du har valgt."
    unmatched.MAX_ACTIVE_PODS       "You already have 2 active pods. A new one can come when one of them ends."   da "Du har allerede 2 aktive pods. Du kan få en ny, når en af dem slutter."
    unmatched.TOO_FEW_INTERESTS     "Add at least 3 interests to be matched."                                da "Tilføj mindst 3 interesser for at blive matchet."
    unmatched.SENSITIVE_ELIGIBILITY "Pods about private interests aren't open to you yet, so we looked at your other interests."   da "Pods om private interesser er ikke åbne for dig endnu, så vi kiggede på dine andre interesser."
    unmatched.SENSITIVE_DENSITY     "Too few people near you have added your private interest for a pod about it."   da "For få i nærheden har tilføjet din private interesse til en pod om den."
    unmatched.AREA_WAITLIST         "Your area is still on the waitlist."                                    da "Dit område er stadig på venteliste."
    unmatched.OUTSIDE_AREAS         "Friendpod isn't in your area yet."                                      da "Friendpod er ikke kommet til dit område endnu."
    unmatched.NO_FIT_THIS_WEEK      "There were people to match with, but no pod fitted everyone this week."   da "Der var nogen at matche med, men ingen pod passede for alle i denne uge."
    home.changeSetting.RADIUS       "Change how far you'll go"                da "Skift, hvor langt du vil rejse"
    home.changeSetting.AGE          "Widen your age range"                    da "Udvid dit aldersinterval"
    home.changeSetting.GENDER_POOL  "Change same-gender pods"                 da "Skift indstillingen for samme køn"
    home.changeSetting.LANGUAGE     "Add a meetup language"                   da "Tilføj et sprog til møderne"
    home.changeSetting.AVAILABILITY "Add more times that suit you"            da "Tilføj flere tidspunkter, der passer dig"
  binds
    route    "/" (the reason on No pod this week, on Home)
    props    reason: UnmatchedReason or nothing
    shows    the text of unmatched.{reason}, or home.noPodBody when there is no reason; the tip home.changeSetting.{reason} when isUserSettingReason(reason)
  uses DropReasons
  sources
    Code: "apps/mobile/src/features/drop/NoPodCard.tsx", "apps/mobile/src/lib/reasons.ts", "apps/mobile/src/i18n/en/drop.json", "apps/mobile/src/i18n/da/drop.json"
    Design: DESIGN §6.7; PRIVACY §4.3
    Screens: driven in the web preview, worlds drop-none and drop-none-setting, on 27 November 2026; the other reasons have no world, so their texts were read from the translations
```
