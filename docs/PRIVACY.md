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
| [EXP] | Embedding experiment |
| [SRV] | Serving report |
| [MAT] | Matching report |
| [A] | Assumption |

---

## 1. Controller and roles

| Role | Party | Notes |
|---|---|---|
| Controller | Grouper, a Danish company (to be incorporated [A]) | Datatilsynet is the lead authority. **[LAWYER]** entity details |
| Privacy lead | A named founder or employee; not a formal DPO (§8) | Owns this document, the DPIA, the request inbox and breach handling |
| Processor | Google (Firebase / Google Cloud) | Firestore, Functions, Storage, Cloud Tasks, Scheduler, Secret Manager, Logging, Auth, FCM, App Check (§9) |
| Independent controllers | Apple (Sign in with Apple, App Attest); Google as identity provider and for Play Integrity | Their own account and attestation data [GDPR]. **[LAWYER]** |
| No role | Expo (EAS Build only), Hugging Face (build-time model download), GitHub | No end-user data. Expo push and EAS Update are not used [GDPR][FBX] |
| Recipients | Fellow pod members | First name, photo and theme, only after confirmation (D§3.4) |

---

## 2. Purposes and lawful bases

| # | Purpose | Data | Art. 6 / Art. 9 |
|---|---|---|---|
| P1 | Account and sign-in | Provider UID, email (may be an Apple relay address); Google's IP logs | 6(1)(b) |
| P2 | 18+ eligibility, age-range matching | DOB (transient); `birthYear` stored | 6(1)(b) |
| P3 | Local matching | Postcode or coarse location → geohash-5 cell; radius | 6(1)(b) |
| P4 | Ordinary interests | Tag text, normalized form, embedding, concept link | 6(1)(b) |
| P5 | **Sensitive interests** and pods themed on them | Tag text, embedding, concept link, consent record | 6(1)(a) + **9(2)(a)** |
| P6 | Pre-consent check of a typed tag (in memory only) | Tag text, transient vector | 6(1)(b); Art. 9 position **[LAWYER]** (§3.8) |
| P7 | Same-gender pods | Gender, only if the option is on | 6(1)(a), with Art. 9-level safeguards as a precaution [GDPR] |
| P8 | Photo for confirmed pod members | One image, EXIF removed | 6(1)(a) |
| P9 | Weekly matching, "why this pod" | P2–P7 data, languages, availability, pair history, reliability | 6(1)(b); 9(2)(a) for sensitive themes (§4.4) |
| P10 | Meetup planner and feedback | Options, votes, place text, attendance, private meet-again, rating | 6(1)(b) |
| P11 | No-show policy | Attendance counters | 6(1)(b) per the Terms; **[LAWYER]** 6(1)(f) as an alternative |
| P12 | Blocks | User-ID pairs | 6(1)(b) |
| P13 | Reports, moderation, sanctions, statements of reasons | Report, decision, ban hash | 6(1)(f); 6(1)(c) (DSA Arts. 16–17) |
| P14 | Human review of flagged tag wording, without uid | Normalized text | 9(2)(a) (named in the consent) for sensitive tags; otherwise 6(1)(f) |
| P15 | Transactional push | FCM token, installation ID | 6(1)(b). No marketing pushes are planned |
| P16 | Security and abuse prevention | App Check tokens, rate-limit counters, PII-free logs | 6(1)(f) (Recital 49) |
| P17 | Accountability records | Consent events, request records, deletion ledger | 6(1)(c) (Arts. 5(2), 7(1)) |
| P18 | Service metrics | Aggregate counters per drop and region | 6(1)(f) |

A contract is not an Art. 9 exception (EDPB 05/2020 §99) [GDPR]. Every sensitive step therefore rests on explicit consent.

---

## 3. Art. 9 explicit consent design

### 3.1 When and how consent is asked
A tag flagged by the layered detector (D§5.2), or self-flagged by the user, opens the consent sheet **before anything is stored**.

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
> - show it as the pod's theme only to the members of those pods, who also see your first name and photo once the pod is confirmed;
> - let a Grouper team member see the wording of the interest, without your name, to check how it is classified.
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
> - kun vise den som podens tema for medlemmerne af de pods, og de ser også dit fornavn og dit billede, når poden er bekræftet;
> - lade en medarbejder hos Grouper se ordlyden af interessen, uden dit navn, for at kontrollere, hvordan den er klassificeret.
>
> Du kan til enhver tid trække dit samtykke tilbage: Interesser → »{tag}« → Fjern og træk samtykke tilbage. Så sletter vi interessen og tager dig ud af pods, der er bygget op om den. Dine andre interesser påvirkes ikke.
>
> ☐ **Jeg giver udtrykkeligt samtykke til, at Grouper behandler »{tag}«, som kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.**
>
> [Tilføj interesse] (inaktiv indtil afkrydset) [Tilføj ikke] · Læs mere om følsomme interesser

