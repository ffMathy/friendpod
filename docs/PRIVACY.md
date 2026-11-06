# Grouper: privacy and GDPR design

> **Not legal advice.** This is an engineering design meant to make the system compliant by construction. Items marked **[LAWYER]** need review by a Danish data protection lawyer before the private alpha (M1); the whole document should be read by that lawyer once.

| | |
|---|---|
| Status | Draft for founder and counsel review |
| Date | 2026-11-04 |
| Companions | [DESIGN.md](./DESIGN.md), cited below as "D§"; [COSTS.md](./COSTS.md) |
| Revision | Founder review round 2 (2026-11-04): on-device embedding (D1), no human review (D2), blanket Art. 9 consent (D3), "about me" (D4), Google Places (D8), meet-again pair signals (D9) |
| Supervisory authority | Datatilsynet (Denmark) |

Evidence tags are the same as in DESIGN.md:

| Tag | Source |
|---|---|
| [GDPR] | GDPR research report |
| [FBX] | Firebase / Expo report |
| [EXP] | First embedding experiment (v1) |
| [CAL] | v1 vs v2 re-calibration (`research/embedding-calibration/`) |
| [SRV] | Serving report (historical since D1) |
| [ODV] | On-device runtime research (2026-11-04) |
| [PX] | Price and terms research for COSTS.md (2026-11-04) |
| [MAT] | Matching report |
| [A] | Assumption |

---

## 1. Controller and roles

| Role | Party | Notes |
|---|---|---|
| Controller | Grouper, a Danish company (to be incorporated [A]) | Datatilsynet is the lead authority. **[LAWYER]** entity details |
| Privacy lead | A named founder or employee; not a formal DPO (§8) | Owns this document, the DPIA, the request inbox and breach handling |
| Processor | Google (Firebase / Google Cloud) | Firestore, Functions, Storage, Cloud Tasks, Scheduler, Secret Manager, Logging, Auth, Hosting, FCM, App Check (§9) |
| Processor | Google, for Google Maps Platform (Places API) **[LAWYER]** confirm the role | The meetup place picker: search text, session token and the device's IP address go from the app to Google (§9) |
| Independent controllers | Apple (Sign in with Apple, App Attest, App Store); Google as identity provider, for Play Integrity and as Google Play | Their own account and attestation data [GDPR]. **[LAWYER]** |
| No role | Expo (EAS Build only), Hugging Face (our builds and CI fetch the pinned model files from it; the app never contacts it), GitHub; the user's own calendar app ("Add to calendar" opens the phone's sheet, and only the user decides to save) | No end-user data: calibration sets in the repository are synthetic or founder-written (D§5.3). Expo push and EAS Update are not used [GDPR][FBX] |
| Recipients | Invitees and fellow pod members | Invitees see the theme in their own wording before confirmation (they hold it too). After confirmation, members see first names, the optional "about me" sentence and photos; in sensitive-themed pods a photo only if its owner opts in (D§3.4, D§6.1 S6). While a meetup is scheduled, members see whether each other has confirmed ("<firstName> hasn't confirmed"). Around each scheduled meetup, the current confirmed members see each other's meetup-chat messages, until they are deleted about 3 days after the meetup (D§3.6) |

---

## 2. Purposes and lawful bases

