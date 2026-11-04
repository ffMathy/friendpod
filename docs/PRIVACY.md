# Grouper: privacy and GDPR design

> **Not legal advice.** This is an engineering design meant to make the system compliant by construction. Items marked **[LAWYER]** need review by a Danish data protection lawyer before the private alpha (M1); the whole document should be read by that lawyer once.

| | |
|---|---|
| Status | Draft for founder and counsel review |
| Date | 2026-11-04 |
| Companion | [DESIGN.md](./DESIGN.md), cited below as "D§" |
| Supervisory authority | Datatilsynet (Denmark) |

Evidence tags are the same as in DESIGN.md:

| Tag | Source |
|---|---|
| [GDPR] | GDPR research report |
| [FBX] | Firebase / Expo report |
| [EXP] | First embedding experiment (v1) |
| [CAL] | v1 vs v2 re-calibration (`research/embedding-calibration/`) |
| [SRV] | Serving report |
| [MAT] | Matching report |
| [A] | Assumption |

---

## 1. Controller and roles

| Role | Party | Notes |
|---|---|---|
| Controller | Grouper, a Danish company (to be incorporated [A]) | Datatilsynet is the lead authority. **[LAWYER]** entity details |
| Privacy lead | A named founder or employee; not a formal DPO (§8) | Owns this document, the DPIA, the request inbox and breach handling |
| Processor | Google (Firebase / Google Cloud) | Firestore, Functions, Storage, Cloud Tasks, Scheduler, Secret Manager, Logging, Auth, Hosting, FCM, App Check (§9) |
| Processor | EU transactional email provider, to be chosen in M1 (D§2.4 Q17) [A] | Inactivity warnings and Art. 34 breach notices (§9) |
| Independent controllers | Apple (Sign in with Apple, App Attest); Google as identity provider and for Play Integrity | Their own account and attestation data [GDPR]. **[LAWYER]** |
| No role | Expo (EAS Build only), Hugging Face (build-time model download), GitHub | No end-user data: calibration sets in the repository are synthetic or founder-written (D§5.3). Expo push and EAS Update are not used [GDPR][FBX] |
| Recipients | Invitees and fellow pod members | Invitees see the theme in their own wording before confirmation (they hold it too). After confirmation, members see first names and photos; in sensitive-themed pods a photo only if its owner opts in (D§3.4, D§6.1 S6) |

---

## 2. Purposes and lawful bases