**[LAWYER]** to review:
- the wording;
- whether per-tag consent is specific enough, or per-category scope would be better;
- listing all categories when the category is uncertain;
- the Danish copy, with a native speaker.

### 3.4 Recording consent
- **Versioned texts.** Templates live in `packages/core/src/legal/consent-texts.ts`. `textSha256` is the SHA-256 of the template with `{tag}` left unfilled, so it identifies the text, not the tag.
- **Server check.** The client sends `{textVersion, textSha256, checked: true}`; the server rejects unknown pairs.
- **Atomic write.** In the same batch as the holding, a Function writes an append-only `consentEvents/{id}`: `{uid, scope: 'art9', interestId, category?, action: 'grant', textVersion, textSha256, locale, appVersion, method: 'checkbox+button', createdAt}`. The holding stores `consentEventId`.
- **Minimal.** No IP address and no device fingerprint (EDPB 05/2020 §106 [GDPR]).

### 3.5 Withdrawal (as easy as giving consent, Art. 7(3))
- **Where:**
  - "Remove & withdraw" on each sensitive interest;
  - "Withdraw all sensitive interests" on the same screen and in Settings → Privacy.
- **Confirmation copy:**
  - **EN:** "Remove ‘{tag}’ and withdraw consent? We'll delete it now and take you out of pods built around it. Other members will only see that a member left."
  - **DA:** "Fjern »{tag}« og træk samtykket tilbage? Vi sletter den nu og tager dig ud af pods, der er bygget op om den. De andre medlemmer ser kun, at et medlem er gået."
- **Effects, immediate:**
  1. Delete the holding.
  2. Decrement the tag's `refCount`. At 0, delete the tag text and vector and subtract the vector from its concept.
  3. Leave every pod themed on that concept.
  4. Exclude the concept from the next drop.
  5. Append a `withdraw` event, strip `interestId` from earlier events for that tag, and set `expiresAt` to +3 years.
- **No detriment:** other pods and interests are untouched.

### 3.6 Gender (same-gender pods)
- **Copy:**
  - **EN:** "To give you same-gender pods we need to know your gender. We use it only for this setting, never show it to anyone, and delete it when you turn the setting off." ☐ "I consent to Grouper using my gender to form same-gender pods."
  - **DA:** "For at kunne give dig pods med samme køn skal vi kende dit køn. Vi bruger det kun til denne indstilling, viser det aldrig til nogen og sletter det, når du slår indstillingen fra." ☐ "Jeg giver samtykke til, at Grouper bruger mit køn til at danne pods med samme køn."
- **Options:** woman, man, non-binary.
- **Record:** a `consentEvents` entry with `scope: 'gender'`.
- **Withdrawal:** turning the option off deletes gender everywhere.

### 3.7 Re-consent
- **Material text changes** (purposes, recipients, review) get a new version. Existing holders are asked again at their next app open. Holdings without valid consent are quarantined (excluded from matching), then deleted after 30 days.
- **Cosmetic changes** get a new version without re-asking.

### 3.8 Residual issue: the pre-consent check
To decide whether consent is needed, the typed text is classified in memory before any consent exists. That is transient processing of possibly-Art. 9 data, with no direct guidance [GDPR].

Mitigations:
- the standing notice;
- processing only on the user's own "Add";
- EU region, memory only;
- nothing persisted or logged (enforced by tests);
- the only output is `needsConsent`.