| # | Purpose | Data | Art. 6 / Art. 9 |
|---|---|---|---|
| P1 | Account and sign-in | Provider UID, email (may be an Apple relay address); for Google sign-in, the Google display name and photo URL that Firebase Auth copies (cleared from the top-level fields, possibly kept in the provider record, §9); Google's IP logs; Hosting request data for the email link | 6(1)(b) |
| P2 | 18+ eligibility, age-range matching | DOB (transient, on the device and in the request); `birthYear` stored; after an under-18 answer, 30-day markers keyed on `HMAC(email)` and on `HMAC(provider, provider uid)` (e.g. Apple's `sub`, because Apple sign-in usually carries no email) | 6(1)(b); marker 6(1)(f) (child protection) |
| P3 | Local matching | Postcode or coarse location, converted on the device to a geohash-5 cell (the server never receives the postcode); radius; launch area | 6(1)(b) |
| P4 | Ordinary interests | Tag text, normalized form, embedding (computed on the phone, stored by us), concept link; for a user's "This isn't sensitive for me" holding, the same | 6(1)(b) |
| P5 | **Sensitive interests** (detected or self-flagged) and pods themed on them | Tag text, embedding (computed on the phone), concept link, the blanket consent record | 6(1)(a) + **9(2)(a)**, under the one blanket consent (§3) |
| P6 | Sensitivity check of a typed tag | On the phone: tag text, vector, detector result (nothing leaves the phone for a sensitive tag without the consent). On the server: the same check repeated on what was sent | Phone: no processing by the controller until something is sent [A, **LAWYER**]. Server: 9(2)(a) for consenting users; for non-consenting users the server sees only text the phone judged ordinary (§3.8) |
| P7 | Same-gender pods | Gender, only if the option is on. Not used for metrics (D§6.6) | 6(1)(a), with Art. 9-level safeguards as a precaution [GDPR] |
| P8 | Photo for confirmed pod members | One image, EXIF removed | 6(1)(a) |
| P9 | Weekly matching, "why this pod" | P2–P7 data, languages, availability, pair history, reliability; sensitive-theme eligibility (D§6.1 S5) | 6(1)(b); 9(2)(a) for sensitive themes (§4.4) |
| P10 | Meetup planner, attendance and feedback | Options with a Google Places place (ID, name, short address, rounded coordinates, type, map link), votes, attendance status (coming, not coming, unconfirmed), "Who was there?", private meet-again, rating | 6(1)(b) |
| P11 | No-show policy | Attendance counters | 6(1)(b) per the Terms; **[LAWYER]** 6(1)(f) as an alternative |
| P12 | Blocks | User-ID pairs | 6(1)(b) |
| P13 | Reports, automated moderation, automatic and expiring sanctions, statements of reasons; automatic anti-infiltration holds in sensitive-themed pods (R15) | Report, automated outcome code, the copy of a reported chat message; sensitive-theme holds ("not a genuine member", anomaly) | 6(1)(f); 6(1)(c) (DSA Arts. 16–17); 9(2)(a) for the automatic anomaly check of sensitive holdings (named in the consent) |
| P14 | ~~Human review of flagged tag wording~~ | — | **Removed** (D2): nobody reviews tags, reports or concepts |
| P15 | Transactional push | FCM token, installation ID | 6(1)(b). No marketing pushes are planned |
| P16 | Security and abuse prevention | App Check tokens, rate-limit counters, pseudonymised logs (`uidH`, no IP addresses: Cloud Run request logs are excluded, §5) | 6(1)(f) (Recital 49) |
| P17 | Accountability records | Consent events, request records, erasure ledger | 6(1)(c) (Arts. 5(2), 7(1), 17) |
| P18 | Service metrics, including the day-1 funnel (DESIGN F36) and "Where did you hear about Grouper?" (F37) | Aggregate counters per drop and launch area; any cell under 10 suppressed; no gender. **Funnel:** uid-free counters per launch area and ISO week in `funnel/{areaId}_{weekId}` for sign-up, onboarded, waitlisted, eligible for the first drop, first proposal, first confirmed pod, first meetup and second meetup, plus the optional "where did you hear" answer (one fixed choice, counted once, never stored on the user). To count each person once per stage, the server keeps per-user milestone timestamps on the server-only `matchProfiles/{uid}` (erased with the account). Exact counts are stored; the only reader (the admin CLI) shows any cell under 10 as "<10". No analytics SDK, no device identifiers, nothing in share links. Kept 24 months (TTL). The per-city waitlist counter `areas/{areaId}.waitlistCount` is an exact city total shown in the app ("<10" below 10), which reveals nothing about any one person | 6(1)(f) (knowing whether the service works in each city; balancing: aggregates only, small cells suppressed, no new data collected for it except the optional, unlinked source answer) |
| P19 | Product improvement: weight tuning and classifier recalibration | `drops` aggregates and simulations. Recalibration uses only synthetic and founder-written sets (no review, so no reviewed real tags). Per-user outcome data only after a DPIA update | 6(1)(f), with a documented balancing test before M4 |
| P20 | ~~Service emails~~ Removed: there is no email (DESIGN F39). The inactivity warning and Art. 34 notices go in-app and by push (P15, §5, §14) | — | — |
| P21 | Meetup chat (D§3.6): short messages between current pod members from 24 h before until 24 h after each meetup, with moderation and generic pushes | Message text, author, time; in sensitive-themed pods often Art. 9 data (the theme, health details) | 6(1)(b); in sensitive-themed pods also **9(2)(a)**, under the blanket consent, which names the chat (§3.3). Art. 9 details in ordinary pods' chat or about other members: **[LAWYER]** (§17) |
| P22 | "About me" (D4): one optional sentence shown to confirmed co-members | Up to 140 characters | 6(1)(b). Never used for matching. Art. 9 details a user volunteers here are not covered by the blanket consent, which concerns interests **[LAWYER]** (§17) |
| P23 | Meet-again pair signals (D9): mutual yes → may be matched again after 4 weeks; either no → never again | The two members' answers about each other under an HMAC pair key; the resulting `recentH` entries | 6(1)(b) |
| P24 | Meetup place search (D8) | Search text typed into the place picker, a session token, the device's IP address and app identifiers, sent by the app to Google Places; we store only the chosen place | 6(1)(b) |

A contract is not an Art. 9 exception (EDPB 05/2020 §99) [GDPR]. Every sensitive step therefore rests on the blanket explicit consent. The check that decides whether a tag is sensitive now runs on the phone before anything is sent, which largely resolves the old pre-consent issue (§3.8).

---

## 3. Art. 9 explicit consent design

### 3.1 When and how consent is asked
**One blanket explicit consent** (founder decision D3, 2026-11-04), as many dating apps do. It is asked once during onboarding, on its own screen, and can be given or withdrawn later in Settings → Privacy. It covers every interest of the user's that may be sensitive and every interest they mark "Keep this private".

The design follows EDPB 05/2020 [GDPR]:
- an express statement through an unticked checkbox (§§93–96);
- a separate screen with specific purposes (§3.3);
- "I agree" stays disabled until the box is ticked;
- **freely given:** "Not now" keeps the app fully usable. Without the consent, a tag that the device detects as sensitive, or that the user marks private, is refused with a clear message and nothing is stored. The user can add every other interest.

With the consent, the interests step shows **no prompt** for a detected tag: the protections apply silently (theme-only use, no chips, labels or explanations, separate storage) and the tag list shows a lock icon. The per-tag consent sheet is gone.

Detection runs **on the phone** (D1): the EmbeddingGemma 2 detector decides before anything is sent, and it is the only sensitivity signal besides the user's own "Keep this private" (DESIGN F38). Without the consent, possibly-Art. 9 text therefore never leaves the device. The server decides with the margin the phone sent; it has no word list of its own.

A user may also choose **"This isn't sensitive for me"** on a tag treated as sensitive. That holding is then ordinary, for that user only. **[LAWYER]** confirm this user downgrade (it re-enables chips, labels and explanations for that holding).

Gender has its own consent (§3.6).

### 3.2 Standing notice at the interest field
- **EN:** "Tip: interests that say something about your health, beliefs, sexuality, politics, ethnic origin or union membership are only saved if you have agreed to sensitive interests (Settings → Privacy). We then keep them private and use them only as a pod's theme. Only add things about yourself."
- **DA:** "Tip: Interesser, der siger noget om dit helbred, din tro, din seksualitet, politik, etniske oprindelse eller fagforening, gemmer vi kun, hvis du har sagt ja til følsomme interesser (Indstillinger → Privatliv). Så holder vi dem private og bruger dem kun som tema for en pod. Tilføj kun noget om dig selv."

### 3.3 Consent screen: draft copy

**English (`art9-blanket-en-v1`)**

> **Sensitive interests**
>
> Some interests can reveal your health, religion or beliefs, sexual orientation or sex life, political opinions, ethnic origin or trade union membership, for example "pregnant", "Ramadan" or "queer book club". The law calls this special category data, so we need your explicit consent before we use interests like these. You can say no and still use Grouper with your other interests. We then just won't save interests like these.
>
> If you agree, Grouper does the following with your interests that may be sensitive, and with any you mark "Keep this private":
> - checks automatically, on your phone and before anything is sent, whether an interest may be sensitive;
> - saves it privately on your account, apart from your other interests. It is never shown on any profile, and we never show it as a label, suggestion or explanation;
> - uses it in automated matching to propose pods of 4–6 people near you who added the same interest and also consented;
> - shows it as the pod's theme only to the people invited to those pods, who all added it too. Some of them may decline. Once a pod is confirmed, its members see your first name. They see your photo only if you choose to show it in that pod;
> - lets members of such a pod write to each other in a short meetup chat, open from 24 hours before until 24 hours after each meetup. What you write there may reveal the theme. Messages are deleted about 3 days after the meetup;
> - checks accounts automatically for signs that someone is not genuine, for example an account that adds many unrelated sensitive interests, and then pauses that account's sensitive pods for a while.
>
> **Please note:** we cannot verify who people are. Someone could create an account and pretend to share an interest in order to find out who has it. We make that harder (new accounts wait, accounts are limited in how many such pods they join, and you can report "not a genuine member"), but we cannot rule it out. Only share in a pod what you are comfortable with.
>
> If we treat an interest as sensitive and it isn't for you, choose "This isn't sensitive for me" on it. We then treat it as an ordinary interest, for you only, and the protections above no longer apply to it.
>
> You can withdraw your consent at any time in Settings → Privacy. We then delete all your sensitive interests at once and take you out of pods built around them. Your other interests are not affected.
>
> ☐ **I explicitly consent to Grouper processing interests that may reveal sensitive information about me, for the purposes above.**
>
> [I agree] (disabled until ticked) [Not now] · Read more about sensitive interests

**Danish (`art9-blanket-da-v1`)**

> **Følsomme interesser**
>
> Nogle interesser kan afsløre noget om dit helbred, din religion eller overbevisning, din seksuelle orientering eller dit seksualliv, dine politiske holdninger, din etniske oprindelse eller dit fagforeningsmedlemskab, fx »gravid«, »ramadan« eller »queer læseklub«. Det er særlige kategorier af personoplysninger, så vi skal have dit udtrykkelige samtykke, før vi bruger den slags interesser. Du kan sagtens sige nej og stadig bruge Grouper med dine andre interesser. Så gemmer vi bare ikke interesser som dem.
>
> Hvis du siger ja, gør Grouper følgende med dine interesser, der kan være følsomme, og med dem, du markerer med »Hold den privat«:
> - tjekker automatisk på din telefon, før noget bliver sendt, om en interesse kan være følsom;
> - gemmer den privat på din konto, adskilt fra dine andre interesser. Den vises aldrig på nogen profil, og vi viser den aldrig som etiket, forslag eller forklaring;
> - bruger den til automatisk matchning, så vi kan foreslå pods med 4–6 personer i nærheden, som har tilføjet samme interesse og også har givet samtykke;
> - viser den kun som podens tema for de personer, der bliver inviteret til de pods, og som alle selv har tilføjet den. Nogle af dem siger måske nej. Når poden er bekræftet, ser medlemmerne dit fornavn. Dit billede ser de kun, hvis du selv vælger at vise det i den pod;
> - lader medlemmerne af sådan en pod skrive sammen i en kort mødechat, der er åben fra 24 timer før til 24 timer efter hvert møde. Det, du skriver dér, kan afsløre temaet. Beskederne slettes ca. 3 dage efter mødet;
> - tjekker automatisk konti for tegn på, at nogen ikke er ægte, fx en konto, der tilføjer mange forskellige følsomme interesser, og sætter i så fald kontoens følsomme pods på pause i en periode.
>
> **Vær opmærksom på:** Vi kan ikke kontrollere, hvem folk er. Nogen kan oprette en konto og lade som om, de deler en interesse, for at finde ud af, hvem der har den. Vi gør det sværere (nye konti skal vente, en konto kan kun være med i et begrænset antal af den slags pods, og du kan anmelde »ikke et ægte medlem«), men vi kan ikke udelukke det. Del kun det i en pod, som du er tryg ved.
>
> Hvis vi behandler en interesse som følsom, og den ikke er det for dig, så vælg »Den er ikke følsom for mig« på interessen. Så behandler vi den som en almindelig interesse, kun for dig, og beskyttelsen ovenfor gælder ikke længere for den.
>
> Du kan til enhver tid trække dit samtykke tilbage under Indstillinger → Privatliv. Så sletter vi straks alle dine følsomme interesser og tager dig ud af pods, der er bygget op om dem. Dine andre interesser påvirkes ikke.
>
> ☐ **Jeg giver udtrykkeligt samtykke til, at Grouper behandler interesser, der kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.**
>
> [Jeg siger ja] (inaktiv indtil afkrydset) [Ikke nu] · Læs mere om følsomme interesser

**[LAWYER]** to review:
- the wording, including the residual-risk paragraph (R15);
- whether a blanket consent is specific and freely given enough here (refusal only blocks sensitive tags; the purposes are listed once for all such interests);
- the user downgrade ("This isn't sensitive for me");
- whether the automatic anomaly check (last bullet) belongs in this consent or rests on 6(1)(f) alone;
- whether the meetup-chat bullet is enough to cover messages that reveal the theme, and its "about 3 days after the meetup", given that TTL can take up to another 24 h (§5);
- the Danish copy, with a native speaker.

### 3.4 Recording consent
- **Versioned texts.** The texts live in `packages/core/src/legal/consent-texts.ts` with ids `art9-blanket-en-v1` and `art9-blanket-da-v1`; `textSha256` is the SHA-256 of the canonical text, locked by a test together with this document (the copy in §3.3 must match the code character for character). Nothing has shipped, so the earlier per-tag texts were replaced, not versioned on.
- **Server check.** On "I agree" the app calls `setArt9Consent` with `{textVersion, textSha256, appVersion, checked: true}`; the server accepts only a known `art9-blanket-*` pair (`isValidArt9ConsentProof`).
- **One event.** A Function writes `consentEvents/{id}`: `{uid, scope: 'art9', action: 'grant', textVersion, textSha256, locale, appVersion, method: 'checkbox+button', createdAt}`, and `users.legal.art9 = {textVersion, textSha256, at}`. **No interest is named in any consent event:** every sensitive holding stores the `consentEventId` of that one grant, so the record proves what was shown and accepted without saying which interests or categories it was used for.
- **Append-only except for minimisation.** Events are never edited, with one exception: on account deletion `uid` is replaced by `uidH`, with `redactedAt` set. What remains (scope, action, text version and hash, locale, app version, method, timestamps) proves that consent was asked and given or withdrawn. **[LAWYER]** Even `scope: 'art9'` linked to a person reveals that they agreed to sensitive interests (not that they hold any); confirm that 3 years is proportionate.
- **Minimal.** No IP address and no device fingerprint (EDPB 05/2020 §106 [GDPR]).

### 3.5 Withdrawal (as easy as giving consent, Art. 7(3))
- **Where:**
  - "Remove" on each sensitive interest (`removeInterest`, the effects below for that holding only);
  - "Withdraw consent for sensitive interests" in Settings → Privacy (`withdrawArt9Consent`, every sensitive holding at once, then `users.legal.art9` is removed).
- **Confirmation copy:**
  - **EN:** "Withdraw your consent for sensitive interests? We'll delete all your sensitive interests now and take you out of pods built around them. Other members will only see that a member left. You can keep using Grouper with your other interests."
  - **DA:** "Vil du trække dit samtykke til følsomme interesser tilbage? Vi sletter alle dine følsomme interesser nu og tager dig ud af pods, der er bygget op om dem. De andre medlemmer ser kun, at et medlem er gået. Du kan fortsat bruge Grouper med dine andre interesser."
- **Effects, immediate** (`withdrawArt9Consent` for every sensitive holding, `removeInterest` for one; Art. 7(3) and 17(1)(b) mean processing stops now, not at the next drop). For `withdrawArt9Consent`, steps 6 and 7's consent records come **first**, in one transaction (the `withdraw` event, `users.legal.art9` removed, the ledger entry, the sensitive themes stripped from `matchProfiles`): release revalidation and the backfill check both, so no new sensitive invitation can arrive while steps 1–5 run; step 4 runs again at the end, idempotently:
  1. Delete the holding.
  2. Decrement the tag's count (`refCount`, or `privateAssign.refCount` for a self-flagged holding). At 0, delete the tag text and vector and subtract the vector from its concept.
  3. **Pod cards:** delete every `users/{uid}/pods/*` card themed on that concept, in every state (invited, declined, active, archived).
  4. **Pods:** for every pod themed on that concept, archived ones included, in this order: (a) find the pods through `podState.memberList`; (b) remove the user from `memberUids` and `roster`, after which `sendMessage` refuses them, so no message can arrive after the next step; (c) delete the user's options and votes, their chat messages, their own feedback, and other members' attendance and meet-again entries about them, and remove the pod from photo grants in both directions; (d) last, remove the user from `podState.members` and `podState.memberList`, so that a retry after a failure still finds every pod (D§8.2). Active pods follow the normal below-minimum rules (D§4.6). In an active pod (planning or scheduled) the others see only "A member left"; an ended pod changes without a notice or push.
  5. **Open invitations** on that theme are cancelled; the user is removed from this week's unreleased pods (release revalidation checks `consentRef`, D§10.3) and from the backfill pool for that theme.
  6. **Matching data:** remove the concept from `matchProfiles.themes` and `themeIds`.
  7. **Records:** for `withdrawArt9Consent`, append one `withdraw` event, remove `users.legal.art9` (in the first transaction; a retry still finds the remaining holdings and pods) and set `expiresAt` to +3 years and `redactedAt` on the grant and withdraw events; for `removeInterest`, no consent event changes (the consent stays). Write an `erasureLedger` entry (`consentWithdrawal` for the blanket withdrawal, `interest` with the HMAC'd `interestId` for one holding) so that a backup restore cannot bring the holdings back (§5).
  8. **Device:** the app clears its image cache and the cached pod docs at the next open (D§9 Photos).
- **Test:** an emulator test asserts that after withdrawal no document references that uid together with a withdrawn `interestId` or concept.
- **No detriment:** other pods and interests are untouched, and the user can give the consent again at any time.

### 3.6 Gender (same-gender pods)
- **Copy:**
  - **EN:** "To give you same-gender pods we need to know your gender. We use it only to form same-gender pods, never show it on any profile or use it for statistics, and delete it when you turn the setting off. Note: if you are placed in a same-gender pod, its members will know that everyone in it shares your gender and chose same-gender pods." ☐ "I consent to Grouper using my gender to form same-gender pods."
  - **DA:** "For at kunne give dig pods med samme køn skal vi kende dit køn. Vi bruger det kun til at danne pods med samme køn, viser det aldrig på nogen profil, bruger det ikke til statistik og sletter det, når du slår indstillingen fra. Bemærk: Hvis du kommer i en pod med samme køn, ved medlemmerne, at alle i poden har samme køn som dig og har valgt pods med samme køn." ☐ "Jeg giver samtykke til, at Grouper bruger mit køn til at danne pods med samme køn."
- **Options:** woman, man, non-binary. For non-binary users the sheet adds: "Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary." **DA:** »Pods med samme køn for ikke-binære personer kan være sjældne i dit område, og medlemmerne vil vide, at alle i poden er ikke-binære.« **[LAWYER]** native-speaker check. Wider options (e.g. "women and non-binary") are open question D§2.4 Q16.
- **No second purpose:** gender is not used in fairness metrics or any aggregate (D§6.6). Fairness is monitored for the same-gender option as a group.
- **Record:** a `consentEvents` entry with `scope: 'gender'`.
- **Withdrawal:** turning the option off deletes gender everywhere and writes an `erasureLedger` entry (`gender`).

### 3.7 Re-consent
- **Material text changes** (purposes, recipients, the checks) get a new version id. Users who gave the earlier version are asked again at their next app open. Until they agree, their sensitive holdings are excluded from matching and from every new purpose (release revalidation treats the old grant as invalid, D§10.3); after 14 days without agreement `withdrawArt9Consent` runs for them **[LAWYER]**.
- **Cosmetic changes** get a new version without re-asking.

### 3.8 The pre-consent check: largely resolved by on-device processing (R5)
**The old problem.** To decide whether consent was needed, the server classified the typed text before any consent existed. After C-252/21 *Meta*, an Art. 6 basis is not enough when processing reveals Art. 9 data, and no Art. 9(2) exception was identified for that step. R5 was rated medium and open.

**What changed (D1, D3).** The whole check now runs **on the phone**, before anything is sent: normalisation, PII, blocklist, the on-device EmbeddingGemma 2 embedding and the detector (D§5.2 (0)). Combined with the blanket consent:
- **Without the consent**, a tag the phone treats as sensitive is refused on the phone and **never sent**. The server receives only text that the pinned model and threshold judged ordinary.
- **With the consent**, everything is sent, and the server's repeat of the check rests on 9(2)(a).

**What remains.**
1. **Device-side processing.** Running the check on the user's own phone, with nothing transmitted, is probably not processing by Grouper as controller of the result **[A, LAWYER]**. The app computes it because the user pressed "Add"; the result is used only to decide whether to send.
2. **Disagreement between phone and server.** The server no longer has its own check (DESIGN F38). It can still refuse a non-consenting user's tag in one case: the text is already stored as sensitive, or another user's phone flagged it more strongly, so the higher stored margin decides. Then it refuses with `ART9_CONSENT_REQUIRED` and persists, caches and logs nothing (memory only, EU, tested). That is a narrow, rare, fail-closed case.
3. **Detector misses** (R4): a sensitive tag the phone's model misses is stored as ordinary. Nothing else catches it.

**Residual rating:** R5 drops from **medium** to **low** (§7.3), subject to counsel confirming point 1. The former options (on-device detector, up-front consent) are both implemented now.

### 3.9 Why one blanket consent can be freely given and specific (D3)
Many dating and community apps ask once for consent to sensitive profile data. The design keeps the EDPB 05/2020 conditions:

| Condition | How the design meets it |
|---|---|
| **Freely given** (Art. 4(11), 7(4); EDPB §§13–48) | Refusing costs nothing except sensitive interests themselves: every other interest, matching, pods, the chat and all settings work. "Not now" is as prominent as "I agree". Nothing is bundled with the Terms. A refused sensitive tag gets a neutral message and a path to Settings, never a nag loop. Withdrawal is one setting and has no effect on ordinary interests. |
| **Specific** (EDPB §§55–61) | One processing context (interests that may be sensitive and self-flagged ones), with the purposes listed: detection on the phone, separate storage, automated matching, theme shown to invitees and members, the meetup chat, the automatic anomaly check. No other purpose is covered; a new purpose needs re-consent (§3.7). |
| **Informed** (EDPB §§62–76) | The categories with examples, every recipient (invitees, members), the residual infiltration risk, the user's own override and how to withdraw are on the screen; "Read more" leads to the full page. |
| **Explicit** (Art. 9(2)(a); EDPB §§91–98) | An unticked checkbox with a statement that names explicit consent, plus a separate "I agree" button; recorded with text version and hash (§3.4). |
| **Granular?** | The trade-off: one consent covers every sensitive interest the user adds later, instead of one per tag. The user still controls each interest (add, remove, "Keep this private", "This isn't sensitive for me"), and nothing sensitive is ever shown outside a pod of people who added the same interest. Counsel must confirm that this granularity is enough when the user cannot foresee which future tags the detector will treat as sensitive **[LAWYER]**. |

**The user downgrade** ("This isn't sensitive for me", D2). It applies to the user's own holding only: that holding becomes ordinary and feeds chips, labels, "also share" explanations and secondary matching like any ordinary interest; nobody else's holding of the same text changes. It is offered only on a holding already stored as sensitive (so only to consenting users) and never for a tag about someone else (§4.3). If the tag objectively reveals Art. 9 data ("pregnant"), the user's statement does not change its legal nature: the holding is still Art. 9 data, now processed with fewer safeguards, and arguably still under the blanket consent, whose text announces this choice. In the code, core and `addInterests` would also accept the downgrade from a user without the consent; only the app limits it to stored sensitive holdings. **[LAWYER]** Confirm that the downgrade is acceptable for objectively Art. 9 text ("pregnant"), now that every flag is a model flag (DESIGN F38), and whether it may be offered to non-consenting users (D§2.4 Q23).

---

## 4. Free-form tags and inferred data

### 4.1 Legal background [GDPR]
- **C-184/20 *OT*:** "revealing" includes indirect revelation by deduction.
- **C-252/21 *Meta*:** the prohibition applies wherever processing allows sensitive information to be revealed, regardless of accuracy or intent. Art. 9(2)(e) ("manifestly made public") is unavailable to us.
- **C-21/23 *Lindenapotheke*:** health data is read broadly.
- **C-492/23 *Russmedia*** (commentary only): platforms must identify sensitive content before publication, check that the poster is the data subject, and prevent copying.

### 4.2 What we treat as special-category data

| Item | Art. 9? | Handling |
|---|---|---|
| Sensitive tag text (holding, cache doc) | Yes | Owner-only or server-only path; deleted at withdrawal or when its counts reach 0 |
| A self-flagged holding of an ordinary tag ("Keep this private") | Treated as yes | Stored and matched exactly like a detected sensitive holding, in the sensitive partition. It never adds to the ordinary concept's counts, label, chips or pod interests (D§5.2 (5)) |
| Its embedding | Yes; embeddings can be partly inverted toward text [GDPR] | Computed on the user's phone and sent only with the consent; stored server-only on the tag doc (no uid); never returned to clients |
| A "This isn't sensitive for me" holding of a sensitive tag | Probably still yes, if the text objectively reveals Art. 9 data | Stored and used as ordinary for that user only, at the user's request (§3.9) **[LAWYER]** |
| Centroid of a sensitive concept | Yes, when there are few members | Server-only; recomputed on removal (vector subtracted from `sum` at once) |
| Label of a sensitive concept | — | **None is derived.** Every member sees the theme in their own wording; no shared document carries a sensitive label (D§5.2 (8), D§6.7) |
| Concept link in `matchProfiles` | Yes (pseudonymous) | Server-only |
| Drop input and result snapshots; concept snapshot | Yes (pseudonymous concept links and vectors) | Server-only EU buckets; drop snapshots deleted after release (≤ 2 days), concept snapshots 14 days |
| Membership of a sensitive-themed pod | Yes | Visible only to invitees and co-members, who all hold the same consented interest; age span and shared interests are withheld from cards before confirmation |
| Meetup-chat messages in a sensitive-themed pod | Yes (they will often reveal the theme or health details) | Readable only by current members (rules `get` on the pod); written only by the server; never in pushes or logs; deleted at meetup + 72 h (TTL); the writer's messages are deleted at withdrawal and erasure; a reported message is copied into the report (§5) |
| Meetup-chat messages in an ordinary pod | Possibly (a member may mention a health detail, for example) | Handled the same way; no consent covers volunteered Art. 9 details here **[LAWYER]** (§17) |
| Erasure-ledger `consentWithdrawal` / `interest` entries; `consentEvents` with `scope: 'art9'` | Possibly (shows that a person agreed to sensitive interests, or removed some interest) | `uidH` and, for a single removal, the HMAC'd `interestId` only; no wording, concept or category; 35 days and 3 years respectively |
| Ordinary tags that together imply a sensitive trait | Possibly (inference) | Sensitive holdings never feed secondary scoring; a theme is always one concept every member holds |
| "About me" sentence | Possibly, if the user writes something sensitive | Shown only to confirmed co-members; contact details and blocklisted text refused; not used for matching; deleted with the account |
| Meet-again pair signals | No (a private preference about a person) | Server-only, HMAC pair key, never shown; the "no" is invisible to both |
| Place search text sent to Google | Rarely (a search can name a clinic or a place of worship) | Only public place types are offered; sent by the app directly to Google with no user ID; we store only the chosen place |
| Gender | Precautionary yes | §3.6 |

### 4.3 Controls
- **Detection** (on the phone; the server decides with the phone's margin, DESIGN F38). The on-device EmbeddingGemma 2 detector alone decides a tag's sensitivity; then the holding-level "Keep this private" and "This isn't sensitive for me". There is no word list: the Art. 9 lexicon and the known-ordinary hobby list were removed. The detector is tuned for recall: 100% caught on the test set, with about 49% false flags, mostly ordinary Danish words [CAL]. With the blanket consent a false positive costs nothing visible (the interest is just used more narrowly) and the user can override it with "This isn't sensitive for me"; without the consent it means a refused tag, and the app offers only the consent or rewording. A miss is the real risk. **[LAWYER]** Without the lexicon, a model miss is the only residual path and recall depends on the model alone: 100% on the labelled set, but longer tags can dilute a sensitive word ("Pride parade volunteering" scores below the threshold). Without the known-ordinary list more ordinary Danish words are flagged: of the 479 words the list held, the model flags 238 (145 of 196 Danish, 93 of 283 English), among them "madlavning", "brætspil" and "løb". With the consent that only narrows their use; without it they are refused. Confirm that this trade-off (fewer misses would need a word list; fewer false refusals would need one too) is acceptable for Art. 9 and Russmedia.
- **No cross-sensitivity merges.** Sensitive and ordinary tags never share a concept. That blocks errors like "brystkræft" joining "brætspil" [EXP].
- **Theme-only use (S1–S4, D§6.1):**
  - a sensitive holding is only ever a theme, and the rule is enforced per holding, so a self-flagged ordinary tag is covered;
  - every member must hold it with consent;
  - ≥ 12 eligible consenting holders within 25 km of the pod [A], measured locally, never over a whole launch area;
  - it never appears in pushes, aggregates, chips or labels.
- **Before confirmation.** Cards for sensitive themes omit the age span and the shared interests, because invitees who decline are not members (D§3.2).
- **Infiltration controls (S5–S7, R15).** Eligibility gate (account age, an attended meetup, no open reports), at most 1 active sensitive-themed pod and 3 sensitive proposals per 12 weeks, at most 3 sensitive adds per week, photo opt-in per pod, a "not a genuine member" report that holds the reported account for 28 days, and an automatic 28-day anomaly hold for accounts with many unrelated sensitive interests. Nobody reviews these (D2): a hold expires on its own and restarts on a new report. The residual risk is stated in the consent text (§3.3).
- **Aggregates.** None for sensitive concepts. Ordinary chips appear only with ≥ 10 holders in the launch area, drop aggregates suppress cells under 10, and waitlist counts are bucketed [GDPR].
- **Third-party data** ("my son's diagnosis"). A tag that matches a third-party pattern **and** is sensitive is refused (`THIRD_PARTY_SENSITIVE`), and "This isn't sensitive for me" is never accepted for it, with a hint to reword it about the user's own situation ("parent of an autistic child"). The user's own consent cannot be a 9(2)(a) basis for someone else's health data, and Russmedia expects a poster-is-subject check. An ordinary third-party tag gets a warning only. **[LAWYER]** Confirm the default, and whether a reworded tag ("parent of …"), which still indirectly concerns the child, may rest on the user's consent.
- **Copying.** Android screen capture can be blocked on sensitive-themed pod screens, the meetup chat included (`expo-screen-capture`) [A]. The Terms forbid sharing members' information.
- **Meetup chat.** Open only from 24 h before until 24 h after a scheduled meetup, for current members only, and deleted 3 days after the meetup (D§3.6). Messages pass the same blocklists and PII patterns as tags: CPR-like numbers are always refused, and before the meetup a phone number, email, handle or link needs a second tap after "You haven't met yet". Pushes never carry the text.
- **No rescans** (DESIGN F38). Stored tags are never re-classified on the server. Prototype or threshold changes ship with a new app or model version and apply when phones re-embed or re-check; a tag that is already stored keeps its partition until then, and existing sensitive holdings stay sensitive. A later holder whose phone flags a stored ordinary text still gets a sensitive holding (or a consent refusal).
- **Self-flagging and the user's own override.** Users can make any interest private ("Keep this private", needs the consent) and can downgrade a system flag for their own holding ("This isn't sensitive for me", §3.9). There are no reviewer downgrades (D2). A tag that a newer model or threshold would call ordinary changes only for **future** adds; existing sensitive holdings stay sensitive until their holder chooses otherwise, so data given under the consent never starts feeding shared features without the holder's own choice.
- **Trusted client vectors** (D1, accepted risk, R18). The server stores the vector the phone computed and cannot recompute it. A modified app could send a misleading vector or margin; the server has no check of its own on the text (DESIGN F38), but checks the model key and vector norm and keeps the first vector stored for each text (D§9). The first writer's vector decides a text's **tag-level** sensitivity, but never lowers anyone else's: each later holding is decided with the higher of the stored margin and that user's own phone's margin, so a holder whose app flags the text gets the full protections (or a consent refusal). What remains is a text that the first writer made look ordinary and that a later holder's phone does not flag either.

### 4.4 Profiling and Art. 22
- **Probably outside Art. 22(1).** Pod formation is solely automated profiling, but being proposed (or not) for a friend group is unlikely to have a "legal or similarly significant" effect [GDPR]. **[LAWYER]**
- **Safeguards anyway:**
  - the consent text names automated matching (Art. 22(2)(c) and (4));
  - **automated temporary pauses only** (two reports in 30 days or one safety report, 28 days; the no-show pause, 2 weeks, and suspension, 8 weeks; the suspected-under-18 pause, 28 days; the sensitive-theme holds, 28 days; D§3.7, D§4.4), each with an immediate statement of reasons and a fixed end date;
  - **no permanent sanctions** exist: a ban or a permanent suspension would need a human decision, and D2 removed human review;
  - **no human review on request** (D2). The statement of reasons gives the support address; users can still exercise their GDPR rights (objection, rectification) with the privacy lead, which is a legal duty, not a review queue. If Art. 22(1) applied, Art. 22(3) would require a way to obtain human intervention, so the position that it does not apply now carries more weight **[LAWYER]**;
  - automated tag, "about me" and chat-message rejections carry a statement of reasons.
- **Transparency (Arts. 13(1)(c), 13(2)(f)).** "Why this pod" (D§6.7) and a "How matching works" page covering: inputs used and not used (photos, inferred traits, "about me", gender only for same-gender pods), meet-again effects, the eligibility rules for sensitive themes, every automated pause with its length, that no human reviews these decisions, and pause at any time.

---

## 5. Data inventory and retention

| Data | Location | Retention | Mechanism |
|---|---|---|---|
| Auth record (uid, provider ID, email; for Google sign-in, the Google display name and photo URL in the `google.com` provider record, refreshed at each sign-in [verify in M0]) | Firebase Auth (US) | Until deletion. Google purges live and backup copies within 180 days; IP logs are kept a few weeks [FBX]. The top-level `displayName`/`photoURL` are cleared at onboarding | `auth.deleteUser` |
| Abandoned sign-ups (Auth user, no profile) | Firebase Auth | 7 days | `dailyMaintenance` reconciliation |
| Under-18 markers (`HMAC(email)` if present, plus `HMAC(provider, provider uid)` per federated identity) | `underageMarkers` | 30 days | TTL |
| Date of birth | Not stored | — | — |
| Postcode, coordinates | Not sent: converted on the device | — | — |
| Profile, preferences, "about me" (also copied to the roster of the user's confirmed pods; an edit or clearing reaches every such roster, ended pods included) | `users`, `matchProfiles`, `pods.roster` | Until deletion. Inactive 12 months (no call to the server from the signed-in app; every such call refreshes `lastActiveAt`, at most once a day) → warning (an in-app notice and a push, also to tokens older than 60 days; there is no email, DESIGN F39), deleted 30 days later, also when no push can reach the user (notifications off, no token) [GDPR] | `purgeUser`, `dailyMaintenance` |
| Gender | Same | Until opt-out or deletion | `updateProfile` |
| Ordinary interests | `users/{uid}/interests` | Until removed | Callable |
| Sensitive interests (including self-flagged) | `users/{uid}/sensitiveInterests` | Deleted immediately on removal or on withdrawal of the blanket consent | Callable |
| Blanket consent state | `users.legal.art9` | While given; removed on withdrawal | `setArt9Consent`, `withdrawArt9Consent` |
| Tag cache (text + the first writer's client vector, no uid) | `tags` | While at least 1 holder | Count-based GC |
| Concepts | `concepts` | While non-empty | GC |
| Unanswered or declined pod cards | `users/{uid}/pods` | Drop + 14 days [GDPR]; at once on withdrawal for that theme | TTL, `withdrawArt9Consent`, `removeInterest` |
| Dissolved pods | `podState`, `pods` | 30 days [MAT] | `dailyMaintenance` |
| Confirmed pods | `pods`, `podState` | Until archived by the state machine (D§4.6); deleted 90 days after archive [MAT] | `dailyMaintenance` (recursive) |
| Meetup options and votes (each with a Google place: ID, name, short address, coordinates rounded to ~11 m, type, map link) | `pods/{id}/options` | Archive, re-plan, or meetup + 30 days, whichever is first | `dailyMaintenance` |
| The chosen place and attendance statuses | `pods.planning.place`, `pods.attendance`, `podState.members` | With the pod. Google's caching terms may require removing the place 30 days after the meetup (D§2.4 Q21) | State machine, `dailyMaintenance` |
| Meetup-chat messages | `pods/{id}/messages` | `meetupAt` + 72 h; TTL deletes usually within a further 24 h, so the notice says "about 3 days after the meetup". The writer's messages go at once at erasure, and at withdrawal in pods on that theme | TTL (`expiresAt`), `purgeUser`, `withdrawArt9Consent` |
| Feedback | `podFeedback` | With the pod, at most until the next Keep round starts (then deleted); only counters remain. Entries about an erased user are deleted at erasure | — |
| Meet-again pair signals | `pairSignals/{pairKey}` (HMAC pair key; the two `uidH`s, their answers, the meetup week) | Until both outcomes are applied to `recentH`, at the latest when either account is erased [A: TTL 30 days after feedback closes] | `submitFeedback`, `hourlySweeper`, `purgeUser` |
| Drop input and result snapshots | GCS `grouper-<env>-drops` (EU) | Deleted after release; lifecycle 2 days | `releaseDrop`, lifecycle |
| Concept snapshots (int8 vectors) | GCS `grouper-<env>-snapshots` (EU) | 14 days | Lifecycle |
| Pair history (HMAC) | `matchProfiles.recentH` | 26 weeks [MAT]; 4 weeks after a mutual meet-again "yes"; a meet-again "no" (never again) until either account is erased | Pruned at the weekly `lastDrop` write; profiles not written in a drop are pruned daily (`recentMinUntil`); erasure removes the erased user's `uidH` from every profile |
| No-show events | `matchProfiles.noShowEvents` | Last 8, at most 26 weeks | Pruned when written |
| Blocks | `blocks`, `users/{uid}/blocks` | While both accounts exist | Cascade |
| Reports, including the copy of a reported chat message (its text; its author is the report's target) | `reports` | 12 months from creation (nobody resolves reports by hand, D2) [GDPR]. Two days before that the report is marked expired, the pair it kept apart in matching is released unless a block remains, and only then does it get its TTL (so it is never deleted while still open; a delayed run deletes it at most a day late). The message copy stays with its report after the message itself is deleted. Erased parties are replaced by `reporterH` / `targetH` | TTL |
| Sanctions (automatic pauses and suspensions, each with an end date) | `sanctions/{uid}` | Until `until`; deleted with the account | `hourlySweeper`, `purgeUser` |
| Ban record (`HMAC(email)`) | `bans` | Not written in the MVP: a ban needs a human decision (D2) | — |
| Consent events (no interest reference) | `consentEvents` | While active, then 3 years; pseudonymised after account deletion [GDPR] **[LAWYER]** | TTL |
| Notices and statements of reasons | `users/{uid}/notices` (reason codes and non-textual params only; input-time rejections are rendered on the device and not stored) | 12 months [A] | TTL |
| Photos | Storage `photos/` | Only the current version, until replaced or deleted (`deletePhoto`); raw uploads ≤ 1 day | Function + lifecycle |
| Exports | Storage `exports/` | Available 24 h; deleted within 48 h [GDPR] | `deleteExport` task + lifecycle + TTL |
| Push tokens | `pushTokens` (with a SHA-256 of each token, so a token moves to the account that registered it last) | 60 days stale (after that used only for the inactivity warning before deletion) or deletion. Google drops installation IDs within 180 days [GDPR] | Function |
| Rate limits | `rateLimits` | 1 day | TTL |
| Erasure ledger (`uidH`, kind, HMAC'd reference) | `erasureLedger` | 35 days [A], longer than the backup windows | TTL |
| Drop aggregates (no per-user data; cells under 10 suppressed) | `drops` | 24 months [A] | — |
| Funnel counters (uid-free; cells under 10 suppressed when read; includes the "where did you hear" counts) | `funnel/{areaId}_{weekId}` | 24 months from the week (`expiresAt`, TTL) | TTL |
| Funnel milestones (per user: when each funnel stage was first reached) | `matchProfiles/{uid}.milestones` | With the account (deleted with `matchProfiles`) | `purgeUser` |
| Application logs (**pseudonymised**: `uidH`, no tag text, bodies, tokens or IP addresses) | Cloud Logging `_Default`, europe-west1 | 30 days [GDPR] | Bucket retention |
| Cloud Run request logs (IP address, user agent) | Not kept: excluded from the `_Default` sink (D§13) | — | Exclusion filter |
| Admin Activity / System Event audit logs (admin principals, resource names; no end-user data) | Cloud Logging `_Required` (global; location cannot be changed) | 400 days (Google default) | Google |
| On-device model files (no personal data) | The user's phone: inside the app (D§5.1); on Android also a copy in app storage (Android backup is off) | Until the app is deleted or updated with another model | App |
| Device caches (images, Firestore offline cache) | The user's phone | Until the next app open after a revocation. Meetup-chat messages: never shown after their `expiresAt`; cached copies, including messages the server deleted at erasure or withdrawal while the device was not listening, stay on disk until the first app open after the latest cached `expiresAt` (`meetupAt` + 72 h), or until the pod leaves the active list if that is sooner. All cleared on sign-out and deletion | App |
| Backups | Firestore PITR + daily backups | 7 days each [GDPR][FBX] | Native; the restore replays every `erasureLedger` entry first |

**TTL mechanics** [FBX]:
- Each expiring collection group has one TTL field, `expiresAt`, declared in `firestore.indexes.json`.
- Deletes usually happen within 24 h of expiry but are not guaranteed, so the notice states each period with a 24–72 h margin.
- TTL does not delete subcollections. Pods and user subtrees are removed by `dailyMaintenance` / `purgeUser` with `recursiveDelete`.
- TTL deletes are billed as normal deletes.
- Storage lifecycle rules clear `uploads/` and `exports/` after 1 day; GCS lifecycle actions are asynchronous and can lag by up to about a day, so exports are also deleted by a task at +24 h. Soft delete is off on the user-content bucket, so deleted photos do not linger.

**Backups and erasure.** A PITR or daily-backup restore (up to 7 days back) would bring back data that was erased since then: withdrawn sensitive interests, removed interests, gender after an opt-out, photo references, unblocks. Every such event (including a withdrawal of the blanket consent) writes an `erasureLedger` entry, and the restore runbook replays all of them, using the same server code as the original action, before traffic resumes. A staging restore drill tests this before M1 exit and quarterly after that.

---

## 6. Data subject rights in the app

Responses within one month, extendable by two (Art. 12(3)) [GDPR]. Requests from outside the app go to privacy@… and are logged.

| Right | In-app path | Backend |
|---|---|---|
| Access, portability (Arts. 15, 20) | Settings → Privacy → Download my data (re-authentication required); live views | `exportData` → `buildExport` → owner-only JSON, available 24 h, deleted within 48 h |
| Rectification (Art. 16) | Edit profile, "about me", interests (including "This isn't sensitive for me"), preferences, area | `updateProfile`, `addInterests`. DOB corrections go through support (18+ re-check) |
| Erasure (Art. 17) | Remove an interest; delete the photo; Delete account | `removeInterest`, `deletePhoto`, `deleteAccount` → `purgeUser` |
| Restriction (Art. 18) | Pause account: data kept, matching and notifications stop **immediately**, including a drop computed but not yet released | `setParticipation({mode: 'pause'})`; release revalidation (D§10.3) |
| Objection (Art. 21) | Form, for legitimate-interest processing | Privacy lead answers (a legal duty; not a moderation review) |
| Withdraw consent (Art. 7(3)) | Remove one sensitive interest; withdraw the blanket consent for sensitive interests (Settings → Privacy); gender toggle; delete photo; stop showing the photo in a sensitive-themed pod | §3.5–3.6; `removeInterest`, `withdrawArt9Consent`, `deletePhoto`, `setPhotoSharing` |
| Human review (Art. 22(3)) | **Not offered** (D2). Statements of reasons give the support address; the position is that Art. 22(1) does not apply (§4.4) **[LAWYER]** | — |
| Complaint | Link to datatilsynet.dk | — |

**Export contents.** The export contains:
- profile, preferences, `birthYear`, area (cell and launch area), and gender if set;
- all interests, including sensitive ones, with how each was classified (the detector margin, "Keep this private", "This isn't sensitive for me"), the blanket-consent state and the consent log;
- "about me";
- pods: IDs, dates, state, the theme in the user's own wording, the user's own status, the reason codes shown to them, and the number of members. **Co-members' names are not included** (in the user's own feedback answers they appear only as `member-1`, `member-2`, … per pod). They are other people's data, and in a sensitive-themed pod a name linked to the theme is that person's Art. 9 data (Arts. 15(4), 20(4)). The user sees them in the app while the pod exists;
- options and votes the user wrote, the user's own attendance answers, and feedback the user gave (including their own meet-again answers);
- meetup-chat messages the user wrote that still exist (text, pod ID, time). Other members' messages are not included;
- **derived matching data:** the reliability score and the counters and dated no-show events behind it, `declinesInRow`, `ignoredInRow`, `waitingSinceWeek`, active pod counts, sensitive-theme eligibility and any hold, weekly drop outcomes with unmatched reason codes, and the number of pair-history entries (not who they are, and not whether another member answered "no" about them);
- blocks the user made (with the first name they saw) and reports the user filed;
- **reports about the user:** category, date, status and decision, and for a reported meetup-chat message the copy Grouper keeps of it (text, date), which is the user's own message and outlives its TTL; the reporter's identity and the report text are withheld (Art. 15(4); databeskyttelsesloven § 22 for text that could identify the reporter **[LAWYER]**); sanctions and automated pauses with their statements of reasons;
- notices.

It never contains who reported the user, other members' private feedback (their meet-again answers, including a "no" that now keeps the pair apart, and ratings), or other users' interests, names or messages. **[LAWYER]** Confirm that withholding individual meet-again answers and the report text is justified, and document the restriction.

**Erasure sequence** (`deleteAccount`, then `purgeUser`; idempotent and retried) [GDPR][FBX]:
1. **Start.** Require recent re-authentication and a replay-protected App Check token. On iOS, the device first revokes the Sign in with Apple token with a fresh `authorizationCode` (RNFirebase `revokeToken`; Apple 5.1.1(v)). Set `status: deleting`: the user is excluded from matching, release revalidation drops them from unreleased pods, and release writes use `update()` with preconditions, so nothing recreates their subtree (D§10.3). Enqueue the purge. Call `auth.deleteUser`.
2. **Interests.** Sensitive holdings go through the full withdrawal (§3.5). Ordinary holdings decrement their counts, and tags and concepts are garbage-collected.
3. **Pods**, in this order, because `podState.memberList` is how a retry finds the user's pods (D§8.2):
   - Every pod the user was ever in, archived ones included, is found through `podState.memberList`.
   - The user leaves every pod (`memberUids`, roster). Active pods follow the below-minimum rules (D§4.6); only their members get the generic "A member left".
   - Unscheduled options the user wrote are deleted; scheduled ones are reattributed to "former member".
   - The user's votes, feedback and meetup-chat messages are deleted, together with other members' `attendance` **and `meetAgain`** entries about the user and the user's entry in `pods.attendance`. (`status: deleting` already stops `sendMessage`.)
   - Last, the user is removed from `podState.members` and `memberList` of every pod. A purge that fails before this step finds every pod again on retry.
   - Pending invitations are cancelled, and the user leaves the backfill pool.
4. **Other links.** Deleted: photo grants (both directions), blocks, `blockedH` entries in other profiles, **the user's `uidH` in other profiles' `recentH`** (found by querying that map key; this also lifts any never-again entry), every `pairSignals` doc containing the user's `uidH` (query on `uidHs`), and push tokens.
5. **Reports, sanctions and admin runs.** In reports the user filed, `reporterUid` becomes `reporterH`. Reports against the user, including reports of their chat messages with the copied text, keep `targetH` instead of `targetUid` for at most 12 months from creation, for safety **[LAWYER]**. `sanctions/{uid}` is deleted. No ban survives (none are written in the MVP). Admin runs about the user (`adminRuns.subjectH`; the admin CLI never records a raw uid) lose their target and reason.
6. **Bulk delete.** `recursiveDelete(users/{uid})` ("about me" included); `matchProfiles/{uid}`; Storage `photos/`, `uploads/` and `exports/` for the uid. An export being assembled meanwhile finds the account gone in its final transaction, writes nothing and deletes its file; `exports/` is cleared once more after step 7.
7. **Records.** Consent events: `uid` → `uidH`, `expiresAt` +3 years. An `erasureLedger` entry (`account`, 35 days) is written, which any backup restore replays first.
8. **Verify.** A test asserts that afterwards no document or object contains the uid **or its `uidH`**, except three documented pseudonymised records: `consentEvents` (`uidH`, 3 years), `erasureLedger` (`uidH`, 35 days) and retained `reports` (`reporterH`/`targetH`). Because we hold the HMAC key, these are pseudonymous personal data, not erased data. They are kept for accountability (6(1)(c)) and safety (6(1)(f)) and are listed in the privacy notice.

Residual windows disclosed in the notice: up to 7 days of Firestore backups and PITR (the ledger is replayed on any restore), up to 2 days for a drop snapshot taken before the deletion, up to 180 days for Google's Auth backups [FBX], and other members' device caches until they next open the app. For the user's meetup-chat messages the device-cache window is longer: a member who has not opened that pod's chat since the deletion keeps a cached copy until their first app open after the meetup's deletion time (`meetupAt` + 72 h, so at most about 3 days after the meetup), and could see it there only offline and only before that time (§5).

---

## 7. DPIA

### 7.1 Screening conclusion: a DPIA is mandatory
Grouper meets 5 of the 8 items on Datatilsynet's Art. 35(4) list [GDPR]:

| Item | Why it applies |
|---|---|
| #3 | Location data plus another WP248 criterion |
| #4 | New technology (embedding classification, now on the user's phone) plus another criterion |
| #5 | Automated decisions on access to a service |
| #7 | Special categories combined with profiling |
| #8 | A breach could affect physical safety (in-person meetups) |

It must be signed before M1, and reviewed with each feature that touches personal data, at least yearly.

### 7.2 Outline (Art. 35(7))
1. **Description:** data flows (D§7), the weekly drop (D§6), processors (§9) and the data inventory (§5).
2. **Necessity and proportionality:** the lawful bases (§2) and the minimisation choices:
   - birth year only;
   - a geohash-5 cell only, converted on the device;
   - the sensitivity check on the device, so sensitive text from non-consenting users is never sent;
   - meetup places picked from public place types, with no free-text field in the app; the server refuses contact details and home-address shapes in a place's name and address but does not verify the place with Google (R19);
   - no public profiles, and chat only around a scheduled meetup (24 h before to 24 h after), for current members, deleted 3 days after it;
   - first names only;
   - gender only on opt-in, and never in metrics;
   - pseudonymised logs without IP addresses, in EU buckets;
   - no analytics.

   Then retention (§5) and rights (§6).
3. **Risk register** with measures (below).
4. **Data subjects' views:** a panel of about 10 alpha users, including holders of sensitive interests (Art. 35(9)) [A].
5. **Prior consultation with Datatilsynet** (Art. 36) if any residual risk stays high.
6. **Sign-off** by the privacy lead and founder, with counsel's opinion attached.

### 7.3 Risk register (L = likelihood, S = severity)

| # | Risk | L | S | Key measures | Residual |
|---|---|---|---|---|---|
| R1 | Breach or insider exposure of sensitive interests | L | H | Owner-only paths; server-only vectors; pseudonymised logs without tag text or IP addresses; EU log buckets; least-privilege service accounts (no default service accounts); 2 admins with hardware keys; audit logs | M |
| R2 | A genuine pod member discloses another member's sensitive interest, or what they wrote in the meetup chat or "about me" | M | H | Consent names invitees and members, and the meetup chat; all share the interest; first names only; photos opt-in in sensitive pods; chat only around a meetup and deleted 3 days after it; Terms; Android screen-capture block (the chat included) | M (accepted via consent) |
| R3 | Inference from themes, aggregates, embeddings, labels | M | H | S1–S4 enforced per holding; no sensitive labels or aggregates; card details withheld before confirmation; k ≥ 10 for chips and drop aggregates; local density ≥ 12 | L |
| R4 | Detector misses a sensitive tag | M | H | Recall-tuned on-device detector (100% on the labelled set) + self-flag; CI recall gate and device golden test. Interest reports were removed with human review (D2), and the lexicon and rescans with DESIGN F38, so the model is the only check and a fix reaches only new adds **[LAWYER]** (§4.3) | M |
| R5 | Pre-consent classification without an identified Art. 9(2) exception (§3.8) | L | M | The whole check (the on-device model) runs on the phone; without the consent sensitive text is never sent; the server's repeat for non-consenting users only refuses (memory only, EU, no persistence, no logs) | **L**, subject to counsel on device-side processing **[LAWYER]** |
| R6 | Physical harm or stalking | L | H | 18+; public-place rule; no distances; coarse cells; block removes the blocked member from shared pods; report with automated pauses; safety tips; police referral (DSA Art. 18) | M |
| R7 | Location triangulation | L | M | One coarse cell, converted on the device; area labels only | L |
| R8 | Minors | M | H | DOB check; Auth user deleted on an under-18 answer; 30-day retry marker; store ratings; report category with an automatic 28-day pause that repeats on new reports (no removal without review, D2) | M |
| R9 | Discriminatory outcomes | M | M | No protected traits in scoring; fairness alerts (D§6.6) without gender; no permanent sanctions (every automated sanction expires) | L |
| R10 | US transfer (Auth); DPF invalidation | M | M | Minimal Auth data (Google name and photo URL cleared where possible, disclosed where not); SCC fallback; TIA; exit plan | M |
| R11 | Account takeover via the email inbox | L | H | Re-authentication (`auth_time` ≤ 5 min) and replay-protected App Check for deletion and export; little data exposed | M |
| R12 | Third-party sensitive data in tags | M | M | Refused when sensitive, with a rewording hint, and never downgradable by the user; warning for ordinary tags | L **[LAWYER]** |
| R13 | Incomplete erasure or over-retention, including restores from backup | L | M | TTL; jobs; erasure ledger for every erasure-relevant event, replayed on restore; staging restore drill; "no uid or uidH remains" test with documented exceptions; release revalidation | L |
| R14 | Function creep (e.g. ads on sensitive data) | L | H | Purpose-limited consent; no ad/analytics SDKs; P19 limited to non-sensitive data; DPIA gate | L |
| R15 | **Deliberate infiltration of sensitive-themed pods** (fake or multiple accounts claim a sensitive interest to learn who holds it locally, for outing or targeting) | M | H | Eligibility gate: account ≥ 14 days, ≥ 1 attended meetup, no open reports (D§6.1 S5); ≤ 1 active sensitive pod, ≤ 3 sensitive proposals per 12 weeks, ≤ 3 sensitive adds per week; photos opt-in per pod (S6); no age span or shared interests before confirmation; "not a genuine member" report with an immediate 28-day hold (S7); automatic 28-day anomaly hold for accounts with many unrelated sensitive interests and for new accounts in a sign-up burst on one sensitive concept; no human review (D2), so an attacker who waits out holds is not stopped for good; 1 h App Check TTL and per-uid limits. Per-device limits are not available from App Check (Play Integrity device recall evaluated in M2). Residual risk stated in the consent text | M **[LAWYER]**; prior consultation (Art. 36) if counsel rates it high |
| R16 | Revoked data lingers on devices (photos, cached pod docs, sensitive interests) | M | L | `max-age` 1 h; image and Firestore caches cleared at the next app open after a revocation and on sign-out or deletion; disclosed window | L |
| R17 | **Harassment or early exchange of contact details in the meetup chat** (abusive or sexual messages; pressure to move to private channels before people have met; a stranger collecting numbers; in sensitive-themed pods, a contact detail tied to the theme) | M | M | Chat only from 24 h before until 24 h after a scheduled meetup, current members only; server-side blocklist and PII checks, CPR-like numbers always refused; before the meetup, a phone number, email, handle or link is held back until the writer confirms past "You haven't met yet. It's fine to wait until after."; Report on every message, with a copy kept in the report beyond the TTL; block removes the member from the pod and the chat; 30 messages per user per pod per hour; pushes without text, at most one per member and pod per 10 minutes; deletion at meetup + 72 h (D§3.6) | L |
| R18 | **Manipulated client vectors** (D1, accepted by the founder): a modified app is the first to send a text with a vector that makes it look ordinary (tag-level sensitivity is then stored as ordinary), or that pulls the text into the wrong concept for everyone who later adds it | L | M | Each later holding is decided with the higher of the stored margin and its own phone's margin, so a holder whose app flags the text keeps every protection; `modelKey` and unit-norm checks; the first stored vector wins per text; medoid guard and merge thresholds; per-uid limits; App Check; concept drift metric (D§9). Residual: later holders whose phone does not flag the text either; the server has no text check of its own (DESIGN F38) | L (accepted) |
| R19 | **Place search sent to Google** (D8): search text, session token and the device IP go to Google Places; a search may name a sensitive place (clinic, place of worship), and in a sensitive-themed pod the search happens around the theme | M | L | No user ID or theme sent; only public place types offered; the key is restricted to the apps; we store only the chosen place; disclosed as a processor and transfer (§9). The server does not call Places: it trusts the client that the id, name and address belong together, but refuses contact details, links and home-address shapes (floor and side) in a place's text, so a modified app cannot put a phone number or a flat into an option; it could still give a public-looking name to a place that is not public | L **[LAWYER]** |
| R20 | **No human review** (D2): wrong automated outcomes cannot be appealed; harassers and suspected minors are paused, never removed; no-show disputes are gone; report text is never read | M | M | Every sanction expires; pauses repeat on new reports; block removes the person from shared pods; majority rule for no-shows; statements of reasons; "How matching works" says plainly what no one reviews | M **[LAWYER]** (DSA Arts. 16–18, Art. 22) |
| R21 | Meet-again "no" works as a hidden soft block | L | L | Pair-specific, invisible to both, no notice, no effect on reports or reliability; HMAC pair key; erased with either account | L |

---

## 8. DPO assessment
Art. 37(1)(c) requires a DPO only when sensitive processing is both a **core activity** and **large scale**.

- **Core activity:** probably met. Sensitive-interest pods are a headline use case.
- **Large scale:** probably not met at launch (two cities, a few thousand users). Datatilsynet applies the four WP243 factors and has no numeric threshold [GDPR].

**Recommendation:**
- Do not designate a DPO yet. A voluntary designation brings the full Arts. 37–39 regime and must be notified to Datatilsynet.
- Appoint a privacy lead and retain counsel.
- Reassess at any of these triggers [GDPR]:
  - 10,000 users with at least one sensitive interest;
  - a national rollout;
  - 50,000 MAU.

**[LAWYER]** Confirm.

---

## 9. Processors, sub-processors and transfers

| Service | Role | Location | Contract / transfer basis |
|---|---|---|---|
| Firestore, Functions, Storage, Cloud Tasks, Scheduler, Secret Manager, Logging (`_Default` bucket), Artifact Registry | Processor (Google) | europe-west1 (Belgium); log buckets pinned through the organization's default storage location (D§7) | Cloud Data Processing Addendum; Google sub-processor list [GDPR][FBX] |
| Cloud Logging `_Required` bucket (Admin Activity and System Event audit logs; admin principals and resource names, no end-user data) | Processor (Google) | Global (location cannot be changed) | As above |
| Firebase Hosting (email-link domain `/__/auth/links`, account-deletion and privacy pages) | Processor (Google) | **Global CDN** | Firebase Data Processing and Security Terms; receives IP addresses, user agents and the one-time sign-in code in the link |
| Firebase Authentication (including magic-link emails) | Processor (Google) | **US data centers only** [FBX] | Firebase Data Processing and Security Terms: DPF (§10.6), else SCCs (§10.2) [FBX] |
| FCM, App Check | Processor (Google) | Global [FBX] | As above |
| Google Maps Platform: Places API (New) Autocomplete and Place Details (D8) | Processor (Google) under the Google Maps Platform terms and data-processing terms **[LAWYER]** confirm the role; Google may claim to be a controller for Maps service data | Global (US) | DPF, else SCCs. Receives, directly from the app: the search text typed into the place picker, a session token, the device's IP address, the API key and app identifiers. No uid, theme or pod is sent. We keep only the chosen place (D§8.1). Cost and quota caps: COSTS.md §3.2 |
| Mailbox for privacy@… | Processor (the mail host) | EU [A] | DPA; DSAR correspondence |
| Sign in with Apple, App Attest, APNs | Independent controller [GDPR] **[LAWYER]** | US / global | Apple terms; disclosed |
| Google Sign-In, Play Integrity | Independent controller [GDPR] **[LAWYER]** | Global | Google terms; disclosed |
| App Store, Google Play (distribute the app, including the bundled on-device model) | Independent controller **[LAWYER]** | Global | Store terms. No processor is needed for model delivery: the model ships inside the app (D§5.1) and the app never downloads it, so no model request from the app reaches us or anyone else |
| Expo (EAS Build) | None | — | Expo push and EAS Update not used [GDPR] |
| Hugging Face | None. Our builds and CI fetch the pinned weights from it; the app never contacts Hugging Face, so it never sees users' IP addresses | — | Apache-2.0 model licence (EmbeddingGemma 2); Gemma Terms only if the v1 fallback is used [CAL][SRV] |

**Transfers** [GDPR]:
- **DPF.** In force. The General Court dismissed *Latombe* (T-553/23) on 3 Sep 2025, and the appeal C-703/25 P is pending. After *Trump v. Slaughter* (29 Jun 2026), the EDPB asked the Commission on 31 Jul 2026 to reassess the adequacy decision.
- **TIA for Auth, Hosting, FCM, App Check and Places.** Places receives the place-search text and the device IP address directly from the app (no user ID); the search is for public places and the result is a public place. The data is minimised to uid, email, push token, attestation tokens, and the IP address and one-time code that Hosting sees for an email link. **Auth with Google sign-in:** Firebase Auth copies the Google display name and photo URL. `completeOnboarding` clears the top-level `displayName` and `photoURL` (Admin `updateUser`), but the `google.com` entry in `providerData` may keep them and is refreshed at every Google sign-in [verify in M0]. The TIA and the privacy notice therefore say that Auth may hold the Google name and profile-photo URL of Google users. Apple sign-in requests no name, and email-link accounts hold none. Custom claims hold one boolean.
- **Exit plan.** If the DPF falls, rely on the SCCs already in Google's terms and update the TIA. Longer term, evaluate EU-hosted auth; no cheap option has been identified yet.
- **[LAWYER]** Review the TIA.

---

## 10. Security measures (Art. 32)
- **Access control:**
  - deny-by-default rules;
  - no client writes; all writes go through validated callables;
  - owner-only paths for sensitive data;
  - vectors and matching data server-only (D§9).
- **Integrity:** App Check on callables, Firestore and Storage (1 h token TTL); replay protection (limited-use tokens, `alreadyConsumed` rejected) on reporting, export and deletion.
- **Abuse limits:** per-uid limits on `addInterests` (half for new accounts); one pending upload per uid; 30 chat messages per user per pod per hour; kill switches on budget alerts; Places API key restricted to the apps with per-day quota caps (D§9).
- **On-device model integrity:** every model file is checked against its pinned sha256 when the app is built (a mismatch fails the build), the signed app package protects it afterwards, and on Android the copy in app storage is checked again before it is loaded; the server accepts vectors only with the pinned `modelKey` (D§5.1).
- **Photos:** per-pair grants removed at every pod exit; no bearer URLs; `max-age` 1 h; device caches cleared on revocation events, sign-out and deletion; only the current version stored; EXIF and GPS stripped.
- **Identity:**
  - a least-privilege service account per codebase; no function runs as a default service account (deploy check);
  - no service-account keys; CI uses Workload Identity Federation;
  - two admins with hardware keys or passkeys;
  - audit logs for human access;
  - the admin CLI records a reason for each run.
- **Data:** Google's default encryption in transit and at rest; HMAC pseudonyms with keys in Secret Manager. Logs are **pseudonymised** (`uidH`), never anonymous; they carry no tag text, message text, request bodies, tokens or IP addresses. Cloud Run request logs are excluded from storage, and a scrubbing middleware keeps validation messages and input values out of error logs (D§13).
- **Resilience:** PITR plus daily backups (7 days); restore runbook that replays every erasure-ledger entry; staging restore drill.
- **Assurance:** rules tests in CI; erasure-, withdrawal- and self-flag-completeness tests; a log-scrubbing test; the detector calibration gate and the on-device golden test.
- **Organisation:** confidentiality agreements, a yearly access review, and the incident runbook (§14).

---

## 11. Age policy
- **18+ only,** because of in-person meetups with strangers [GDPR].
- **Consent age.** The Danish digital consent age is 15 (databeskyttelsesloven § 6(2), since 1 Jan 2024). It is irrelevant here, because minors' consent is never relied on [GDPR].
- **Age check.** Self-declared date of birth, checked on the server. Only `birthYear` is stored. CPR numbers are never collected.
- **Under-18 answer.** The server deletes the Firebase Auth user created at sign-in (email, provider UID and, for Google, name and photo URL) at once, and keeps only 30-day `underageMarkers` entries keyed on `HMAC(email)` (when the token has an email) and on `HMAC(provider, provider uid)` for each federated identity (Apple sign-in usually has no email), so that an immediate retry with the same email and an older date of birth gets the same answer (6(1)(f), child protection; disclosed in the notice). Someone using a different email is not stopped; the report category and store ratings remain the other controls.
- **Store ratings.** The highest available age rating (18+ where offered).
- **Underage reports.** "Suspected under 18" pauses the account automatically for 28 days; another such report from a different pod restarts the pause. With no human review (D2) nobody confirms age, so we do not delete accounts or keep a ban hash on a report; the user can always delete the account **[LAWYER]**.

---

## 12. ePrivacy and app store labels

### 12.1 Danish cookie order (BEK 1148/2011)
The order covers storing and reading information on the device in apps. Digitaliseringsstyrelsen supervises it; joint guidance with Datatilsynet came on 15 May 2025 [GDPR].

| Component | Device storage / access | Consent? |
|---|---|---|
| Auth (RNFirebase, Apple, Google) | Session and refresh tokens | No: strictly necessary |
| Firestore offline cache | Cached documents; cleared on sign-out and deletion | No |
| expo-image cache | Pod members' photos; cleared on revocation events, sign-out and deletion | No: strictly necessary |
| App Check | Attestation tokens and APIs | No (security of the requested service) **[LAWYER]** |
| FCM / Firebase Installations | Installation ID, push token, after the OS permission | No **[LAWYER]** |
| `expo-secure-store` | Pending sign-in email | No |
| On-device model files (about 210 MB, inside the app; on Android also copied once into app storage at first launch) | Model and tokenizer, shipped with the app | No: strictly necessary for the feature the user asked for **[LAWYER]** |
| Places session token | In memory during one place search | No |
| "Add to calendar" | The OS add-event sheet; the user decides to save; we store nothing | No (user-initiated) |
| Analytics, Crashlytics, ads | Not included | — |

**Result:** no consent banner. Any future analytics or crash SDK needs opt-in.

### 12.2 Apple App Privacy details
- **Declared, all linked to the user and used for App Functionality:**
  - Contact Info (email);
  - **Sensitive Info** (pregnancy, sexual orientation, religion, political opinion, union membership, ethnicity, disability) [GDPR];
  - **Health & Fitness → Health**, because Apple's Health type covers "any other user provided health or medical data" (https://developer.apple.com/app-store/app-privacy-details/) and health interests (diagnoses, recovery, IVF) are core to the product. This matches the Play declaration (§12.3);
  - User Content: Photos; Other User Content (meetup options, "about me"); Emails or Text Messages for the meetup chat [A, verify that Apple expects this type for in-app chat];
  - Search History is not declared: place searches go from the app to Google Places for the real-time answer only and are not collected by us [A, verify against Apple's definition of "collect" for partner SDKs/APIs];
  - Identifiers (User ID, Device ID);
  - Coarse Location;
  - Other Data (birth year, gender, first name).
- **Tracking:** none.
- **Also required:** a privacy manifest (`ios.privacyManifests`) and in-app deletion with token revocation [FBX][GDPR].

### 12.3 Google Play Data safety
- **Personal info:**
  - email;
  - user IDs;
  - name;
  - race and ethnicity;
  - political or religious beliefs;
  - sexual orientation;
  - other info (gender).
- **Health and fitness:** health info.
- **Location:** approximate.
- **Photos:** photos.
- **Messages:** other in-app messages (the meetup chat).
- **App activity:** other user-generated content (meetup options, "about me").
- **Device or other IDs:** yes.
- **Practices:** encrypted in transit, deletion available, nothing shared or sold.
- **Deletion outside the app:** Play also expects a web link for account deletion, so a static page on Firebase Hosting (`delete-account.html`, D§14) explains the in-app path and the email route [A, verify].

---

## 13. DSA notes
- **Classification.** Pods are closed groups of 4–6 pre-determined people with no public profiles, so Grouper is most likely a **hosting service**, not an online platform [GDPR]. Meetup-chat messages are hosted content shared only within such a closed group, so they do not change this [A]. Adding public features (open events or groups) requires re-assessment.
- **Applicable duties:**

  | Article | Duty |
  |---|---|
  | Arts. 11–12 | Points of contact |
  | Art. 14 | Terms that describe restrictions and automated moderation |
  | Art. 16 | Notice-and-action: the in-app Report flow (users, options, chat messages) plus a web form. A reported chat message is copied into the report. Notices are handled **by automated means only** (D2): pauses and holds by fixed rules, disclosed as automated (Art. 16(6)). Interests can no longer be reported, because acting on wording would need a reviewer |
  | Art. 17 | **Still automatic, unchanged by D2:** a statement of reasons for every rejected tag, "about me" or chat message, refused sensitive tag without consent, pause or suspension: the facts, that it was automated, the ground, its end date, and the support address. For input-time rejections the device renders it from the reason code and nothing is stored. The contact-info warning before a meetup is not a restriction: the writer can still send. Persisted notices hold a reason code and non-textual params only |
  | Art. 18 | Notifying the police of threats to life or safety once we become aware of them. With no one reading reports (D2), we may never become aware; safety reports show "call 112" in the app **[LAWYER]** |

- **Exemption.** As a micro or small enterprise, Grouper is exempt from Art. 15 reports [GDPR]. Art. 20 (internal complaint handling) applies to online platforms, not to hosting services.
- **What D2 (no human review) loses, stated honestly** (also on "How matching works"):
  - nobody reads reports, report text or the copied chat messages; reports only trigger fixed automatic rules;
  - no permanent sanctions: harassers, fake accounts and suspected minors are paused or held for a fixed time (28 days; no-shows 2 or 8 weeks) and the pause repeats only on new reports; a confirmed minor is never deleted by us, and no ban hash exists;
  - no appeals or "ask a human": a wrong pause simply runs out;
  - no-show accusations cannot be disputed and resolve by the majority of the other members' "Who was there?" answers only;
  - no review of flagged wording: over-flagged ordinary words rely on the user's own "This isn't sensitive for me" (consenting users only); missed sensitive words rely on prototype or threshold updates in a new app version, which reach only new adds (DESIGN F38);
  - no merge proposals: concepts merge only by thresholds and user alias votes;
  - no alerts to the privacy lead about infiltration patterns; the automatic holds replace them;
  - the founder's statutory duties remain (GDPR requests, breach handling, police requests, supervisory authorities): these are not review queues.
- **Coordinator.** Denmark's DSC is Digitaliseringsstyrelsen.
- **GDPR still applies in full** to moderation data (EDPB guidelines 3/2025) [GDPR].

---

## 14. Breach procedure
1. **Detect and triage (≤ 1 h).** Sources: alerts, processor notices (Google notifies "without undue delay" [GDPR]), user reports. Log every incident (Art. 33(5)).
2. **Contain.** Revoke credentials, disable affected functions, tighten rules, and preserve logs.
3. **Assess.** Data types, number of users, identifiability, consequences. Exposure of sensitive interests, or of location or photos linked to identity, is **presumed high risk**.
4. **Notify Datatilsynet within 72 h** through virk.dk (Art. 33), in phases if facts are still emerging [GDPR].
5. **Notify users without undue delay** when the risk is high (Art. 34). Use an in-app notice and a push to the affected users (there is no email, DESIGN F39), in Danish and English, covering what happened, the consequences, what we did and what they can do. A push reaches only users with notifications on and a token, and the notice only users who open the app. When individual communication would involve disproportionate effort or its reach is uncertain, use a public communication instead or as well (Art. 34(3)(c)), for example on the website and the app store pages. **[LAWYER]** Confirm that in-app notice plus push, with the public communication as the fallback, meets Art. 34 without email.
6. **Remediate.** Post-mortem within 14 days [A]; update the DPIA, tests and this document.

**[LAWYER]** Review the notification templates (`tools/admin/runbooks/` [A]).

---

## 15. Art. 30 records (skeleton)
The Art. 30(5) exemption for organisations under 250 employees does not apply, because Art. 9 data is processed and not only occasionally [GDPR]. Retention for every row is in §5, and security measures for every row in §10.

| # | Activity | Purpose | Subjects | Categories (Art. 9?) | Basis | Recipients | Transfers |
|---|---|---|---|---|---|---|---|
| 1 | Account / Auth, email-link sign-in | P1 | Users | Email, provider ID; for Google users, display name and photo URL in the provider record; Hosting request data | 6(1)(b) | Google | US (Auth), global (Hosting): DPF/SCC |
| 2 | Profile, age, area, gender | P2, P3, P7 | Users, under-18 applicants (30-day marker) | Birth year, cell, gender (precautionary) | 6(1)(b), 6(1)(a), 6(1)(f) | — | — |
| 3 | Ordinary interests | P4 | Users | Tags, vectors | 6(1)(b) | Pod members (shared concepts) | — |
| 4 | Sensitive interests (blanket consent) | P5, P6 | Users | **Yes** | 6(1)(a) + 9(2)(a) | Invitees and pod members (theme) | — |
| 5 | Matching / drops | P9, P11 | Users | Derived; **yes** for sensitive themes | 6(1)(b), 9(2)(a) | Pod members | — |
| 6 | Planner, attendance and feedback | P10, P23 | Users | Options with Google places, votes, attendance statuses, meet-again pair signals | 6(1)(b) | Pod members (not the pair signals) | — |
| 7 | Photos | P8 | Users | Image | 6(1)(a) | Confirmed pod members | — |
| 8 | Push | P15 | Users | Token, installation ID | 6(1)(b) | Google, Apple | Global |
| 9 | Reports, blocks, automated moderation, anti-infiltration holds | P12, P13 | Users, reported users | Reports, automated outcomes, sensitive-theme holds (**yes** where they concern sensitive holdings) | 6(1)(f), 6(1)(c); 9(2)(a) | Police if required | — |
| 10 | Security and logs | P16 | Users | Tokens, counters, pseudonymised logs (`uidH`; no IP addresses) | 6(1)(f) | Google | Global (App Check) |
| 11 | Consent and request records, erasure ledger | P17 | Users, former users | Consent events (pseudonymised after deletion), ledger entries | 6(1)(c) | — | — |
| 12 | Product improvement | P18, P19 | Users | Aggregates only | 6(1)(f) | — | — |
| 13 | ~~Service emails~~ (removed: no email, DESIGN F39) | P20 | — | — | — | — | — |
| 14 | Meetup chat | P21 | Users | Messages (**yes** in sensitive-themed pods) | 6(1)(b); 9(2)(a) | Current pod members | — |
| 15 | "About me" | P22 | Users | One sentence | 6(1)(b) | Confirmed co-members | — |
| 16 | Place search | P24 | Users | Search text, session token, IP address (sent by the app) | 6(1)(b) | Google (Places) | US/global: DPF/SCC |

---

## 16. Privacy notice outline
Layered (in-app summary + full text), in Danish and English:
1. Who we are and how to contact the privacy lead.
2. What we collect, why, the legal basis and for how long (§2, §5).
3. Sensitive interests: the one blanket explicit consent and that saying no keeps the app usable, the check on the phone, who sees them (invitees and members), "This isn't sensitive for me", anti-infiltration measures and their limits, withdrawal.
4. How matching works and "why this pod"; meet-again effects; sensitive-theme eligibility; every automated pause and its length; that no human reviews reports or decisions; pause.
5. Who sees what: nothing public; first name, "about me" and photo only after confirmation (photo opt-in in sensitive-themed pods); meetup-chat messages only to current pod members, deleted about 3 days after the meetup; no distances.
6. Where data lives (EU, including logs; Auth in the US, with the Google name and photo URL for Google users; FCM, App Check, Hosting and Places global) and the processor list.
7. Retention, including the backup, Auth, drop-snapshot, device-cache and TTL windows, the under-18 marker, and the pseudonymised records kept after deletion.
8. Rights, in-app buttons, one-month response.
9. Safety, moderation and how to contest.
10. Device storage (strictly necessary only).
11. Age (18+).
12. Complaints to Datatilsynet; version and changelog.

---

## 17. Lawyer review checklist
1. **Blanket Art. 9 consent** (D3): whether one consent at onboarding is freely given, specific and granular enough for sensitive interests the user adds later, given that refusing only blocks sensitive tags (§3.9); the wording EN/DA, the generic category list, the residual-risk paragraph, the anomaly-check bullet and the meetup-chat bullet (§3.3).
2. **The user downgrade** "This isn't sensitive for me": its legal effect on objectively Art. 9 text now that every flag is a model flag, and whether it may be offered without the consent (§3.9, D§2.4 Q23).
3. **On-device processing** (D1): whether the check on the user's phone before anything is sent is processing by us, and whether R5 can now be rated low (§3.8); the narrow server-side refusal for non-consenting users. **Model-only detection** (DESIGN F38): with no lexicon a model miss is the only residual path, and without the known-ordinary list about half of everyday hobby words are flagged (refused without the consent) (§4.3, R4).
4. Third-party sensitive data in tags: refusal by default, and whether reworded "parent of …" tags may rest on the user's consent (§4.3).
5. **No human review** (D2): DSA Art. 16 handled by automated means only, Art. 17 statements without a contest route, Art. 18 awareness when nobody reads reports, and the Art. 22 position now that no human intervention is offered (§4.4, §13, R20).
6. Retention of consent records (`scope: 'art9'` after withdrawal), of reports against deleted users (12 months), of the erasure ledger, and of never-again pair entries until erasure (§3.4, §5, §6).
7. Art. 15(4) and databeskyttelsesloven § 22 limits on exports: co-member names, meet-again answers, report text (§6).
8. Roles of the Apple and Google services; the TIA for Auth (Google name and photo URL), Hosting, FCM and **Google Places** (role under the Maps Platform terms; search text and IP address sent from the app) (§1, §9).
9. **Google Maps Platform content terms**: how long we may store place name, address and coordinates in options and in the pod plan (D§2.4 Q21).
10. The 14-day re-consent window (§3.7).
11. Anti-infiltration measures for sensitive-themed pods without review, and whether R15's residual risk requires prior consultation (§7.3).
12. Product-improvement processing and its balancing test (P19).
13. App Check, FCM and the on-device model files under the cookie order (§12.1).
14. Not designating a DPO, and the reassessment triggers (§8).
15. DSA classification as a hosting service (§13).
16. Breach templates and the privacy notice text; breach notices without email: in-app notice and push, with an Art. 34(3)(c) public communication as the fallback (§14, §16).
17. Gemma Terms for EmbeddingGemma v1, only if the v1 fallback is ever used (D§2.4 Q1; v2 is Apache-2.0) [SRV].
18. The meetup chat in sensitive-themed pods: whether the blanket consent and its chat bullet (§3.3) cover messages that reveal the theme or health details; Art. 9 details that members volunteer in ordinary pods' chat, in "about me", or about another member; keeping a reported message's copy for the report's retention; "3 days" in the consent bullet versus TTL lag (P21, P22, §4.2, §5, R17).
