# Grouper: founder overview

Start here. This page summarises the design in about ten minutes of reading. Everything links into the full documents:

- [DESIGN.md](./DESIGN.md): product and technical design.
- [PRIVACY.md](./PRIVACY.md): GDPR design.
- [COSTS.md](./COSTS.md): every third-party cost at 1k–100k users and over 24 months.
- [research/embedding-calibration](../research/embedding-calibration/README.md): the embedding experiment.
- [research/thin-market-sim.md](../research/thin-market-sim.md): the pod simulation.

Status, 2026-11-04: design for your review, updated with your review-round-2 decisions (D1–D16) and your later decision to bundle the model in the app, plus a working scaffold (M0). Nothing has been deployed.

## What we are building

**Pods: friendship matching for small groups.** You describe yourself with free-form **interests** in your own words: "madlavning", "far på barsel", "Fortnite". Every Thursday evening a **drop** forms new **pods** of 4–6 strangers who live near each other and share an interest. Members accept, pick a time and a public place by vote, and meet in person. Around each meetup the pod gets a short chat, open for a day before and a day after. There is no open-ended chat, no public profile and no swiping.

## How a week works

1. **Thursday 18:00.** The drop arrives: "Your weekly drop is here". The push never names the theme or anyone in the pod.
2. **Proposal card.** It shows the theme in *your* wording, the area, the pod size and an age span. Names and photos stay hidden.
3. **Accept or decline** within 48 hours. When 4 people accept, the pod is **confirmed**: members now see first names, a one-line "about me" if someone wrote one, and photos (photos only if their owner opts in, in sensitive pods). If too few accept, backfill invites someone who wasn't matched that week; backfill can still happen while the pod plans, never after the plan is fixed.
4. **Planning.** Members propose 2–3 options, each a time and a **public place picked from Google Places** (cafés, libraries, parks and the like; no typed addresses), and vote within 72 hours. If no option gets 3 yes votes, the pod gets **one extra day**: "No time works yet — add another option".
5. **Meetup.** Voting yes for the winning option counts as "I'm coming". The app asks "Still coming?" 3 days before (if the meetup is that far off) and 24 hours before; anyone who hasn't answered gets a second nudge 6 hours before, and at 3 hours before the others see "Anna hasn't confirmed". If fewer than 3 are coming, the pod gets one chance to pick a new time. The **meetup chat** opens 24 hours before and closes 24 hours after; it warns before you share a phone number or handle ("You haven't met yet. It's fine to wait until after."), and messages are deleted about 3 days after the meetup. One tap adds the meetup to your calendar.
6. **The morning after, 10:00.** "How was it?": everyone is pre-ticked under "Who was there?", and you untick anyone who was missing. You also say privately whether you'd meet each person again: if two people both say yes, they can be matched again after 4 weeks instead of 26; if either says no, they are never matched again, and nobody is told. If at least 3 members choose **Keep pod**, the pod plans its next meetup.
7. **Always available:** block, report (both in each member's sheet), leave a pod, pause matching, download your data, delete your account.

The pod screen shows **one "next step" card** at a time (vote → confirm you're coming → chat → give feedback), then calm Plan, Chat and Members sections.

## Your decisions

**Interview (2026-11-04):**

| | |
|---|---|
| Groups | The app forms pods of 4–6 strangers in weekly drops; users accept or decline |
| Meeting | In person only, within a radius of an approximate location |
| Interests | Free-form; matched by meaning with EmbeddingGemma vectors, so "madlavning" ≈ "cooking" |
| Sensitive interests | Pregnancy, faith, LGBTQ+, health and so on are allowed with explicit consent. They are never public and are shown only inside a pod formed around that interest |
| Talking | A meetup planner plus a short meetup chat from 24 hours before until 24 hours after each meetup |
| Preferences | Age range, optional same-gender pods, optional photo shown only after confirmation |
| Market | Denmark first (Aarhus, then Copenhagen), Danish and English, 18+, free |
| Stack | Expo (React Native) and Firebase in the EU, kept cheap |

**Review round 2 (2026-11-04)**, folded into every document (DESIGN §2.1, F16–F31):

| # | Decision |
|---|---|
| D1 | **The embedding model runs on the phone** for every tag. The server stores the phone's vector and trusts it (an accepted manipulation risk); the server-side embedder is gone |
| D2 | **No human review anywhere.** A shipped list of ~480 everyday Danish and English hobby words, the detector, "Keep this private" and the user's own "This isn't sensitive for me" replace review. Pauses are automatic and every one expires |
| D3 | **One blanket consent for sensitive interests** at onboarding, on its own screen. Saying no keeps the app usable; sensitive tags are then refused. No prompt per tag, just a lock icon |
| D4 | Short tags stay; an optional "about me" sentence (140 characters) for confirmed co-members |
| D5 | Attendance: yes vote = coming; asks at T−3 days and T−24 h; nudge at T−6 h; "hasn't confirmed" after that; no answer is never a no-show |
| D6 | Backfill only before the plan locks |
| D7 | One 24 h extension when no time wins |
| D8 | Places from Google Places, public place types only |
| D9 | Meet again: mutual yes → 4 weeks; any no → never again |
| D10 | Sign in with Apple on iOS only (Android: Google and email link) |
| D11 | Add to calendar in one tap; nothing stored |
| D12 | Feedback push at 10:00 the morning after, one reminder 3 days later |
| D13 | Pod screen with one next-step card |
| D14 | No quick replies in the chat; "Can't make it" is on the attendance card |
| D15 | "Who was there?" with everyone pre-ticked |
| D16 | A cost overview: [COSTS.md](./COSTS.md) |

**Later the same day** (DESIGN F32): **the on-device model ships inside the app** instead of downloading on first use. It is fetched and checked against its pinned hashes when the app is built; the app gets about 210 MB bigger.

## Decisions I made for you (please confirm or veto)

The full list is DESIGN §2.2; these are the ones with the most product impact.

1. **Model: EmbeddingGemma 2** (q4), not v1. It passed the gate we set (below) and is Apache-2.0 licensed. On the phone it runs on **ONNX Runtime** (the React Native package, with the native engine pinned to the exact version the thresholds were measured on); a sandbox test reproduced the calibration vectors to a cosine of 0.9999993. The model (~175 MB, ~210 MB with its tokenizer) **ships inside the app**, as you decided: every file is checked against a pinned hash when the app is built, so there is no download, no hosting bill and no extra processor. On Android the app copies it once into its own storage at first launch, because the runtime needs a real file path. The price is app size: iPhones ask before downloading an app above 200 MB on cellular, and every app update that changes the model ships it again. Phones that can't run it can't add interests (target: about 4 GB of RAM).
2. **Sensitive interests are protected in layers:**
   - detection on the phone: a word list, the known-ordinary hobby list, then the model; the server repeats the word list;
   - a sensitive interest is never merged with an ordinary one, and is only ever used as a pod's *theme*;
   - a sensitive pod needs at least 12 consenting holders nearby;
   - **anti-infiltration gate:** to join a sensitive pod, an account must be 14+ days old and have attended one meetup. "Not a genuine member" reports and odd patterns put an account on an automatic 28-day hold.
3. **Weekly participation is on by default.** It pauses automatically after 3 declines or 2 ignored proposals in a row. Each user can have at most 2 active pods.
4. **Location is a ~5 km cell, computed on the phone** from a postcode or coarse GPS. The server never sees coordinates, and nobody is ever shown a distance.
5. **Clients never write to the database.** Every write goes through a validated server function.
6. **No analytics, no crash SDK, no Expo push.** Push goes directly through Firebase Cloud Messaging with generic text, so the app needs no consent banner.
7. **Launch areas are fixed lists** ("Aarhus live, Copenhagen waitlist").
8. **Alpha profile for the first testers:** "open to meet anyone" on by default, a wider default age range, shorter pair-history windows.
9. **Safety switch in code:** sensitive interests are refused until removing them and withdrawing the consent are fully built. Withdrawing must be as easy as consenting.
10. **Where your decisions left room** (DESIGN A29–A38): the attendance check runs at **T−3 h**, so people nudged at T−6 h have 3 hours to answer; one extension per planning round; automatic pauses last **28 days** (no-shows: 2 weeks, then 8 weeks); a meet-again "no" is stored as a never-ending pair-history entry, so the matcher needed no change; places keep their Google type so the server can check they are public.

## What the experiments showed

**Embeddings.** I ran EmbeddingGemma v1 and v2 on 211 labelled Danish and English tags in this sandbox ([research](../research/embedding-calibration/README.md)):

| | v1 (300m, q4) | **v2 (q4), chosen** |
|---|---|---|
| Recall when auto-merging at ≥ 95% precision | 0.26 | **0.42** |
| "cooking" ↔ "madlavning"-style translations, mean cosine | 0.78 | **0.91** |
| Danish words looking alike when unrelated (bias) | strong | **gone** |
| Sensitive detector: catches every sensitive tag, false flags | 44 of 112 | 55 of 112 |
| Licence | Gemma Terms | **Apache-2.0** |

The detector is tuned to miss nothing, so it over-flags, mostly ordinary Danish hobby words. Instead of a pre-launch review, the app ships a **known-ordinary list** of 479 everyday hobby words (196 Danish, 283 English), written by hand from everyday hobbies and leaving out anything near health, faith, sexuality or politics. On the calibration set it covers 18 of the detector's 46 false flags at its 100%-recall point (an optimistic, in-sample figure; M0 re-measures it). For anything it misses, a consenting user can tap "This isn't sensitive for me"; without consent, an over-flagged hobby is refused, which is the price of not reviewing.

**On-device runtime** (sandbox, x86): 29 ms per tag with 4 threads, 85 ms with 1; about 470 MB peak memory. Phone numbers are estimates until the M0 spike on 4 real devices.

**Thin markets: the biggest product risk.** I simulated the scaffold's real matcher on synthetic Aarhus users over 12 weeks ([sim](../research/thin-market-sim.md); the behaviour is assumed):

| Testers | Profile | Proposals that confirm | Weeks to first pod (median) | Never matched in 12 weeks |
|---|---|---|---|---|
| 100 | alpha | 37% | 9–11 or never | 49% |
| 200 | alpha + 5 seed-theme cohorts | 35% | 5.0 | 33% |
| 300 | alpha + 5 seed-theme cohorts | 35% | 4.3 | 28% |

- **What it means:** the 50–150 testers originally planned for the alpha are too few.
- **Why:** most proposals have only 4 invitees, and all 4 must say yes.
- **Recommendation:** recruit ≥ 300 testers in Aarhus around ≤ 5 seed themes, and test "invite 5–6 when possible" in the simulator before the alpha (Q19).

**Speed.** The matcher forms pods for 20,000 users in about 2 seconds.

## Privacy, briefly

- **What the design commits to:** one **blanket explicit consent** for sensitive interests, on its own screen, unticked, recorded with the exact text version and withdrawable in Settings (which deletes all sensitive interests at once); saying no keeps the app usable. The sensitivity check runs **on the phone**, so sensitive text from someone who hasn't consented never leaves the phone; this largely resolves the old legal question about checking text before consent. Data in the EU (europe-west1) wherever Firebase allows; minimal data (birth year, a coarse cell, first name); retention enforced by the database (TTL); an erasure ledger, so a backup restore cannot bring deleted data back; logs without IP addresses or interest text.
- **What changes with D2 (no human review), said plainly:** nobody reads reports; every sanction is a fixed-length automatic pause; there are no bans, no appeals, no no-show disputes (the majority decides), and a suspected minor is paused, not removed. Statements of reasons stay automatic. A lawyer must confirm this is acceptable under the DSA (PRIVACY §13).
- **New processors and data:** Google Places sees place searches and the phone's IP address (no user ID). "About me" and private meet-again answers are stored, exported and erased like the rest.
- **What only you can do before the alpha:**
  - **A DPIA is mandatory** (5 of Datatilsynet's 8 criteria apply). PRIVACY §7 has the outline and the risk register (now R1–R21).
  - **Hire a Danish data-protection lawyer.** PRIVACY §17 lists 18 items; the largest are whether one blanket consent is freely given and specific enough, the "This isn't sensitive for me" downgrade, and running moderation with no human review.
  - **Name a privacy lead.** A formal DPO is probably not required yet (PRIVACY §8).
  - **Create a Cloud Identity organisation *before* the Firebase projects,** so logs can be pinned to the EU (DESIGN §7).
- **Residual risks you are accepting:**
  - Firebase Auth stores sign-in data in the US (EU–US Data Privacy Framework, with standard contractual clauses as fallback).
  - A determined attacker with several fake accounts could join a sensitive pod. Mitigations exist, the consent text says so, and without review they slow an attacker down rather than stop one.
  - A modified app could send misleading vectors; the server cannot recompute them (D1).

## Cost

The full overview is [COSTS.md](./COSTS.md) (prices fetched 2026-11-02 to 2026-11-04).

| USD per month | 1,000 users | 10,000 | 50,000 | 100,000 |
|---|---|---|---|---|
| Google Cloud / Firebase | ~$0.5 | ~$3.5 | ~$23 | ~$55 |
| Google Places (place picker) | $0 | ~$0–13 | ~$120–185 | ~$315–425 |
| Store accounts, domain, EAS | ~$11 | ~$11–30 | ~$30 | ~$30 |
| **Total** | **~$12** | **~$15–47** | **~$170–240** | **~$400–510** |

- **What changed:** the server embedder and its worst-case $345/month are gone. **Google Places is now the biggest line.** The model ships inside the app, so it costs nothing to distribute.
- **Over 24 months** on the assumed growth curve (5k users at month 6, 20k at 12, 100k at 24): about $3,500 in total.
- **Fixed costs:** Apple Developer $99 a year, Google Play $25 once, a `.dk` domain, EAS Starter $19 a month from launch.

## Questions for you

The full list is DESIGN §2.4.

| # | Question | My default |
|---|---|---|
| Q19 | Which thin-market levers for the alpha: ≥ 300 testers in seed cohorts, invite 5–6, wider ages, or confirm at 3? | ≥ 300 testers in cohorts + test "invite 5–6" in the simulator |
| Q23 | Should "This isn't sensitive for me" also be offered to people **without** the sensitive-interests consent, when only the model (not the word list) flagged a tag? | No, until the lawyer has looked at it |
| Q22 | Minimum phone for adding interests | About 4 GB RAM, confirmed in the M0 device test |
| Q21 | Google's terms limit how long we may keep place names and addresses | Check in M0; if needed, drop the place 30 days after the meetup |
| Q15 | Is the sensitive-pod gate (14 days + 1 attended meetup) worth delaying a new user's first sensitive pod? | Yes; revisit with alpha data |
| Q6 | Minimum number of consenting holders nearby before a sensitive pod can form | 12 within 25 km |
| Q3 | Every week by default, or explicit weekly opt-in? | Every week |
| Q16 | Same-gender pods for non-binary users | "Same gender" only in the MVP |
| Q10 | Legal entity, privacy lead, lawyer budget | Needed before the alpha |
| Q1 | Veto EmbeddingGemma 2 (about 4 weeks old) in favour of v1? | Keep v2 (v1 was never tested on phones) |

Answered by your round-2 decisions: Q4 (who reviews: nobody), Q9 (Apple on Android: no), Q18 (model on the phone: yes).

## What is in the repository

```
apps/mobile          Expo SDK 58 app: onboarding with the sensitive-interests consent, on-device model, interests,
                     pods (next-step card, place picker, attendance, calendar), chat, settings (Danish + English)
functions            Firebase Functions: callables (addInterests included), weekly drop, sweeps, exports, deletion
packages/core        Shared rules: schemas, normalisation, Art. 9 word list, known-ordinary list, model pinning and
                     thresholds, detector, geo, schedule, attendance and planning rules, consent texts, matcher
tests/rules          Security-rules tests against the emulators
tools/sim, tools/admin  Simulator, admin CLI (stub)
research/            Embedding calibration and thin-market simulation
```

- **Working now:** onboarding with the blanket consent, profile and "about me", participation, adding interests with on-device vectors (the server side is tested with fixture vectors), the matcher, sending meetup-chat messages, the security rules, and the app's main flows.
- **Stubbed:** the pod lifecycle after the drop (accept, plan, vote, attendance, feedback, the sweeper's asks and nudges), block and report, export and deletion, removing sensitive interests, the offline model tooling (`prototypes.bin`, the nightly calibration) and admin tools. Each stub fails loudly and points to its design section (README, "What is stubbed").

## Next steps (rest of M0 → M1)

1. You review this page, DESIGN §2.2 and §2.4, the consent copy in PRIVACY §3.3, and COSTS.md.
2. Create the Firebase projects, in the order DESIGN §7 gives. Test sign-in on real iOS (Apple, Google, email link) and Android (Google, email link) dev builds.
3. **Device spike:** run the on-device model on 2 low-end Android phones, an older and a newer iPhone (golden test, memory, speed); check the app size and the first-launch model copy on Android; set up the EU model mirror for CI and build `prototypes.bin`.
4. Restrict the Google Places key to the apps and set daily quota caps; check Google's caching terms.
5. Engage the lawyer and draft the DPIA.
6. M1: build the pod lifecycle, withdrawal, export and deletion, then a private alpha in Aarhus with ≥ 300 testers.