Alternative: a one-time explicit consent to "check my interests for sensitive content" when the interests editor first opens. **[LAWYER]** Choose between the two.

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
| Sensitive tag text (holding, cache doc) | Yes | Owner-only or server-only path; deleted at withdrawal or when `refCount` reaches 0 |
| Its embedding | Yes; embeddings can be partly inverted toward text [GDPR] | Server-only; never returned to clients |
| Centroid and label of a sensitive concept | Yes, when there are few members | Server-only; recomputed on removal; never shown outside its pods |
| Concept link in `matchProfiles` | Yes (pseudonymous) | Server-only |
| Membership of a sensitive-themed pod | Yes | Visible only to co-members, who all hold the same consented interest |
| Review-queue wording | Possibly | No uid; access logged; deleted 30 days after the decision |
| Ordinary tags that together imply a sensitive trait | Possibly (inference) | Sensitive concepts never feed secondary scoring; a theme is always one concept every member holds |
| Gender | Precautionary yes | §3.6 |

### 4.3 Controls
- **Detection.** Layered: review decision > lexicon > self-flag > embedding detector. The detector is tuned for recall: 100% caught on the test set, with about 40% false flags [EXP]. A false positive costs one consent step; a miss is the real risk.
- **No cross-sensitivity merges.** Sensitive and ordinary tags never share a concept. That blocks errors like "brystkræft" joining "brætspil" [EXP].
- **Theme-only use (S1–S4, D§6.1):**
  - a sensitive concept is only ever a theme;
  - every member must hold it with consent;
  - the region needs ≥ 12 consenting holders [A];
  - it never appears in pushes, aggregates or chips.