| # | Purpose | Data | Art. 6 / Art. 9 |
|---|---|---|---|
| P1 | Account and sign-in | Provider UID, email (may be an Apple relay address); for Google sign-in, the Google display name and photo URL that Firebase Auth copies (cleared from the top-level fields, possibly kept in the provider record, §9); Google's IP logs; Hosting request data for the email link | 6(1)(b) |
| P2 | 18+ eligibility, age-range matching | DOB (transient, on the device and in the request); `birthYear` stored; after an under-18 answer, 30-day markers keyed on `HMAC(email)` and on `HMAC(provider, provider uid)` (e.g. Apple's `sub`, because Apple sign-in usually carries no email) | 6(1)(b); marker 6(1)(f) (child protection) |
| P3 | Local matching | Postcode or coarse location, converted on the device to a geohash-5 cell (the server never receives the postcode); radius; launch area | 6(1)(b) |
| P4 | Ordinary interests | Tag text, normalized form, embedding, concept link | 6(1)(b) |
| P5 | **Sensitive interests** (detected or self-flagged) and pods themed on them | Tag text, embedding, concept link, consent record | 6(1)(a) + **9(2)(a)** |
| P6 | Pre-consent check of a typed tag (lexicon on the device; server classification in memory only) | Tag text, transient vector | 6(1)(b). **No Art. 9(2) exception identified yet** for the server-side step **[LAWYER]** (§3.8) |
| P7 | Same-gender pods | Gender, only if the option is on. Not used for metrics (D§6.6) | 6(1)(a), with Art. 9-level safeguards as a precaution [GDPR] |
| P8 | Photo for confirmed pod members | One image, EXIF removed | 6(1)(a) |
| P9 | Weekly matching, "why this pod" | P2–P7 data, languages, availability, pair history, reliability; sensitive-theme eligibility (D§6.1 S5) | 6(1)(b); 9(2)(a) for sensitive themes (§4.4) |
| P10 | Meetup planner and feedback | Options, votes, place text, attendance, private meet-again, rating | 6(1)(b) |
| P11 | No-show policy | Attendance counters | 6(1)(b) per the Terms; **[LAWYER]** 6(1)(f) as an alternative |
| P12 | Blocks | User-ID pairs | 6(1)(b) |
| P13 | Reports, moderation, sanctions, statements of reasons; anti-infiltration review of sensitive-themed pods (R15) | Report, decision, ban hash; sensitive-theme holds and anomaly reviews | 6(1)(f); 6(1)(c) (DSA Arts. 16–17); 9(2)(a) for the anomaly review of sensitive holdings (named in the consent) |
| P14 | Human review of flagged tag wording, without uid | Normalized text | 9(2)(a) (named in the consent) for sensitive tags; otherwise 6(1)(f) |
| P15 | Transactional push | FCM token, installation ID | 6(1)(b). No marketing pushes are planned |
| P16 | Security and abuse prevention | App Check tokens, rate-limit counters, an in-memory per-IP bucket (never stored or logged), pseudonymised logs (`uidH`, no IP addresses: Cloud Run request logs are excluded, §5) | 6(1)(f) (Recital 49) |
| P17 | Accountability records | Consent events, request records, erasure ledger | 6(1)(c) (Arts. 5(2), 7(1), 17) |
| P18 | Service metrics | Aggregate counters per drop and launch area; any cell under 10 suppressed; no gender | 6(1)(f) |
| P19 | Product improvement: weight tuning and classifier recalibration | `drops` aggregates, simulations, review-queue samples of tags reviewed as **not** sensitive (no uid, 12 months). Sensitive wording is never reused; per-user outcome data only after a DPIA update | 6(1)(f), with a documented balancing test before M4 |
| P20 | Service emails | Email address, message | 6(1)(b) (inactivity warning before deletion); 6(1)(c) (Art. 34 notices) |

A contract is not an Art. 9 exception (EDPB 05/2020 §99) [GDPR]. Every sensitive step therefore rests on explicit consent, except the pre-consent check (P6), whose position is open (§3.8).

---

## 3. Art. 9 explicit consent design

### 3.1 When and how consent is asked
A tag flagged by the layered detector (D§5.2), or self-flagged by the user, opens the consent sheet **before anything is stored**. The lexicon runs on the device too, so a clear Art. 9 tag opens the sheet before the text is sent. Self-flagging an existing interest ("Keep this private") also needs this consent; without it nothing changes.

Consent is **per tag**: it names the user's own wording, which makes it specific. The sheet lists every Art. 9 category, because the automatic category guess is only about 80% right [EXP]. The user may optionally pick one.

The design follows EDPB 05/2020 [GDPR]:
- an express statement through an unticked checkbox (§§93–96);
- a separate screen;
- "Add" stays disabled until the box is ticked;
- "Don't add" discards the tag with no other consequence, so consent is freely given.

Gender has its own consent (§3.6).

### 3.2 Standing notice at the interest field
- **EN:** "Tip: if an interest says something about your health, beliefs, sexuality, politics, ethnic origin or union membership, we'll ask for your explicit consent before saving it. Only add things about yourself."
- **DA:** "Tip: Hvis en interesse siger noget om dit helbred, din tro, din seksualitet, politik, etniske oprindelse eller fagforening, beder vi om dit udtrykkelige samtykke, før vi gemmer den. Tilføj kun noget om dig selv."

### 3.3 Consent sheet: draft copy

**English (`art9-tag-en-v1`)**

> **This interest may be sensitive**
>
> "{tag}" may reveal information about your health, religion or beliefs, sexual orientation or sex life, political opinions, ethnic origin or trade union membership. The law calls this special category data, so we need your explicit consent before we save it.
>
> If you agree, Grouper will:
> - save "{tag}" privately on your account. It is never shown on any profile.
> - use it in automated matching to propose pods of 4–6 people near you who added the same interest and also consented;
> - show it as the pod's theme only to the people invited to those pods, who all added it too. Some of them may decline. Once a pod is confirmed, its members see your first name. They see your photo only if you choose to show it in that pod;
> - let a Grouper team member see the wording of the interest, without your name, to check how it is classified;
> - check accounts for signs that someone is not genuine, for example an account that adds many unrelated sensitive interests.
>
> **Please note:** we cannot verify who people are. Someone could create an account and pretend to share this interest in order to find out who has it. We make that harder (new accounts wait, accounts are limited in how many such pods they join, and you can report "not a genuine member"), but we cannot rule it out. Only share in a pod what you are comfortable with.
>
> You can withdraw at any time: Interests → "{tag}" → Remove & withdraw. We then delete it and take you out of pods built around it. Your other interests are not affected.
>
> ☐ **I explicitly consent to Grouper processing "{tag}", which may reveal sensitive information about me, for the purposes above.**
>
> [Add interest] (disabled until ticked) [Don't add] · Read more about sensitive interests

**Danish (`art9-tag-da-v1`)**

> **Denne interesse kan være følsom**
>
> »{tag}« kan afsløre oplysninger om dit helbred, din religion eller overbevisning, din seksuelle orientering eller dit seksualliv, dine politiske holdninger, din etniske oprindelse eller dit fagforeningsmedlemskab. Det er særlige kategorier af personoplysninger, så vi skal have dit udtrykkelige samtykke, før vi gemmer den.
>
> Hvis du siger ja, vil Grouper:
> - gemme »{tag}« privat på din konto. Den vises aldrig på nogen profil.
> - bruge den til automatisk matchning, så vi kan foreslå pods med 4–6 personer i nærheden, som har tilføjet samme interesse og også har givet samtykke;
> - kun vise den som podens tema for de personer, der bliver inviteret til de pods, og som alle selv har tilføjet den. Nogle af dem siger måske nej. Når poden er bekræftet, ser medlemmerne dit fornavn. Dit billede ser de kun, hvis du selv vælger at vise det i den pod;
> - lade en medarbejder hos Grouper se ordlyden af interessen, uden dit navn, for at kontrollere, hvordan den er klassificeret;
> - holde øje med tegn på, at en konto ikke er ægte, fx en konto, der tilføjer mange forskellige følsomme interesser.
>
> **Vær opmærksom på:** Vi kan ikke kontrollere, hvem folk er. Nogen kan oprette en konto og lade som om, de deler interessen, for at finde ud af, hvem der har den. Vi gør det sværere (nye konti skal vente, en konto kan kun være med i et begrænset antal af den slags pods, og du kan anmelde »ikke et ægte medlem«), men vi kan ikke udelukke det. Del kun det i en pod, som du er tryg ved.
>
> Du kan til enhver tid trække dit samtykke tilbage: Interesser → »{tag}« → Fjern og træk samtykke tilbage. Så sletter vi interessen og tager dig ud af pods, der er bygget op om den. Dine andre interesser påvirkes ikke.
>
> ☐ **Jeg giver udtrykkeligt samtykke til, at Grouper behandler »{tag}«, som kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.**
>
> [Tilføj interesse] (inaktiv indtil afkrydset) [Tilføj ikke] · Læs mere om følsomme interesser

**[LAWYER]** to review:
- the wording, including the residual-risk paragraph (R15);
- whether per-tag consent is specific enough, or per-category scope would be better;
- listing all categories when the category is uncertain;
- whether the anomaly review (fourth bullet) belongs in this consent or rests on 6(1)(f) alone;
- the Danish copy, with a native speaker.

### 3.4 Recording consent
- **Versioned texts.** Templates live in `packages/core/src/legal/consent-texts.ts`. `textSha256` is the SHA-256 of the template with `{tag}` left unfilled, so it identifies the text, not the tag.
- **Server check.** The client sends `{textVersion, textSha256, checked: true}`; the server rejects unknown pairs.
- **Atomic write.** In the same transaction as the holding, a Function writes `consentEvents/{id}`: `{uid, scope: 'art9', interestId, category?, action: 'grant', textVersion, textSha256, locale, appVersion, method: 'checkbox+button', createdAt}`. The holding stores `consentEventId`.
- **Append-only except for minimisation.** Events are never edited, with two exceptions. On withdrawal, `interestId` and `category` are removed from every event for that tag. On account deletion, `uid` is replaced by `uidH`. Each redaction sets `redactedAt`, so the record shows that it was minimised and when. What remains (scope, action, text version and hash, locale, app version, method, timestamps) proves that consent was asked and given or withdrawn without revealing which interest or which category it concerned. **[LAWYER]** Even `scope: 'art9'` linked to a person reveals that they once held some sensitive interest; confirm that 3 years is proportionate.
- **Minimal.** No IP address and no device fingerprint (EDPB 05/2020 §106 [GDPR]).

### 3.5 Withdrawal (as easy as giving consent, Art. 7(3))
- **Where:**
  - "Remove & withdraw" on each sensitive interest;
  - "Withdraw all sensitive interests" on the same screen and in Settings → Privacy.
- **Confirmation copy:**
  - **EN:** "Remove ‘{tag}’ and withdraw consent? We'll delete it now and take you out of pods built around it. Other members will only see that a member left."
  - **DA:** "Fjern »{tag}« og træk samtykket tilbage? Vi sletter den nu og tager dig ud af pods, der er bygget op om den. De andre medlemmer ser kun, at et medlem er gået."
- **Effects, immediate** (`withdrawSensitive`, also run by `removeInterest` for a sensitive holding; Art. 7(3) and 17(1)(b) mean processing stops now, not at the next drop):
  1. Delete the holding.
  2. Decrement the tag's count (`refCount`, or `privateAssign.refCount` for a self-flagged holding). At 0, delete the tag text and vector and subtract the vector from its concept.
  3. **Pod cards:** delete every `users/{uid}/pods/*` card themed on that concept, in every state (invited, declined, active, archived).
  4. **Pods:** for every pod themed on that concept, archived ones included: remove the user from `memberUids`, `roster`, `podState.members` and `podState.memberList`; delete the user's options and votes, their own feedback, and other members' attendance and meet-again entries about them; remove the pod from photo grants in both directions. Active pods follow the normal below-minimum rules (D§4.6). Others see only "A member left".
  5. **Open invitations** on that theme are cancelled; the user is removed from this week's unreleased pods (release revalidation checks `consentRef`, D§10.3) and from the backfill pool for that theme.
  6. **Matching data:** remove the concept from `matchProfiles.themes` and `themeIds`.
  7. **Records:** append a `withdraw` event; strip `interestId` and `category` from earlier events for that tag (setting `redactedAt`); set `expiresAt` to +3 years. Write an `erasureLedger` entry (`consentWithdrawal`, `uidH`, `interestId`) so that a backup restore cannot bring the holding back (§5).
  8. **Device:** the app clears its image cache and the cached pod docs at the next open (D§9 Photos).
- **Test:** an emulator test asserts that after withdrawal no document references that uid together with the `interestId` or the concept.
- **No detriment:** other pods and interests are untouched.

### 3.6 Gender (same-gender pods)
- **Copy:**
  - **EN:** "To give you same-gender pods we need to know your gender. We use it only to form same-gender pods, never show it on any profile or use it for statistics, and delete it when you turn the setting off. Note: if you are placed in a same-gender pod, its members will know that everyone in it shares your gender and chose same-gender pods." ☐ "I consent to Grouper using my gender to form same-gender pods."
  - **DA:** "For at kunne give dig pods med samme køn skal vi kende dit køn. Vi bruger det kun til at danne pods med samme køn, viser det aldrig på nogen profil, bruger det ikke til statistik og sletter det, når du slår indstillingen fra. Bemærk: Hvis du kommer i en pod med samme køn, ved medlemmerne, at alle i poden har samme køn som dig og har valgt pods med samme køn." ☐ "Jeg giver samtykke til, at Grouper bruger mit køn til at danne pods med samme køn."
- **Options:** woman, man, non-binary. For non-binary users the sheet adds: "Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary." **DA:** »Pods med samme køn for ikke-binære personer kan være sjældne i dit område, og medlemmerne vil vide, at alle i poden er ikke-binære.« **[LAWYER]** native-speaker check. Wider options (e.g. "women and non-binary") are open question D§2.4 Q16.
- **No second purpose:** gender is not used in fairness metrics or any aggregate (D§6.6). Fairness is monitored for the same-gender option as a group.
- **Record:** a `consentEvents` entry with `scope: 'gender'`.
- **Withdrawal:** turning the option off deletes gender everywhere and writes an `erasureLedger` entry (`gender`).

### 3.7 Re-consent
- **Material text changes** (purposes, recipients, review) get a new version. Existing holders are asked again at their next app open. Until they agree, their holdings are `pendingConsent`: excluded from matching and from every new purpose, and deleted after 14 days without consent **[LAWYER]**.
- **Cosmetic changes** get a new version without re-asking.

### 3.8 Residual issue: the pre-consent check
To decide whether consent is needed, the typed text is classified before any consent exists. After C-252/21 *Meta*, an Art. 6 basis such as 6(1)(b) is not enough when processing reveals Art. 9 data, and **no Art. 9(2) exception has been identified** for this step. It is an open legal question, not a solved one [GDPR].

What the design does now:
- **On the device:** normalization, PII patterns and the high-precision Art. 9 lexicon run before anything is sent. A lexicon hit opens the consent sheet first, so the clearest Art. 9 text reaches the server only with consent (D§5.2 (0)).
- **On the server** (the detector, for everything else): EU region, memory only, processing only on the user's own "Add", after the standing notice. A `needsConsent` result writes nothing: no document, no LRU cache entry (vectors are discarded when the request ends) and no log line. Even the consent-prompt counters are uid-free aggregates (D§5.2 (5), enforced by tests).
- The only output is `needsConsent`.

Options for counsel **[LAWYER]**:
1. **On-device detector** (D§2.4 Q18): run the EmbeddingGemma 2 q4 detector on the phone, so possibly-Art. 9 text leaves the device only after consent or after the same model and thresholds found it non-sensitive (the server still re-classifies). Cost: about 175 MB of download (v2 q4) and a re-verification of thresholds on the mobile runtime. The M0 spike decides feasibility.
2. **Up-front consent** to "check my interests for sensitive content". This is only acceptable if refusing it does not block adding interests: a user who refuses must still be able to add every tag, each one through the per-tag consent sheet. Otherwise the consent would not be freely given.
3. **Keep the current design** with a documented position.

Until counsel decides, R5 is rated **medium** residual risk, not low (§7.3).

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
| Its embedding | Yes; embeddings can be partly inverted toward text [GDPR] | Server-only; never returned to clients |
| Centroid of a sensitive concept | Yes, when there are few members | Server-only; recomputed on removal (vector subtracted from `sum` at once) |
| Label of a sensitive concept | — | **None is derived.** Every member sees the theme in their own wording; no shared document carries a sensitive label (D§5.2 (8), D§6.7) |
| Concept link in `matchProfiles` | Yes (pseudonymous) | Server-only |
| Drop input and result snapshots; concept snapshot | Yes (pseudonymous concept links and vectors) | Server-only EU buckets; drop snapshots deleted after release (≤ 2 days), concept snapshots 14 days |
| Membership of a sensitive-themed pod | Yes | Visible only to invitees and co-members, who all hold the same consented interest; age span and shared interests are withheld from cards before confirmation |
| Erasure-ledger `consentWithdrawal` entry; `consentEvents` with `scope: 'art9'` | Possibly (shows that a person once held some sensitive interest) | `uidH` and HMAC'd `interestId` only; no wording, concept or category; 35 days and 3 years respectively |
| Review-queue wording | Possibly | No uid; access logged; deleted 30 days after the decision |
| Ordinary tags that together imply a sensitive trait | Possibly (inference) | Sensitive holdings never feed secondary scoring; a theme is always one concept every member holds |
| Gender | Precautionary yes | §3.6 |

### 4.3 Controls
- **Detection.** Layered: review decision > lexicon > self-flag > embedding detector. The detector is tuned for recall: 100% caught on the test set, with about 49% false flags, mostly ordinary Danish words [CAL]. A false positive costs one consent step; a miss is the real risk.
- **No cross-sensitivity merges.** Sensitive and ordinary tags never share a concept. That blocks errors like "brystkræft" joining "brætspil" [EXP].
- **Theme-only use (S1–S4, D§6.1):**
  - a sensitive holding is only ever a theme, and the rule is enforced per holding, so a self-flagged ordinary tag is covered;
  - every member must hold it with consent;
  - ≥ 12 eligible consenting holders within 25 km of the pod [A], measured locally, never over a whole launch area;
  - it never appears in pushes, aggregates, chips or labels.
- **Before confirmation.** Cards for sensitive themes omit the age span and the shared interests, because invitees who decline are not members (D§3.2).
- **Infiltration controls (S5–S7, R15).** Eligibility gate (account age, an attended meetup, no open reports), at most 1 active sensitive-themed pod and 3 sensitive proposals per 12 weeks, at most 3 sensitive adds per week, photo opt-in per pod, a "not a genuine member" report that holds the reported account, and anomaly review. The residual risk is stated in the consent text (§3.3).
- **Aggregates.** None for sensitive concepts. Ordinary chips appear only with ≥ 10 holders in the launch area, drop aggregates suppress cells under 10, and waitlist counts are bucketed [GDPR].
- **Third-party data** ("my son's diagnosis"). A tag that matches a third-party pattern **and** is sensitive or suspected is refused (`THIRD_PARTY_SENSITIVE`), with a hint to reword it about the user's own situation ("parent of an autistic child"). The user's own consent cannot be a 9(2)(a) basis for someone else's health data, and Russmedia expects a poster-is-subject check. An ordinary third-party tag gets a warning only. **[LAWYER]** Confirm the default, and whether a reworded tag ("parent of …"), which still indirectly concerns the child, may rest on the user's consent.
- **Copying.** Android screen capture can be blocked on sensitive-themed pod screens (`expo-screen-capture`) [A]. The Terms forbid sharing members' information.
- **Rescans.** Lexicon and prototype updates trigger a rescan. On a new suspected hit the tag **immediately** leaves its ordinary concept (vector subtracted; label, counts and chips recomputed; removed from `podInterests` and `secondary`). The holdings become `pendingConsent`: excluded from all processing except storage, shown to the holder at the next app open, and deleted after 14 days without consent. **[LAWYER]** The 14-day hold stores possibly-Art. 9 data without a 9(2) basis; approve it or shorten it.
- **Self-flagging.** Users can self-flag upward ("Keep this private", with consent) but cannot downgrade a system flag; only a human review can. **[LAWYER]** Does a user's "not sensitive" have legal effect?
- **Review downgrades.** A reviewer's "not sensitive" applies to **future adds only**. Existing holdings stay sensitive under their original consent unless the holder actively chooses "Treat as ordinary"; no answer means they stay sensitive. Data given under an Art. 9 consent therefore never starts feeding shared features without the holder's opt-in.

### 4.4 Profiling and Art. 22
- **Probably outside Art. 22(1).** Pod formation is solely automated profiling, but being proposed (or not) for a friend group is unlikely to have a "legal or similarly significant" effect [GDPR]. **[LAWYER]**
- **Safeguards anyway:**
  - the consent text names automated matching (Art. 22(2)(c) and (4));
  - **automated temporary pauses** (two reports in 30 days or one safety report, the no-show pause, the suspected-under-18 pause, the sensitive-theme hold after a "not a genuine member" report; D§3.7, D§4.4) each come with an immediate statement of reasons and human review on request;
  - **permanent sanctions** (suspensions, bans) are decided only by humans;
  - automated tag rejections carry a statement of reasons and a way to contest.
- **Transparency (Arts. 13(1)(c), 13(2)(f)).** "Why this pod" (D§6.7) and a "How matching works" page covering: inputs used and not used (photos, inferred traits, gender only for same-gender pods), the eligibility rules for sensitive themes, every automated pause, how to ask for human review, and pause at any time.

---

## 5. Data inventory and retention

| Data | Location | Retention | Mechanism |
|---|---|---|---|
| Auth record (uid, provider ID, email; for Google sign-in, the Google display name and photo URL in the `google.com` provider record, refreshed at each sign-in [verify in M0]) | Firebase Auth (US) | Until deletion. Google purges live and backup copies within 180 days; IP logs are kept a few weeks [FBX]. The top-level `displayName`/`photoURL` are cleared at onboarding | `auth.deleteUser` |
| Abandoned sign-ups (Auth user, no profile) | Firebase Auth | 7 days | `dailyMaintenance` reconciliation |
| Under-18 markers (`HMAC(email)` if present, plus `HMAC(provider, provider uid)` per federated identity) | `underageMarkers` | 30 days | TTL |
| Date of birth | Not stored | — | — |
| Postcode, coordinates | Not sent: converted on the device | — | — |
| Profile, preferences | `users`, `matchProfiles` | Until deletion. Inactive 12 months → warning (in-app, push, email), deleted 30 days later [GDPR] | `purgeUser`, `dailyMaintenance` |
| Gender | Same | Until opt-out or deletion | `updateProfile` |
| Ordinary interests | `users/{uid}/interests` | Until removed | Callable |
| Sensitive interests (including self-flagged) | `users/{uid}/sensitiveInterests` | Deleted immediately on withdrawal | Callable |
| Pending holdings (rescan hit or material consent change) | `users/{uid}/interests` (`pendingConsent`) | 14 days **[LAWYER]** | `dailyMaintenance` |
| Tag cache (text + vector, no uid) | `tags` | While at least 1 holder | Count-based GC |
| Concepts | `concepts` | While non-empty | GC |
| Unanswered or declined pod cards | `users/{uid}/pods` | Drop + 14 days [GDPR]; at once on withdrawal for that theme | TTL, `withdrawSensitive` |
| Dissolved pods | `podState`, `pods` | 30 days [MAT] | `dailyMaintenance` |
| Confirmed pods | `pods`, `podState` | Until archived by the state machine (D§4.6); deleted 90 days after archive [MAT] | `dailyMaintenance` (recursive) |
| Meetup options and votes | `pods/{id}/options` | Archive, re-plan, or meetup + 30 days, whichever is first | `dailyMaintenance` |
| Feedback | `podFeedback` | With the pod; only counters remain. Entries about an erased user are deleted at erasure | — |
| Drop input and result snapshots | GCS `grouper-<env>-drops` (EU) | Deleted after release; lifecycle 2 days | `releaseDrop`, lifecycle |
| Concept snapshots (int8 vectors) | GCS `grouper-<env>-snapshots` (EU) | 14 days | Lifecycle |
| Recalibration samples (tags reviewed as not sensitive; no uid) | GCS `grouper-<env>-snapshots` (EU) | 12 months | Lifecycle |
| Pair history (HMAC) | `matchProfiles.recentH` | 26 weeks [MAT] | Pruned at the weekly `lastDrop` write; profiles not written in a drop are pruned daily (`recentMinUntil`); erasure removes the erased user's `uidH` from every profile |
| No-show events | `matchProfiles.noShowEvents` | Last 8, at most 26 weeks | Pruned when written |
| Blocks | `blocks`, `users/{uid}/blocks` | While both accounts exist | Cascade |
| Reports | `reports` | Resolution + 12 months [GDPR]; unresolved reports at most 12 months from creation. Erased parties are replaced by `reporterH` / `targetH` | TTL |
| Sanctions | `sanctions/{uid}` | While the account exists | `purgeUser` |
| Ban record (`HMAC(email)`) | `bans` | 24 months [GDPR] | TTL |
| Consent events | `consentEvents` | While active, then 3 years, pseudonymised, without tag reference or category [GDPR] **[LAWYER]** | TTL |
| Notices and statements of reasons | `users/{uid}/notices` (reason codes and non-textual params only; input-time rejections are rendered on the device and not stored) | 12 months [A] | TTL |
| Review queue | `reviewQueue` | Decision + 30 days [A] | TTL |
| Photos | Storage `photos/` | Only the current version, until replaced or deleted (`deletePhoto`); raw uploads ≤ 1 day | Function + lifecycle |
| Exports | Storage `exports/` | Available 24 h; deleted within 48 h [GDPR] | `deleteExport` task + lifecycle + TTL |
| Push tokens | `pushTokens` | 60 days stale or deletion. Google drops installation IDs within 180 days [GDPR] | Function |
| Rate limits | `rateLimits` | 1 day | TTL |
| Erasure ledger (`uidH`, kind, HMAC'd reference) | `erasureLedger` | 35 days [A], longer than the backup windows | TTL |
| Drop aggregates (no per-user data; cells under 10 suppressed) | `drops` | 24 months [A] | — |
| Application logs (**pseudonymised**: `uidH`, no tag text, bodies, tokens or IP addresses) | Cloud Logging `_Default`, europe-west1 | 30 days [GDPR] | Bucket retention |
| Cloud Run request logs (IP address, user agent) | Not kept: excluded from the `_Default` sink (D§13) | — | Exclusion filter |
| Admin Activity / System Event audit logs (admin principals, resource names; no end-user data) | Cloud Logging `_Required` (global; location cannot be changed) | 400 days (Google default) | Google |
| Service emails | EU email provider (Q17) | Per the provider's DPA [A] | — |
| Device caches (images, Firestore offline cache) | The user's phone | Until the next app open after a revocation; cleared on sign-out and deletion | App |
| Backups | Firestore PITR + daily backups | 7 days each [GDPR][FBX] | Native; the restore replays every `erasureLedger` entry first |

**TTL mechanics** [FBX]:
- Each expiring collection group has one TTL field, `expiresAt`, declared in `firestore.indexes.json`.
- Deletes usually happen within 24 h of expiry but are not guaranteed, so the notice states each period with a 24–72 h margin.
- TTL does not delete subcollections. Pods and user subtrees are removed by `dailyMaintenance` / `purgeUser` with `recursiveDelete`.
- TTL deletes are billed as normal deletes.
- Storage lifecycle rules clear `uploads/` and `exports/` after 1 day; GCS lifecycle actions are asynchronous and can lag by up to about a day, so exports are also deleted by a task at +24 h. Soft delete is off on the user-content bucket, so deleted photos do not linger.

**Backups and erasure.** A PITR or daily-backup restore (up to 7 days back) would bring back data that was erased since then: withdrawn sensitive interests, removed interests, gender after an opt-out, photo references, unblocks. Every such event writes an `erasureLedger` entry, and the restore runbook replays all of them, using the same server code as the original action, before traffic resumes. A staging restore drill tests this before M1 exit and quarterly after that.

---

## 6. Data subject rights in the app

Responses within one month, extendable by two (Art. 12(3)) [GDPR]. Requests from outside the app go to privacy@… and are logged.

| Right | In-app path | Backend |
|---|---|---|
| Access, portability (Arts. 15, 20) | Settings → Privacy → Download my data (re-authentication required); live views | `exportData` → `buildExport` → owner-only JSON, available 24 h, deleted within 48 h |
| Rectification (Art. 16) | Edit profile, interests, preferences, area | `updateProfile`. DOB corrections go through support (18+ re-check) |
| Erasure (Art. 17) | Remove an interest; delete the photo; Delete account | `removeInterest`, `deletePhoto`, `deleteAccount` → `purgeUser` |
| Restriction (Art. 18) | Pause account: data kept, matching and notifications stop **immediately**, including a drop computed but not yet released | `setParticipation({mode: 'pause'})`; release revalidation (D§10.3) |
| Objection (Art. 21) | Form, for legitimate-interest processing | Privacy lead reviews |
| Withdraw consent (Art. 7(3)) | Per tag, all sensitive, gender toggle, delete photo, stop showing the photo in a sensitive-themed pod | §3.5–3.6; `deletePhoto`, `setPhotoSharing` |
| Human review (Art. 22(3)) | "Ask a human" on "How matching works" and on every statement of reasons | Review queue |
| Complaint | Link to datatilsynet.dk | — |

**Export contents.** The export contains:
- profile, preferences, `birthYear`, area (cell and launch area), and gender if set;
- all interests, including sensitive and pending ones, with how each was classified (lexicon hit, detector result and margin, category guess, review decision, self-flag), and the consent log;
- pods: IDs, dates, state, the theme in the user's own wording, the user's own status, the reason codes shown to them, and the number of members. **Co-members' names are not included.** They are other people's data, and in a sensitive-themed pod a name linked to the theme is that person's Art. 9 data (Arts. 15(4), 20(4)). The user sees them in the app while the pod exists;
- options and votes the user wrote, and feedback the user gave;
- **derived matching data:** the reliability score and the counters and dated no-show events behind it, `declinesInRow`, `ignoredInRow`, `waitingSinceWeek`, active pod counts, sensitive-theme eligibility and any hold, weekly drop outcomes with unmatched reason codes, and the number of pair-history entries (not who they are);
- blocks the user made (with the first name they saw) and reports the user filed;
- **reports about the user:** category, date, status and decision, with the reporter's identity and the report text withheld (Art. 15(4); databeskyttelsesloven § 22 for text that could identify the reporter **[LAWYER]**); sanctions and automated pauses with their statements of reasons;
- notices.

It never contains who reported the user, other members' private feedback (their meet-again votes and ratings), or other users' interests or names. **[LAWYER]** Confirm that withholding individual meet-again votes and the report text is justified, and document the restriction.

**Erasure sequence** (`deleteAccount`, then `purgeUser`; idempotent and retried) [GDPR][FBX]:
1. **Start.** Require recent re-authentication and a replay-protected App Check token. On iOS, the device first revokes the Sign in with Apple token with a fresh `authorizationCode` (RNFirebase `revokeToken`; Apple 5.1.1(v)). Set `status: deleting`: the user is excluded from matching, release revalidation drops them from unreleased pods, and release writes use `update()` with preconditions, so nothing recreates their subtree (D§10.3). Enqueue the purge. Call `auth.deleteUser`.
2. **Interests.** Sensitive holdings go through the full withdrawal (§3.5). Ordinary holdings decrement their counts, and tags and concepts are garbage-collected.
3. **Pods.**
   - The user leaves every pod. Active pods follow the below-minimum rules (D§4.6). The user is removed from `podState.members` and `memberList` of every pod, archived ones included.
   - Unscheduled options the user wrote are deleted; scheduled ones are reattributed to "former member".
   - The user's votes and feedback are deleted, together with other members' `attendance` **and `meetAgain`** entries about the user.
   - Pending invitations are cancelled, and the user leaves the backfill pool.
4. **Other links.** Deleted: photo grants (both directions), blocks, `blockedH` entries in other profiles, **the user's `uidH` in other profiles' `recentH`** (found by querying that map key), and push tokens.
5. **Reports and sanctions.** In reports the user filed, `reporterUid` becomes `reporterH`. Reports against the user keep `targetH` instead of `targetUid`, until resolution + 12 months, and unresolved reports for at most 12 months from creation, for safety **[LAWYER]**. `sanctions/{uid}` is deleted; a ban survives only as `bans/{HMAC(email)}` (24 months).
6. **Bulk delete.** `recursiveDelete(users/{uid})`; `matchProfiles/{uid}`; Storage `photos/`, `uploads/` and `exports/` for the uid.
7. **Records.** Consent events: `uid` → `uidH`, `interestId` and `category` stripped, `expiresAt` +3 years. An `erasureLedger` entry (`account`, 35 days) is written, which any backup restore replays first.
8. **Verify.** A test asserts that afterwards no document or object contains the uid **or its `uidH`**, except three documented pseudonymised records: `consentEvents` (`uidH`, 3 years), `erasureLedger` (`uidH`, 35 days) and retained `reports` (`reporterH`/`targetH`). Because we hold the HMAC key, these are pseudonymous personal data, not erased data. They are kept for accountability (6(1)(c)) and safety (6(1)(f)) and are listed in the privacy notice.

Residual windows disclosed in the notice: up to 7 days of Firestore backups and PITR (the ledger is replayed on any restore), up to 2 days for a drop snapshot taken before the deletion, up to 180 days for Google's Auth backups [FBX], and other members' device caches until they next open the app.

---

## 7. DPIA

### 7.1 Screening conclusion: a DPIA is mandatory
Grouper meets 5 of the 8 items on Datatilsynet's Art. 35(4) list [GDPR]:

| Item | Why it applies |
|---|---|
| #3 | Location data plus another WP248 criterion |
| #4 | New technology (embedding classification) plus another criterion |
| #5 | Automated decisions on access to a service |
| #7 | Special categories combined with profiling |
| #8 | A breach could affect physical safety (in-person meetups) |

It must be signed before M1, and reviewed with each feature that touches personal data, at least yearly.

### 7.2 Outline (Art. 35(7))
1. **Description:** data flows (D§7), the weekly drop (D§6), processors (§9) and the data inventory (§5).
2. **Necessity and proportionality:** the lawful bases (§2) and the minimisation choices:
   - birth year only;
   - a geohash-5 cell only, converted on the device;
   - no public profiles and no chat;
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
| R2 | A genuine pod member discloses another member's sensitive interest | M | H | Consent names invitees and members; all share the interest; first names only; photos opt-in in sensitive pods; Terms; Android screen-capture block | M (accepted via consent) |
| R3 | Inference from themes, aggregates, embeddings, labels | M | H | S1–S4 enforced per holding; no sensitive labels or aggregates; card details withheld before confirmation; k ≥ 10 for chips and drop aggregates; local density ≥ 12 | L |
| R4 | Detector misses a sensitive tag | M | H | Lexicon (also on the device) + recall-tuned detector + self-flag + rescans (immediate removal from ordinary concepts) + reports; CI recall gate | M |
| R5 | Pre-consent transient classification without an identified Art. 9(2) exception (§3.8) | H | M | Device-side lexicon; server memory only, EU, no persistence, no cache, no logs, user-initiated, notice; on-device detector under evaluation | **M, open until counsel decides [LAWYER]** |
| R6 | Physical harm or stalking | L | H | 18+; public-place rule; no distances; coarse cells; block removes the blocked member from shared pods; report with automated pauses; safety tips; police referral (DSA Art. 18) | M |
| R7 | Location triangulation | L | M | One coarse cell, converted on the device; area labels only | L |
| R8 | Minors | M | H | DOB check; Auth user deleted on an under-18 answer; 30-day retry marker; store ratings; report category; fast removal | M |
| R9 | Discriminatory outcomes | M | M | No protected traits in scoring; fairness alerts (D§6.6) without gender; human-decided permanent sanctions | L |
| R10 | US transfer (Auth); DPF invalidation | M | M | Minimal Auth data (Google name and photo URL cleared where possible, disclosed where not); SCC fallback; TIA; exit plan | M |
| R11 | Account takeover via the email inbox | L | H | Re-authentication (`auth_time` ≤ 5 min) and replay-protected App Check for deletion and export; little data exposed | M |
| R12 | Third-party sensitive data in tags | M | M | Refused when sensitive or suspected, with a rewording hint; warning for ordinary tags; reports | L **[LAWYER]** |
| R13 | Incomplete erasure or over-retention, including restores from backup | L | M | TTL; jobs; erasure ledger for every erasure-relevant event, replayed on restore; staging restore drill; "no uid or uidH remains" test with documented exceptions; release revalidation | L |
| R14 | Function creep (e.g. ads on sensitive data) | L | H | Purpose-limited consent; no ad/analytics SDKs; P19 limited to non-sensitive data; DPIA gate | L |
| R15 | **Deliberate infiltration of sensitive-themed pods** (fake or multiple accounts claim a sensitive interest to learn who holds it locally, for outing or targeting) | M | H | Eligibility gate: account ≥ 14 days, ≥ 1 attended meetup, no open reports (D§6.1 S5); ≤ 1 active sensitive pod, ≤ 3 sensitive proposals per 12 weeks, ≤ 3 sensitive adds per week; photos opt-in per pod (S6); no age span or shared interests before confirmation; "not a genuine member" report with an immediate hold (S7); anomaly review for accounts with many unrelated sensitive interests; sign-up velocity alerts per area; 1 h App Check TTL and per-uid limits. Per-device limits are not available from App Check (Play Integrity device recall evaluated in M2). Residual risk stated in the consent text | M **[LAWYER]**; prior consultation (Art. 36) if counsel rates it high |
| R16 | Revoked data lingers on devices (photos, cached pod docs, sensitive interests) | M | L | `max-age` 1 h; image and Firestore caches cleared at the next app open after a revocation and on sign-out or deletion; disclosed window | L |

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
| Transactional email provider (D§2.4 Q17) | Processor | EU [A] | DPA required before M1; used only for inactivity warnings and Art. 34 notices (email address, message). Until chosen, these go in-app and by push only, which cannot reach users who no longer open the app |
| Mailbox for privacy@… | Processor (the mail host) | EU [A] | DPA; DSAR correspondence |
| Sign in with Apple, App Attest, APNs | Independent controller [GDPR] **[LAWYER]** | US / global | Apple terms; disclosed |
| Google Sign-In, Play Integrity | Independent controller [GDPR] **[LAWYER]** | Global | Google terms; disclosed |
| Expo (EAS Build) | None | — | Expo push and EAS Update not used [GDPR] |
| Hugging Face | None. Weights are copied at build time to our EU bucket; no user data is sent | — | Apache-2.0 model licence (EmbeddingGemma 2); Gemma Terms only if the v1 fallback is used [CAL][SRV] |
| Cloud Natural Language `moderateText`, if adopted | Processor | To verify | Only for queued non-sensitive items; decide in M2 [MAT] |

**Transfers** [GDPR]:
- **DPF.** In force. The General Court dismissed *Latombe* (T-553/23) on 3 Sep 2025, and the appeal C-703/25 P is pending. After *Trump v. Slaughter* (29 Jun 2026), the EDPB asked the Commission on 31 Jul 2026 to reassess the adequacy decision.
- **TIA for Auth, Hosting, FCM and App Check.** The data is minimised to uid, email, push token, attestation tokens, and the IP address and one-time code that Hosting sees for an email link. **Auth with Google sign-in:** Firebase Auth copies the Google display name and photo URL. `completeOnboarding` clears the top-level `displayName` and `photoURL` (Admin `updateUser`), but the `google.com` entry in `providerData` may keep them and is refreshed at every Google sign-in [verify in M0]. The TIA and the privacy notice therefore say that Auth may hold the Google name and profile-photo URL of Google users. Apple sign-in requests no name, and email-link accounts hold none. Custom claims hold one boolean.
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
- **Abuse limits:** per-uid, per-IP (in memory) and global embedder limits; one pending upload per uid; kill switches on budget alerts (D§9).
- **Photos:** per-pair grants removed at every pod exit; no bearer URLs; `max-age` 1 h; device caches cleared on revocation events, sign-out and deletion; only the current version stored; EXIF and GPS stripped.
- **Identity:**
  - a least-privilege service account per codebase; no function runs as a default service account (deploy check);
  - no service-account keys; CI uses Workload Identity Federation;
  - two admins with hardware keys or passkeys;
  - audit logs for human access;
  - the admin CLI records a reason for each run.
- **Data:** Google's default encryption in transit and at rest; HMAC pseudonyms with keys in Secret Manager. Logs are **pseudonymised** (`uidH`), never anonymous; they carry no tag text, request bodies, tokens or IP addresses. Cloud Run request logs are excluded from storage, and a scrubbing middleware keeps validation messages and input values out of error logs (D§13).
- **Resilience:** PITR plus daily backups (7 days); restore runbook that replays every erasure-ledger entry; staging restore drill.
- **Assurance:** rules tests in CI; erasure-, withdrawal- and self-flag-completeness tests; a log-scrubbing test; the detector calibration gate.
- **Organisation:** confidentiality agreements, a yearly access review, and the incident runbook (§14).

---

## 11. Age policy
- **18+ only,** because of in-person meetups with strangers [GDPR].
- **Consent age.** The Danish digital consent age is 15 (databeskyttelsesloven § 6(2), since 1 Jan 2024). It is irrelevant here, because minors' consent is never relied on [GDPR].
- **Age check.** Self-declared date of birth, checked on the server. Only `birthYear` is stored. CPR numbers are never collected.
- **Under-18 answer.** The server deletes the Firebase Auth user created at sign-in (email, provider UID and, for Google, name and photo URL) at once, and keeps only 30-day `underageMarkers` entries keyed on `HMAC(email)` (when the token has an email) and on `HMAC(provider, provider uid)` for each federated identity (Apple sign-in usually has no email), so that an immediate retry with the same email and an older date of birth gets the same answer (6(1)(f), child protection; disclosed in the notice). Someone using a different email is not stopped; the report category and store ratings remain the other controls.
- **Store ratings.** The highest available age rating (18+ where offered).
- **Underage reports.** "Suspected under 18" pauses the account until it is resolved. Confirmed minors are deleted, with a 24-month hashed ban.

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
| Analytics, Crashlytics, ads | Not included | — |

**Result:** no consent banner. Any future analytics or crash SDK needs opt-in.

### 12.2 Apple App Privacy details
- **Declared, all linked to the user and used for App Functionality:**
  - Contact Info (email);
  - **Sensitive Info** (pregnancy, sexual orientation, religion, political opinion, union membership, ethnicity, disability) [GDPR];
  - **Health & Fitness → Health**, because Apple's Health type covers "any other user provided health or medical data" (https://developer.apple.com/app-store/app-privacy-details/) and health interests (diagnoses, recovery, IVF) are core to the product. This matches the Play declaration (§12.3);
  - User Content (photos, meetup text);
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
- **App activity:** other user-generated content.
- **Device or other IDs:** yes.
- **Practices:** encrypted in transit, deletion available, nothing shared or sold.
- **Deletion outside the app:** Play also expects a web link for account deletion, so a static page on Firebase Hosting (`delete-account.html`, D§14) explains the in-app path and the email route [A, verify].

---

## 13. DSA notes
- **Classification.** Pods are closed groups of 4–6 pre-determined people with no public profiles, so Grouper is most likely a **hosting service**, not an online platform [GDPR]. Adding public features (open events or groups) requires re-assessment.
- **Applicable duties:**

  | Article | Duty |
  |---|---|
  | Arts. 11–12 | Points of contact |
  | Art. 14 | Terms that describe restrictions and automated moderation |
  | Art. 16 | Notice-and-action: the in-app Report flow plus a web form, for tags, meetup text and photos |
  | Art. 17 | A statement of reasons for every rejected tag, removed option, pause, suspension or ban: the facts, whether it was automated, the ground, and how to contest. For tags rejected at input time, the device renders it from the reason code and nothing is stored (the tag text is never persisted). Persisted notices hold a reason code and non-textual params only. No tags are held in MVP (D§5.2 (2)) |
  | Art. 18 | Notifying the police of threats to life or safety |

- **Exemption.** As a micro or small enterprise, Grouper is exempt from Art. 15 reports [GDPR].
- **Coordinator.** Denmark's DSC is Digitaliseringsstyrelsen.
- **GDPR still applies in full** to moderation data (EDPB guidelines 3/2025) [GDPR].

---

## 14. Breach procedure
1. **Detect and triage (≤ 1 h).** Sources: alerts, processor notices (Google notifies "without undue delay" [GDPR]), user reports. Log every incident (Art. 33(5)).
2. **Contain.** Revoke credentials, disable affected functions, tighten rules, and preserve logs.
3. **Assess.** Data types, number of users, identifiability, consequences. Exposure of sensitive interests, or of location or photos linked to identity, is **presumed high risk**.
4. **Notify Datatilsynet within 72 h** through virk.dk (Art. 33), in phases if facts are still emerging [GDPR].
5. **Notify users without undue delay** when the risk is high (Art. 34). Use an in-app notice, push and email (through the EU email provider, §9), in Danish and English, covering what happened, the consequences, what we did and what they can do.
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
| 4 | Sensitive interests | P5, P14 | Users | **Yes** | 6(1)(a) + 9(2)(a) | Invitees and pod members (theme); reviewer without uid | — |
| 5 | Matching / drops | P9, P11 | Users | Derived; **yes** for sensitive themes | 6(1)(b), 9(2)(a) | Pod members | — |
| 6 | Planner and feedback | P10 | Users | Options, votes, attendance | 6(1)(b) | Pod members | — |
| 7 | Photos | P8 | Users | Image | 6(1)(a) | Confirmed pod members | — |
| 8 | Push | P15 | Users | Token, installation ID | 6(1)(b) | Google, Apple | Global |
| 9 | Reports, blocks, moderation, anti-infiltration review | P12, P13 | Users, reported users | Reports, decisions, sensitive-theme holds (**yes** where they concern sensitive holdings) | 6(1)(f), 6(1)(c); 9(2)(a) | Police if required | — |
| 10 | Security and logs | P16 | Users | Tokens, counters, pseudonymised logs (`uidH`; no IP addresses) | 6(1)(f) | Google | Global (App Check) |
| 11 | Consent and request records, erasure ledger | P17 | Users, former users | Consent events (pseudonymised after deletion), ledger entries | 6(1)(c) | — | — |
| 12 | Product improvement | P18, P19 | Users | Aggregates; samples of non-sensitive tag wording without uid | 6(1)(f) | — | — |
| 13 | Service emails | P20 | Users | Email address, message | 6(1)(b), 6(1)(c) | EU email provider | — |

---

## 16. Privacy notice outline
Layered (in-app summary + full text), in Danish and English:
1. Who we are and how to contact the privacy lead.
2. What we collect, why, the legal basis and for how long (§2, §5).
3. Sensitive interests: explicit consent, who sees them (invitees and members), wording review, anti-infiltration measures and their limits, withdrawal.
4. How matching works and "why this pod"; sensitive-theme eligibility; every automated pause; human review; pause.
5. Who sees what: nothing public; first name and photo only after confirmation (photo opt-in in sensitive-themed pods); no distances.
6. Where data lives (EU, including logs; Auth in the US, with the Google name and photo URL for Google users; FCM, App Check and Hosting global) and the processor list.
7. Retention, including the backup, Auth, drop-snapshot, device-cache and TTL windows, the under-18 marker, and the pseudonymised records kept after deletion.
8. Rights, in-app buttons, one-month response.
9. Safety, moderation and how to contest.
10. Device storage (strictly necessary only).
11. Age (18+).
12. Complaints to Datatilsynet; version and changelog.

---

## 17. Lawyer review checklist
1. Consent wording (EN/DA), per-tag granularity, generic category list, the residual-risk paragraph and the anomaly-review bullet (§3.3).
2. The pre-consent check: which Art. 9(2) exception, if any; on-device detector, up-front consent (only if refusal does not block adding interests) or the current design (§3.8, R5).
3. Effect of a user's "not sensitive"; review downgrades applied to future adds only (§4.3).
4. Third-party sensitive data in tags: refusal by default, and whether reworded "parent of …" tags may rest on the user's consent (§4.3).
5. Art. 22 position and the automated temporary pauses (§4.4); the basis for no-show processing (P11).
6. Retention of consent records (including `scope: 'art9'` after withdrawal), of reports against deleted users, and of the erasure ledger (§3.4, §5, §6).
7. Art. 15(4) and databeskyttelsesloven § 22 limits on exports: co-member names, meet-again votes, report text (§6).
8. Roles of the Apple and Google services; the TIA for Auth (Google name and photo URL), Hosting and FCM (§1, §9).
9. The 14-day hold of `pendingConsent` holdings after a rescan or a material consent change (§3.7, §4.3).
10. Anti-infiltration measures for sensitive-themed pods and whether R15's residual risk requires prior consultation (§7.3).
11. Product-improvement processing and its balancing test (P19).
12. App Check and FCM under the cookie order (§12.1).
13. Not designating a DPO, and the reassessment triggers (§8).
14. DSA classification as a hosting service (§13).
15. Breach templates and the privacy notice text (§14, §16).
16. Gemma Terms for backend-only use of EmbeddingGemma v1, only if the v1 fallback is ever used (D§2.4 Q1; v2 is Apache-2.0) [SRV].
