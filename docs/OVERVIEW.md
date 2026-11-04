# Grouper: founder overview

Start here. This page summarises the design in about ten minutes of reading. Everything links into the full documents:

- [DESIGN.md](./DESIGN.md): product and technical design.
- [PRIVACY.md](./PRIVACY.md): GDPR design.
- [research/embedding-calibration](../research/embedding-calibration/README.md): the embedding experiment.
- [research/thin-market-sim.md](../research/thin-market-sim.md): the pod simulation.

Status, 2026-11-04: design for your review, plus a working scaffold (M0). Nothing has been deployed.

## What we are building

**Pods: friendship matching for small groups.** You describe yourself with free-form **interests** in your own words: "madlavning", "far på barsel", "Fortnite". Every Thursday evening a **drop** forms new **pods** of 4–6 strangers who live near each other and share an interest. Members accept, pick a time and place by vote, and meet in person. There is no chat, no public profile and no swiping.

## How a week works

1. **Thursday 18:00.** The drop arrives: "Your weekly drop is here". The push never names the theme or anyone in the pod.
2. **Proposal card.** It shows the theme in *your* wording, the area, the pod size and an age span. Names and photos stay hidden.
3. **Accept or decline** within 48 hours. When 4 people accept, the pod is **confirmed**: members now see first names and photos (photos only if their owner opts in, in sensitive pods). If too few accept, backfill invites someone who wasn't matched that week.
4. **Planning.** Members propose 2–3 options (a time and a public place) and vote within 72 hours.
5. **Meetup.** The app sends a reminder and safety tips. Afterwards it asks "Did you meet?" and whether you'd meet each person again. If at least 3 members choose **Keep pod**, the pod plans its next meetup.
6. **Always available:** block, report, leave a pod, pause matching, download your data, delete your account.

## Your decisions (interview)

| | |
|---|---|
| Groups | The app forms pods of 4–6 strangers in weekly drops; users accept or decline |
| Meeting | In person only, within a radius of an approximate location |
| Interests | Free-form; matched by meaning with EmbeddingGemma vectors, so "madlavning" ≈ "cooking" |
| Sensitive interests | Pregnancy, faith, LGBTQ+, health and so on are allowed with explicit consent. They are never public and are shown only inside a pod formed around that interest |
| Talking | A meetup planner (propose and vote); no free-form chat |
| Preferences | Age range, optional same-gender pods, optional photo shown only after confirmation |
| Sign-in | Apple, Google, email magic link (no SMS) |
| Market | Denmark first (Aarhus, then Copenhagen), Danish and English, 18+, free |
| Stack | Expo (React Native) and Firebase in the EU, kept cheap |

## Decisions I made for you (please confirm or veto)

The full list is DESIGN §2.2; these are the ones with the most product impact.

1. **Model: EmbeddingGemma 2** (q4, CPU), not v1. It passed the gate we set (details under "What the experiments showed") and is Apache-2.0 licensed. v1 stays documented as a fallback.
2. **Sensitive interests are protected in layers:**
   - detection: a word list on the phone, then a model on the server, then human review of flagged wording;
   - a sensitive interest is never merged with an ordinary one, and is only ever used as a pod's *theme*;
   - a sensitive pod needs at least 12 consenting holders nearby;
   - **anti-infiltration gate:** to join a sensitive pod, an account must be 14+ days old and have attended one meetup. This delays a new user's first pregnancy or faith pod by a few weeks (Q15).
3. **Weekly participation is on by default.** It pauses automatically after 3 declines or 2 ignored proposals in a row. Each user can have at most 2 active pods.
4. **Location is a ~5 km cell, computed on the phone** from a postcode or coarse GPS. The server never sees coordinates, and nobody is ever shown a distance.
5. **Clients never write to the database.** Every write goes through a validated server function. This keeps the security rules simple and auditable.
6. **No analytics, no crash SDK, no Expo push.** Push goes directly through Firebase Cloud Messaging with generic text, so the app needs no consent banner.
7. **Launch areas are fixed lists** ("Aarhus live, Copenhagen waitlist"). A city opens when it reaches its sign-up goal.
8. **Alpha profile for the first testers:**
   - "open to meet anyone" is on by default;
   - the default age range is wider;
   - pair-history windows are shorter.
9. **Safety switch in code:** sensitive interests are refused until "remove and withdraw" is built. Withdrawing consent must be as easy as giving it.

## What the experiments showed

**Embeddings.** I ran EmbeddingGemma v1 and v2 on 211 labelled Danish and English tags in this sandbox ([research](../research/embedding-calibration/README.md)):

| | v1 (300m, q4) | **v2 (q4), chosen** |
|---|---|---|
| Recall when auto-merging at ≥ 95% precision | 0.26 | **0.42** |
| "cooking" ↔ "madlavning"-style translations, mean cosine | 0.78 | **0.91** |
| Danish words looking alike when unrelated (bias) | strong | **gone** |
| Sensitive detector: catches every sensitive tag, false flags | 44 of 112 | 55 of 112 |
| Licence | Gemma Terms | **Apache-2.0** |

The detector is tuned to miss nothing, so it over-flags. It wrongly flags ordinary Danish hobby words much more often than English ones (64% vs 16%). Before launch you would review about 1,000 common hobby tags, so nobody is asked to consent to "madlavning".