- **Aggregates.** None for sensitive concepts. Ordinary chips appear only with ≥ 10 holders, and waitlist counts are bucketed [GDPR].
- **Third-party data** ("my son's diagnosis"). The user gets a warning, and if they keep the tag it is treated as sensitive. **[LAWYER]** Should these be refused outright (Russmedia's poster-is-subject check)?
- **Copying.** Android screen capture can be blocked on sensitive-themed pod screens (`expo-screen-capture`) [A]. The Terms forbid sharing members' information.
- **Rescans.** Lexicon and prototype updates trigger a rescan. Newly flagged holdings are quarantined until consent and deleted after 30 days.
- **Self-flagging.** Users can self-flag upward ("Keep private") but cannot downgrade a system flag; only a human review can. **[LAWYER]** Does a user's "not sensitive" have legal effect?

### 4.4 Profiling and Art. 22
- **Probably outside Art. 22(1).** Pod formation is solely automated profiling, but being proposed (or not) for a friend group is unlikely to have a "legal or similarly significant" effect [GDPR]. **[LAWYER]**
- **Safeguards anyway:**
  - the consent text names automated matching (Art. 22(2)(c) and (4));
  - suspensions and bans are always decided by a human;
  - automated tag rejections carry a statement of reasons and a way to contest.
- **Transparency (Arts. 13(1)(c), 13(2)(f)).** "Why this pod" (D§6.7) and a "How matching works" page covering: inputs used and not used (photos, inferred traits), how to ask for human review, and pause at any time.

---

## 5. Data inventory and retention

| Data | Location | Retention | Mechanism |
|---|---|---|---|
| Auth record (uid, provider ID, email) | Firebase Auth (US) | Until deletion. Google purges live and backup copies within 180 days; IP logs are kept a few weeks [FBX] | `auth.deleteUser` |
| Date of birth | Not stored | — | — |
| Profile, preferences | `users`, `matchProfiles` | Until deletion. Inactive 12 months → warning, deleted 30 days later [GDPR] | `purgeUser`, `dailyMaintenance` |
| Gender | Same | Until opt-out or deletion | `updateProfile` |
| Ordinary interests | `users/{uid}/interests` | Until removed | Callable |
| Sensitive interests | `users/{uid}/sensitiveInterests` | Deleted immediately on withdrawal | Callable |
| Quarantined holdings | As above | 30 days | `dailyMaintenance` |
| Tag cache (text + vector, no uid) | `tags` | While at least 1 holder | `refCount` GC |
| Concepts | `concepts` | While non-empty | GC |
| Unanswered or declined pod cards | `users/{uid}/pods` | Drop + 14 days [GDPR] | TTL |
| Dissolved pods | `podState` | 30 days [MAT] | `dailyMaintenance` |
| Confirmed pods | `pods`, `podState` | Archive after 30 idle days; delete 90 days after archive [MAT] | `dailyMaintenance` (recursive) |
| Meetup options and votes | `pods/{id}/options` | Archive, or meetup + 30 days, whichever is first | `dailyMaintenance` |
| Feedback | `podFeedback` | With the pod; only counters remain | — |
| Pair history (HMAC) | `matchProfiles.recentH` | 26 weeks [MAT] | Pruned each drop |
| Blocks | `blocks`, `users/{uid}/blocks` | While both accounts exist | Cascade |
| Reports | `reports` | Resolution + 12 months [GDPR] | TTL |
| Ban record (email hash) | `bans` | 24 months [GDPR] | TTL |
| Consent events | `consentEvents` | While active, then 3 years, pseudonymised, without tag reference [GDPR] **[LAWYER]** | TTL |
| Notices and statements of reasons | `users/{uid}/notices` | 12 months [A] | TTL |
| Review queue | `reviewQueue` | Decision + 30 days [A] | TTL |
| Photos | Storage `photos/` | Until replaced or deleted; raw uploads ≤ 1 day | Function + lifecycle |
| Exports | Storage `exports/` | 1 day [GDPR] | Lifecycle + TTL |
| Push tokens | `pushTokens` | 60 days stale or deletion. Google drops installation IDs within 180 days [GDPR] | Function |
| Rate limits | `rateLimits` | 1 day | TTL |
| Deletion ledger (HMAC uid) | `deletionLedger` | 35 days [A] | TTL |
| Drop aggregates (anonymous) | `drops` | 24 months [A] | — |
| Application logs (PII-free) | Cloud Logging | 30 days [GDPR] | Bucket retention |
| Backups | Firestore PITR + daily backups | 7 days each [GDPR][FBX] | Native; the restore replays the ledger |

**TTL mechanics** [FBX]:
- Each expiring collection group has one TTL field, `expiresAt`.
- Deletes usually happen within 24 h of expiry but are not guaranteed, so the notice states each period with a 24–72 h margin.
- TTL does not delete subcollections. Pods and user subtrees are removed by `dailyMaintenance` / `purgeUser` with `recursiveDelete`.
- TTL deletes are billed as normal deletes.
- Storage lifecycle rules clear `uploads/` and `exports/` after 1 day. Soft delete is off on the user-content bucket, so deleted photos do not linger.

---

## 6. Data subject rights in the app

Responses within one month, extendable by two (Art. 12(3)) [GDPR]. Requests from outside the app go to privacy@… and are logged.

| Right | In-app path | Backend |
|---|---|---|
| Access, portability (Arts. 15, 20) | Settings → Privacy → Download my data; live views | `exportData` → `buildExport` → owner-only JSON, deleted after 24 h |
| Rectification (Art. 16) | Edit profile, interests, preferences, area | `updateProfile`. DOB corrections go through support (18+ re-check) |
| Erasure (Art. 17) | Remove an interest; Delete account | `removeInterest`, `deleteAccount` → `purgeUser` |
| Restriction (Art. 18) | Pause account: data kept, matching and notifications stop | `setParticipation({mode: 'pause'})` |
| Objection (Art. 21) | Form, for legitimate-interest processing | Privacy lead reviews |
| Withdraw consent (Art. 7(3)) | Per tag, all sensitive, gender toggle, delete photo | §3.5–3.6 |
| Human review (Art. 22(3)) | "Ask a human" on "How matching works" and on every statement of reasons | Review queue |
| Complaint | Link to datatilsynet.dk | — |

**Export contents.** The export contains:
- profile, preferences, `birthYear`, area, and gender if set;
- all interests, including sensitive ones, and the consent log;
- pods (IDs, dates, the theme in the user's own wording, co-members' first names as shown);
- options and votes the user wrote, and feedback the user gave;
- attendance and reliability counters;
- blocks and reports the user filed;
- notices.

It never contains who reported the user (Art. 15(4)), other members' private feedback, or other users' interests. **[LAWYER]** Confirm that withholding individual meet-again votes is justified.

**Erasure sequence** (`deleteAccount`, then `purgeUser`; idempotent and retried) [GDPR][FBX]:
1. **Start.** Require recent re-authentication. Set `status: deleting` (excluded from matching). Revoke the Sign in with Apple token with a fresh `authorizationCode` (Apple 5.1.1(v)). Enqueue the purge. Call `auth.deleteUser`.
2. **Interests.** Sensitive holdings are withdrawn and pseudonymised (§3.5). Ordinary holdings decrement `refCount`, and tags and concepts are garbage-collected.
3. **Pods.**
   - The user leaves every pod; pods left with fewer than 3 members are archived.
   - Unscheduled options the user wrote are deleted; scheduled ones are reattributed to "former member".
   - The user's votes and feedback, and attendance entries about them, are deleted.
4. **Other links.** Photo grants (both directions), blocks, and `blockedH` entries in other profiles are deleted. Push tokens are deleted.
5. **Reports.** Reports the user filed keep a pseudonymised reporter. Reports against the user are kept until resolution + 12 months, for safety. **[LAWYER]**
6. **Bulk delete.** `recursiveDelete(users/{uid})`; `matchProfiles/{uid}`; Storage `photos/`, `uploads/` and `exports/` for the uid.
7. **Records.** Consent events get uid → HMAC and +3 years. A `deletionLedger` entry is written (35 days), which any backup restore replays first.
8. **Verify.** A test asserts that no document or object contains the uid afterwards.

Residual windows disclosed in the notice: up to 7 days of Firestore backups and PITR, and up to 180 days for Google's Auth backups [FBX].

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
   - a geohash-5 cell only;
   - no public profiles and no chat;
   - first names only;
   - gender only on opt-in;
   - no analytics.

   Then retention (§5) and rights (§6).
3. **Risk register** with measures (below).
4. **Data subjects' views:** a panel of about 10 alpha users, including holders of sensitive interests (Art. 35(9)) [A].
5. **Prior consultation with Datatilsynet** (Art. 36) if any residual risk stays high.
6. **Sign-off** by the privacy lead and founder, with counsel's opinion attached.

### 7.3 Risk register (L = likelihood, S = severity)

| # | Risk | L | S | Key measures | Residual |
|---|---|---|---|---|---|
| R1 | Breach or insider exposure of sensitive interests | L | H | Owner-only paths; server-only vectors; no PII in logs; least-privilege service accounts; 2 admins with hardware keys; audit logs | M |
| R2 | A pod member discloses another member's sensitive interest | M | H | Consent names pod members; all members share the interest; first names only; Terms; Android screen-capture block | M (accepted via consent) |
| R3 | Inference from themes, aggregates, embeddings | M | H | S1–S4; no sensitive aggregates; k ≥ 10; region density ≥ 12 | L |
| R4 | Detector misses a sensitive tag | M | H | Lexicon + recall-tuned detector + self-flag + rescans + reports; CI recall gate | M |
| R5 | Pre-consent transient classification | H | L | Memory only, EU, no logs, user-initiated, notice | L **[LAWYER]** |
| R6 | Physical harm or stalking | L | H | 18+; public-place rule; no distances; coarse cells; block/report with auto-pause; safety tips; police referral (DSA Art. 18) | M |
| R7 | Location triangulation | L | M | One coarse cell; area labels only | L |
| R8 | Minors | M | H | DOB check; store ratings; report category; fast removal | M |
| R9 | Discriminatory outcomes | M | M | No protected traits in scoring; fairness alerts (D§6.6); human sanctions | L |
| R10 | US transfer (Auth); DPF invalidation | M | M | Minimal Auth data; SCC fallback; TIA; exit plan | M |
| R11 | Account takeover via the email inbox | L | H | Re-auth for deletion and export; App Check; little data exposed | M |
| R12 | Third-party sensitive data in tags | M | M | Warning; treated as sensitive; reports | M **[LAWYER]** |
| R13 | Incomplete erasure or over-retention | L | M | TTL; jobs; ledger; "no uid remains" test | L |
| R14 | Function creep (e.g. ads on sensitive data) | L | H | Purpose-limited consent; no ad/analytics SDKs; DPIA gate | L |

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
| Firestore, Functions, Storage, Cloud Tasks, Scheduler, Secret Manager, Logging, Artifact Registry | Processor (Google) | europe-west1 (Belgium) | Cloud Data Processing Addendum; Google sub-processor list [GDPR][FBX] |
| Firebase Authentication (including magic-link emails) | Processor (Google) | **US data centers only** [FBX] | Firebase Data Processing and Security Terms: DPF (§10.6), else SCCs (§10.2) [FBX] |
| FCM, App Check | Processor (Google) | Global [FBX] | As above |
| Sign in with Apple, App Attest, APNs | Independent controller [GDPR] **[LAWYER]** | US / global | Apple terms; disclosed |
| Google Sign-In, Play Integrity | Independent controller [GDPR] **[LAWYER]** | Global | Google terms; disclosed |
| Expo (EAS Build) | None | — | Expo push and EAS Update not used [GDPR] |
| Hugging Face | None. Weights are copied at build time to our EU bucket; no user data is sent | — | Gemma Terms (model licence) [SRV] |
| Cloud Natural Language `moderateText`, if adopted | Processor | To verify | Only for queued non-sensitive items; decide in M2 [MAT] |

**Transfers** [GDPR]:
- **DPF.** In force. The General Court dismissed *Latombe* (T-553/23) on 3 Sep 2025, and the appeal C-703/25 P is pending. After *Trump v. Slaughter* (29 Jun 2026), the EDPB asked the Commission on 31 Jul 2026 to reassess the adequacy decision.
- **TIA for Auth and FCM.** The data is minimised to uid, email and push token. Auth holds no names or photos, and custom claims hold one boolean.
- **Exit plan.** If the DPF falls, rely on the SCCs already in Google's terms and update the TIA. Longer term, evaluate EU-hosted auth; no cheap option has been identified yet.
- **[LAWYER]** Review the TIA.

---

## 10. Security measures (Art. 32)
- **Access control:**
  - deny-by-default rules;
  - no client writes; all writes go through validated callables;
  - owner-only paths for sensitive data;
  - vectors and matching data server-only (D§9).
- **Integrity:** App Check on callables, Firestore and Storage; replay protection on reporting and deletion.
- **Photos:** per-pair grants; no bearer URLs; EXIF and GPS stripped.
- **Identity:**
  - a least-privilege service account per codebase;
  - no service-account keys; CI uses Workload Identity Federation;
  - two admins with hardware keys or passkeys;
  - audit logs for human access;
  - the admin CLI records a reason for each run.
- **Data:** Google's default encryption in transit and at rest; HMAC pseudonyms with keys in Secret Manager; logs without tag text, request bodies or tokens.
- **Resilience:** PITR plus daily backups (7 days); restore runbook with ledger replay.
- **Assurance:** rules tests in CI; an erasure-completeness test; the detector calibration gate.
- **Organisation:** confidentiality agreements, a yearly access review, and the incident runbook (§14).

---

## 11. Age policy
- **18+ only,** because of in-person meetups with strangers [GDPR].
- **Consent age.** The Danish digital consent age is 15 (databeskyttelsesloven § 6(2), since 1 Jan 2024). It is irrelevant here, because minors' consent is never relied on [GDPR].
- **Age check.** Self-declared date of birth, checked on the server. Only `birthYear` is stored. CPR numbers are never collected.
- **Store ratings.** The highest available age rating (18+ where offered).
- **Underage reports.** "Suspected under 18" pauses the account until it is resolved. Confirmed minors are deleted, with a 24-month hashed ban.

---

## 12. ePrivacy and app store labels

### 12.1 Danish cookie order (BEK 1148/2011)
The order covers storing and reading information on the device in apps. Digitaliseringsstyrelsen supervises it; joint guidance with Datatilsynet came on 15 May 2025 [GDPR].

| Component | Device storage / access | Consent? |
|---|---|---|
| Auth (RNFirebase, Apple, Google) | Session and refresh tokens | No: strictly necessary |
| Firestore offline cache | Cached documents | No |
| App Check | Attestation tokens and APIs | No (security of the requested service) **[LAWYER]** |
| FCM / Firebase Installations | Installation ID, push token, after the OS permission | No **[LAWYER]** |
| `expo-secure-store` | Pending sign-in email | No |
| Analytics, Crashlytics, ads | Not included | — |

**Result:** no consent banner. Any future analytics or crash SDK needs opt-in.

### 12.2 Apple App Privacy details
- **Declared, all linked to the user and used for App Functionality:**
  - Contact Info (email);
  - **Sensitive Info** (pregnancy, sexual orientation, religion, political opinion, union membership, ethnicity, disability) [GDPR];
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
- **Deletion outside the app:** Play also expects a web link for account deletion, so a static page explains the in-app path and the email route [A, verify].

---

## 13. DSA notes
- **Classification.** Pods are closed groups of 4–6 pre-determined people with no public profiles, so Grouper is most likely a **hosting service**, not an online platform [GDPR]. Adding public features (open events or groups) requires re-assessment.
- **Applicable duties:**

  | Article | Duty |
  |---|---|
  | Arts. 11–12 | Points of contact |
  | Art. 14 | Terms that describe restrictions and automated moderation |
  | Art. 16 | Notice-and-action: the in-app Report flow plus a web form, for tags, meetup text and photos |
  | Art. 17 | A statement of reasons for every rejected or held tag, removed option, pause, suspension or ban: the facts, whether it was automated, the ground, and how to contest |
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
5. **Notify users without undue delay** when the risk is high (Art. 34). Use an in-app notice and email, in Danish and English, covering what happened, the consequences, what we did and what they can do.
6. **Remediate.** Post-mortem within 14 days [A]; update the DPIA, tests and this document.

**[LAWYER]** Review the notification templates (`tools/admin/runbooks/` [A]).

---

## 15. Art. 30 records (skeleton)
The Art. 30(5) exemption for organisations under 250 employees does not apply, because Art. 9 data is processed and not only occasionally [GDPR]. Retention for every row is in §5, and security measures for every row in §10.

| # | Activity | Purpose | Subjects | Categories (Art. 9?) | Basis | Recipients | Transfers |
|---|---|---|---|---|---|---|---|
| 1 | Account / Auth | P1 | Users | Email, provider ID | 6(1)(b) | Google | US: DPF/SCC |
| 2 | Profile, age, area, gender | P2, P3, P7 | Users | Birth year, cell, gender (precautionary) | 6(1)(b), 6(1)(a) | — | — |
| 3 | Ordinary interests | P4 | Users | Tags, vectors | 6(1)(b) | Pod members (shared concepts) | — |
| 4 | Sensitive interests | P5, P14 | Users | **Yes** | 6(1)(a) + 9(2)(a) | Pod members (theme); reviewer without uid | — |
| 5 | Matching / drops | P9, P11 | Users | Derived; **yes** for sensitive themes | 6(1)(b), 9(2)(a) | Pod members | — |
| 6 | Planner and feedback | P10 | Users | Options, votes, attendance | 6(1)(b) | Pod members | — |
| 7 | Photos | P8 | Users | Image | 6(1)(a) | Confirmed pod members | — |
| 8 | Push | P15 | Users | Token, installation ID | 6(1)(b) | Google, Apple | Global |
| 9 | Reports, blocks, moderation | P12, P13 | Users, reported users | Reports, decisions | 6(1)(f), 6(1)(c) | Police if required | — |
| 10 | Security and logs | P16 | Users | Tokens, counters | 6(1)(f) | Google | Global (App Check) |
| 11 | Consent and request records | P17 | Users, former users | Consent events | 6(1)(c) | — | — |

---

## 16. Privacy notice outline
Layered (in-app summary + full text), in Danish and English:
1. Who we are and how to contact the privacy lead.
2. What we collect, why, the legal basis and for how long (§2, §5).
3. Sensitive interests: explicit consent, who sees them, wording review, withdrawal.
4. How matching works and "why this pod"; human review; pause.
5. Who sees what: nothing public; first name and photo only after confirmation; no distances.
6. Where data lives (EU; Auth in the US; FCM and App Check global) and the processor list.
7. Retention, including the backup, Auth and TTL windows.
8. Rights, in-app buttons, one-month response.
9. Safety, moderation and how to contest.
10. Device storage (strictly necessary only).
11. Age (18+).
12. Complaints to Datatilsynet; version and changelog.

---

## 17. Lawyer review checklist
1. Consent wording (EN/DA), per-tag granularity, generic category list (§3.3).
2. The pre-consent check: notice-based or up-front consent (§3.8).
3. Effect of a user's "not sensitive"; downgrades after review (§4.3).
4. Third-party sensitive data in tags: warn or refuse (§4.3).
5. Art. 22 position (§4.4) and the basis for no-show processing (P11).
6. Retention of consent records and of reports against deleted users (§5, §6).
7. Art. 15(4) limits on exports (§6).
8. Roles of the Apple and Google services; the TIA for Auth and FCM (§1, §9).
9. App Check and FCM under the cookie order (§12.1).
10. Not designating a DPO, and the reassessment triggers (§8).
11. DSA classification as a hosting service (§13).
12. Breach templates and the privacy notice text (§14, §16).
13. Gemma Terms for backend-only use of EmbeddingGemma v1, if v1 is kept (D§2.4 Q1) [SRV].
