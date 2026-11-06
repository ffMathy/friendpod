# Grouper: cost overview

| | |
|---|---|
| Status | Estimate for founder review (founder decision D16, review round 2) |
| Date | 2026-11-04; every price was fetched on 2026-11-02 to 2026-11-04 (sources at the end) |
| Companions | [DESIGN.md §12](./DESIGN.md#12-cost-model) (engineering cost levers), [PRIVACY.md §9](./PRIVACY.md#9-processors-sub-processors-and-transfers) (who each service is) |

All amounts are **USD, list price, per month**, for europe-west1 where a region applies, before VAT. Tags: **[P]** a published price (source table at the end), **[§12]** the usage model of DESIGN §12 (from the Firebase/Expo research [FBX]), **[A]** an assumption of ours, to be replaced by measurements from the alpha.

## 1. Summary

| Monthly active users (MAU) | 1,000 | 10,000 | 50,000 | 100,000 |
|---|---|---|---|---|
| Google Cloud / Firebase (all lines in §3.1) | ~$0.5 | ~$3.5 | ~$23 | ~$55 |
| Google Places (meetup place picker, D8) | $0 | ~$0–13 | ~$120–185 | ~$315–425 |
| Store accounts, domain, EAS builds | ~$11 | ~$11–30 | ~$30 | ~$30 |
| **Total** | **~$12** | **~$15–47** | **~$170–240** | **~$400–510** |

What this means:
- **Below about 7,000 MAU almost everything is free** except the store accounts. The Places free caps (10,000 requests of each kind a month) cover the place picker up to about 7k MAU.
- **One line dominates from 10k MAU:** the Places place picker. Firebase itself stays small.
- **The on-device model costs nothing to distribute:** it ships inside the app (DESIGN F32), so the app stores deliver it. The price is about 210 MB more app size, not money (§3.3).

## 2. What changed against DESIGN §12 (before round 2)

| Change | Effect at 100k MAU | Why |
|---|---|---|
| **Server embedder retired** (D1): no `embedder` codebase, no 1 GiB instances, no embedder images in Artifact Registry, no `minInstances`/Vertex levers, no global embed budget | −$3–6.50 embedding path, −about $0.10 Artifact Registry; the **$345/month abuse ceiling is gone** | Tags are embedded on the phone; the server only runs `findNearest` in a normal callable |
| **Google Places added** (D8) | +$315–425 | Autocomplete (per request) + Place Details Essentials; free caps 10k/month each |
| **On-device model added, bundled in the app** (D1, F32) | $0 | About 210 MB more app size; the stores deliver it with the app (§3.3) |
| **EU Storage has no free tier** (corrected) | photos ~$24.5 instead of "first GB free" | Firebase's no-cost Storage quota applies only to us-central1, us-west1 and us-east1 buckets |
| **Egress price confirmed** at $0.12/GB (0–10 TiB) | no change | Was marked "unconfirmed" in §12 |
| **New per-MAU drivers**: attendance nudges, extension rounds, meet-again pair signals, `aboutMe`, Places sessions | +~$1 Firestore | §4 |
| **Play Integrity quota** | $0, but a free tier increase must be requested at about 30–40k DAU | 10,000 calls/day standard tier with a 1 h App Check TTL |
| **Email-link sign-in needs Blaze** on staging too | $0 (Blaze pay-as-you-go) | Spark allows 5 email-link sends a day |
| Scheduler | no change: still 3 jobs | The new T−3 d / T−24 h / T−6 h nudges and the 10:00 feedback push run inside `hourlySweeper` |

## 3. Line items

### 3.1 Google Cloud and Firebase (one billing account; staging shares the free tiers)

| Line | 1k | 10k | 50k | 100k | Basis |
|---|---|---|---|---|---|
| Firestore operations and storage | $0 | ~$0.5 | ~$6 | ~$13.5 | ~300 reads, ~40 writes and deletes, 50 KB stored per MAU [§12][A]; $0.033 / $0.099 / $0.011 per 100k reads / writes / deletes, $0.165/GiB-month; free 50k reads, 20k writes, 20k deletes a day [P] |
| Concept vector search (`findNearest` in `addInterests`) | $0 | ~$0.15 | ~$0.5 | ~$1 | 1 read per 100 index entries scanned + 1 per returned doc [P]; in-memory shortlist above 20k concepts (DESIGN §5.2 (6)) |
| PITR + 7 daily backups | ~$0 | ~$0.2 | ~$1 | ~$2 | $0.165/GiB-month PITR, $0.033 backup [P]; no free tier |
| Cloud Functions (2nd gen, gcf_gen1 sizing, ~200 ms average) | $0 | $0 | ~$1.3 | ~$8 | ~105 invocations per MAU [§12][A]; $0.000024/vCPU-s, $0.0000025/GiB-s, $0.40 per 1M requests; free 180k vCPU-s, 360k GiB-s, 2M requests [P] |
| Firestore egress to clients | $0 | $0 | ~$1.8 | ~$4.8 | ~0.5 MB per MAU [§12]; 10 GiB/month free, then $0.12/GB [P] |
| Cloud Storage: photos + photo egress | ~$0.25 | ~$2.4 | ~$12 | ~$24.5 | 200 KB stored and 2 MB egress per MAU [§12]; $0.02/GiB-month, $0.12/GB egress, **no free tier in the EU** [P] |
| Cloud Tasks, Scheduler, Secret Manager, Logging, Artifact Registry (functions images only) | ~$0.3 | ~$0.3 | ~$0.5 | ~$0.5–1 | 3 scheduler jobs free per billing account (staging adds $0.30); Logging 50 GiB/project free; Tasks 1M ops free [P] |
| Firebase Auth (no Identity Platform), FCM, App Check, Hosting (email-link domain and two static pages) | $0 | $0 | $0 | $0 | Auth email links 25,000/day on Blaze; FCM and App Check free; Hosting 10 GB stored and 360 MB/day free [P] |
| **Subtotal** | **~$0.5** | **~$3.5** | **~$23** | **~$55** | |

Staging (`grouper-staging`, Blaze, schedules paused) adds about $1 a month [A].

### 3.2 Google Places (New), D8

The app calls Places directly with a key restricted to the apps (DESIGN §9). A meetup option is one **autocomplete session**: keystroke requests (debounced at 300 ms, at least 3 characters) with a session token, ending in one **Place Details Essentials** call. Session pricing: in a session that ends in Essentials, requests 1–12 are billed as Autocomplete Requests and request 13 onward is free ("Autocomplete Session Usage") [P].

| Driver | Value |
|---|---|
| Sessions per MAU per month | 0.24 = 0.08 meetups per MAU [§12] × 3 options [A] |
| Autocomplete requests per session | 4–6 [A], after debouncing |
| Autocomplete Requests | $2.83 per 1,000 (10,001–100k), $2.27 (100k–500k), $1.70 (500k–1M); first 10,000 a month free [P] |
| Place Details Essentials | $5.00 per 1,000, then $4.00 and $3.00 by volume; first 10,000 a month free [P] |

| | 1k | 10k | 50k | 100k |
|---|---|---|---|---|
| Sessions | 240 | 2,400 | 12,000 | 24,000 |
| Autocomplete Requests (4–6 per session) | free | $0–13 | ~$108–175 | ~$245–355 |
| Place Details Essentials | free | free | ~$10 | ~$70 |
| **Places total** | **$0** | **~$0–13** | **~$120–185** | **~$315–425** |

**Keep the details call on Essentials.** `displayName` and `googleMapsUri` are **Place Details Pro** fields ($17 per 1,000), and a session that ends in Pro or Enterprise fields bills as Enterprise + Atmosphere ($25 per 1,000). The app therefore asks only for `formattedAddress`/`shortFormattedAddress`, `location` and `types`, takes the place name from the prediction (`structuredFormat.mainText`), and builds the map link itself (`googleMapsPlaceUrl(placeId, name)` in `packages/core`) [P].

**Abuse.** The key ships in the app; app restrictions (bundle ID, package name + certificate) raise the bar but can be spoofed. Budgets do not stop spending, so the Places API gets **per-day quota caps** in the Cloud console (start at 3× the expected daily requests [A]) and the €-budget alerts of DESIGN §12.

### 3.3 On-device model distribution (D1)

**Bundled in the app: $0.** `model_q4.onnx` (0.5 MB), `model_q4.onnx_data` (174.0 MB), `tokenizer.json` (32.2 MB) and the small config files ship inside the app (DESIGN §5.1, F32), fetched and sha256-checked at build time; nothing is hosted or downloaded at run time [ODV].

- **App size:** about 210 MB more.
- **Android device storage:** about twice that. The runtime needs a real file path, so the first launch copies the files out of the APK into app storage: ~207 MB in the APK plus ~207 MB copied (~415 MB). Older model folders are deleted before the copy, and the first launch needs ~260 MB free (the copy plus 50 MB headroom).
- **Apple:** above 200 MB the App Store asks before downloading the app on cellular, by default (accepted).
- **Google Play:** the base module limit is 500 MB, so no asset pack is needed.
- **Updates:** every app update that changes the model ships it again; other updates are delta-patched by the stores.

### 3.4 Outside Google Cloud

| Service | Price | Per month | Notes |
|---|---|---|---|
| Apple Developer Program | $99/year [P, secondary source] | ~$8.25 | Required for iOS, TestFlight and Sign in with Apple |
| Google Play registration | $25 once [P] | ~$1 over 24 months | |
| Domain (`.dk`) | Punktum wholesale DKK 72.50/year from 2026-04-01, plus the registrar's margin [P]; ~$15/year [A] | ~$1.25 | One-year terms only from 2026-07-01 |
| Expo EAS | Free: 15 Android + 15 iOS builds a month, low-priority queue. Starter $19/month incl. $45 build credit [P] | $0, then $19 | Starter from the public launch [A]; `eas build --local` stays the fallback; EAS Update is not used (A14) |
| Firebase Auth email links | $0 on Blaze, 25,000/day [P] | $0 | ~0.3 sends per MAU a month [A] |
| FCM | $0 [P] | $0 | ~6 pushes per MAU a month (drop, T−3 d, T−24 h, T−6 h, feedback and its reminder) [A] |
| App Check: Play Integrity, App Attest | $0 [P] | $0 | Play Integrity standard tier 10,000 calls/day, which runs out at about 30–40k DAU with a 1 h token TTL; the free increase is requested at about 15k MAU (DESIGN §9) |
| Hugging Face | $0 [P] | $0 | Build time only: the fetch-model script fetches the pinned files for each native build, and CI fills the EU mirror once per model version; the app never contacts Hugging Face |
| GitHub Actions (private repo) | Linux $0.006/min; Free plan includes $12/month of compute (~2,000 Linux minutes) [P] | $0 | ~1,700 min/month expected (CI ~12 min × ~120 runs + nightly calibration ~10 min) [A]. The nightly calibration download from the GCS mirror costs about $0.65/month in egress |

## 4. Cost over time (months 0–24)

**Assumed growth curve [A]:** months 0–3 closed alpha, up to 1k MAU; month 6: 5k; month 12: 20k; month 18: 50k; month 24: 100k (Aarhus, then Copenhagen, then Denmark). Places at 5 requests per session. EAS Starter from month 4. Interpolated geometrically between the points.

| Month | MAU | Google Cloud (incl. staging) | Places | EAS | Run rate | Cumulative since month 0 |
|---|---|---|---|---|---|---|
| 0 (build) | 0 | ~$1 | $0 | $0 | ~$1 | $140 |
| 1 | 300 | ~$1 | $0 | $0 | ~$1 | $141 |
| 3 | 1,000 | ~$1.5 | $0 | $0 | ~$2 | $144 |
| 6 | 5,000 | ~$3 | $0 | $19 | ~$22 | $208 |
| 9 | 10,000 | ~$4.5 | ~$6 | $19 | ~$29 | $282 |
| 12 | 20,000 | ~$9 | ~$40 | $19 | ~$68 | $555 |
| 15 | 33,000 | ~$16 | ~$84 | $19 | ~$118 | $854 |
| 18 | 50,000 | ~$24 | ~$152 | $19 | ~$194 | $1,348 |
| 21 | 72,000 | ~$38 | ~$253 | $19 | ~$310 | $2,153 |
| 24 | 100,000 | ~$56 | ~$370 | $19 | ~$445 | $3,463 |

"Run rate" excludes the yearly fees; the cumulative column includes them (Apple $99 and the domain in months 0, 12 and 24, Google Play $25 in month 0). Over 24 months the place picker costs about $2,300 and everything on Google Cloud together about $400; the on-device model adds nothing.

## 5. Assumptions to replace with alpha data

| # | Assumption | Where it matters |
|---|---|---|
| A-C1 | 0.08 meetups per MAU a month, ~5 members each [§12] | Places, chat, pushes |
| A-C2 | 3 options proposed per meetup, 4–6 debounced autocomplete requests each | Places (the largest line) |
| A-C3 | ~300 Firestore reads and ~40 writes per MAU a month (§12 base + chat, attendance, votes, pair signals) | Firestore |
| A-C4 | Photos: 200 KB stored, 2 MB egress per MAU a month [§12] | Storage |
| A-C5 | Functions average ~200 ms at gcf_gen1 | Functions |
| A-C6 | `.dk` registrar price ~$15/year | Fixed costs |
| A-C7 | CI stays within GitHub's free compute | GitHub Actions |

## 6. Levers, in order of effect

1. **Places:** keep sessions on Essentials (§3.2); debounce; start autocomplete at 3 characters; consider a short list of "places this pod used before" so later meetups need no search [A].
2. **Photo egress:** thumbnails, device disk cache, JPEG quality 0.7 (DESIGN §12).
3. **Firestore:** single aggregated docs for clients; the concept shortlist before 20k concepts.
4. **No always-on resources:** no `minInstances`, no Vertex endpoints, no Identity Platform (+$275/month at 100k MAU).

## 7. Sources (fetched 2026-11-02 to 2026-11-04)

| Topic | Source |
|---|---|
| Firestore (operations, storage, PITR, backups, vector search, egress) | https://cloud.google.com/firestore/pricing |
| Cloud Run / Functions 2nd gen | https://cloud.google.com/run/pricing |
| Cloud Scheduler | https://cloud.google.com/scheduler/pricing |
| Cloud Tasks | https://cloud.google.com/tasks/pricing |
| Cloud Storage, internet egress | https://cloud.google.com/storage/pricing |
| Artifact Registry | https://cloud.google.com/artifact-registry/pricing |
| Secret Manager | https://cloud.google.com/secret-manager/pricing |
| Cloud Logging | https://cloud.google.com/stackdriver/pricing |
| Firebase (Auth, FCM, Hosting, Storage free-tier regions, Remote Config) | https://firebase.google.com/pricing |
| Firebase Auth limits (email-link sends on Spark and Blaze) | https://firebase.google.com/docs/auth/limits (2026-11-03) |
| App Check, Play Integrity quota | https://firebase.google.com/docs/app-check (2026-11-03) |
| Google Places prices and free caps | https://developers.google.com/maps/billing-and-pricing/pricing (2026-11-02) |
| Places session pricing | https://developers.google.com/maps/documentation/places/web-service/session-pricing (2026-11-02) |
| Places field SKUs (Essentials vs Pro) | https://developers.google.com/maps/documentation/places/web-service/data-fields |
| Expo EAS | https://expo.dev/pricing.md (2026-11-04) |
| Google Play registration | https://support.google.com/googleplay/android-developer/answer/6112435 |
| Apple Developer Program fee (secondary source) | https://studio.adalo.com/blog/apple-developer-program-guide |
| `.dk` domain | https://www.punktum.dk/en/articles/prices-and-fees |
| Hugging Face rate limits | https://huggingface.co/docs/hub/rate-limits |
| GitHub Actions | https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| On-device model sizes [ODV] | On-device EmbeddingGemma 2 research, 2026-11-04 (DESIGN §5.1) |
| App size limits (App Store cellular prompt above 200 MB, Play base module 500 MB) | Research for the bundling decision, 2026-11-04 (DESIGN F32) |