**Thin markets: the biggest product risk.** I simulated the scaffold's real matcher on synthetic Aarhus users over 12 weeks ([sim](../research/thin-market-sim.md); the behaviour is assumed):

| Testers | Profile | Proposals that confirm | Weeks to first pod (median) | Never matched in 12 weeks |
|---|---|---|---|---|
| 100 | alpha | 37% | 9–11 or never | 49% |
| 200 | alpha + 5 seed-theme cohorts | 35% | 5.0 | 33% |
| 300 | alpha + 5 seed-theme cohorts | 35% | 4.3 | 28% |

- **What it means:** the 50–150 testers originally planned for the alpha are too few.
- **Why:** most proposals have only 4 invitees, and all 4 must say yes.
- **Recommendation:** recruit ≥ 300 testers in Aarhus around ≤ 5 seed themes, and test "invite 5–6 when possible" in the simulator before the alpha (Q19).

**Speed.** The matcher forms pods for 20,000 users in about 2 seconds. The drop is not a bottleneck.

## Privacy, briefly

- **What the design commits to:** explicit consent per sensitive interest, recorded with the exact text version; withdrawal in one tap; data kept in the EU (europe-west1) wherever Firebase allows; minimal data (birth year, a coarse cell, first name); retention limits enforced by the database (TTL); an erasure ledger, so a backup restore cannot bring deleted data back; and logs without IP addresses or interest text.
- **What only you can do before the alpha:**
  - **A DPIA is mandatory** (5 of Datatilsynet's 8 criteria apply). PRIVACY §7 has the outline and the risk register.
  - **Hire a Danish data-protection lawyer.** PRIVACY §17 lists 22 questions, the largest being whether the server may check a typed tag for sensitivity *before* consent.
  - **Name a privacy lead.** A formal DPO is probably not required yet (PRIVACY §8).
  - **Create a Cloud Identity organisation *before* the Firebase projects,** so logs can be pinned to the EU (DESIGN §7).
- **Residual risks you are accepting:**
  - Firebase Auth stores sign-in data in the US (covered by the EU–US Data Privacy Framework, with standard contractual clauses as fallback).
  - A determined attacker with several fake accounts could join a sensitive pod. Mitigations exist, and the consent text says so.

## Cost

| Monthly active users | 1,000 | 10,000 | 100,000 |
|---|---|---|---|
| Infrastructure, USD per month | ~$0.5–1 | ~$3–5 | ~$49–63 |

- **Fixed costs:** Apple Developer $99 a year, Google Play $25 once, a domain.
- **What grows first:** photo downloads.
- **Abuse protection:** spending under abuse is capped by instance limits, kill switches and budget alerts (worst case for the embedder is about $345 a month).

## Questions for you

The full list is DESIGN §2.4.

| # | Question | My default |
|---|---|---|
| Q19 | Which thin-market levers for the alpha: ≥ 300 testers in seed cohorts, invite 5–6, wider ages, or confirm at 3? | ≥ 300 testers in cohorts + test "invite 5–6" in the simulator |
| Q15 | Is the sensitive-pod gate (14 days + 1 attended meetup) worth delaying a new user's first sensitive pod? | Yes; revisit with alpha data |
| Q6 | Minimum number of consenting holders nearby before a sensitive pod can form | 12 within 25 km |
| Q4 | Who reviews flagged tags and reports, and how often? | You, weekly, before each drop |
| Q3 | Every week by default, or explicit weekly opt-in? | Every week |
| Q16 | Same-gender pods for non-binary users | "Same gender" only in the MVP |
| Q10 | Legal entity, privacy lead, lawyer budget | Needed before the alpha |
| Q1 | Veto EmbeddingGemma 2 (about 4 weeks old) in favour of v1? | Keep v2 |

## What is in the repository

```
apps/mobile          Expo SDK 58 app: onboarding, consent sheet, interests, pods, settings (Danish + English)
functions            Firebase Functions: callables, weekly drop, sweeps, exports, deletion
services/embedder    EmbeddingGemma 2 service: the interest pipeline and consent gate
packages/core        Shared rules: schemas, normalisation, Art. 9 word list, geo, schedule, consent texts, matcher
tests/rules          Security-rules tests against the emulators
tools/sim, tools/admin  Simulator, admin CLI (stub)
research/            Embedding calibration and thin-market simulation
```

- **Working now:** onboarding, profile and participation, adding interests with the consent gate, the matcher, the security rules, and the app's main flows. CI runs about 550 tests, most against the Firebase emulators.
- **Stubbed:** the pod lifecycle after the drop (accept, plan, vote, feedback), block and report, export and deletion, and admin tools. Each stub fails loudly and points to its design section (README, "What is stubbed").

## Next steps (rest of M0 → M1)

1. You review this page, DESIGN §2.2 and §2.4, and the consent copy in PRIVACY §3.
2. Create the Firebase projects, in the order DESIGN §7 gives. Then test the three sign-in methods on real iOS and Android dev builds.
3. Deploy the embedder to a real Cloud Run instance and measure its cold start.
4. Run the seed review of about 1,000 tags, improve the Danish detector phrases, and build a larger labelled set.
5. Engage the lawyer and draft the DPIA.
6. M1: build the pod lifecycle, withdrawal, export and deletion, then a private alpha in Aarhus with ≥ 300 testers.
