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
| **Total, model download not on GCS** | **~$12** | **~$15–47** | **~$170–240** | **~$400–510** |
| On-device model download from our EU bucket (GCS) | +~$5 | +~$54 | +~$270 | +~$540 |
| **Total, model download from our EU bucket** | **~$17** | **~$70–100** | **~$440–510** | **~$940–1,050** |

What this means:
- **Below about 7,000 MAU almost everything is free** except the store accounts. The Places free caps (10,000 requests of each kind a month) cover the place picker up to about 7k MAU.
- **Two lines dominate from 10k MAU:** the Places place picker and, if we serve it ourselves, the download of the 175 MB on-device model (D1). Firebase itself stays small.
- **The model download is a choice, not a given** (DESIGN §2.4 Q20): serving it from our EU Google Cloud bucket keeps Google as the only processor but costs about $0.02 per install; Cloudflare R2 or store-hosted asset packs cost about nothing but add a processor or a second code path (§3.3).

## 2. What changed against DESIGN §12 (before round 2)

| Change | Effect at 100k MAU | Why |
|---|---|---|
| **Server embedder retired** (D1): no `embedder` codebase, no 1 GiB instances, no embedder images in Artifact Registry, no `minInstances`/Vertex levers, no global embed budget | −$3–6.50 embedding path, −about $0.10 Artifact Registry; the **$345/month abuse ceiling is gone** | Tags are embedded on the phone; the server only runs `findNearest` in a normal callable |
| **Google Places added** (D8) | +$315–425 | Autocomplete (per request) + Place Details Essentials; free caps 10k/month each |
| **On-device model distribution added** (D1) | +$0 to +$540 | 174.5 MB per new install (plus one re-download per model change); depends on where it is hosted (Q20) |
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

Each install downloads `model_q4.onnx` (0.5 MB), `model_q4.onnx_data` (174.0 MB), `tokenizer.json` (32.2 MB, served gzip-encoded at about 5.5 MB) and the small config and `prototypes.bin` files: **about 180 MB of transfer** [ODV]. Every model change downloads it again for every active user.

| Hosting | Price | 1k | 10k | 50k | 100k | Privacy |
|---|---|---|---|---|---|---|
| **Our EU bucket** (GCS or Firebase Storage, europe-west1; default) | $0.12/GB egress, ~$0.021 per install [P] | ~$5 | ~$54 | ~$270 | ~$540 | Google only; already a processor |
| Firebase Hosting CDN | $0.15/GB after 360 MB/day [P] | ~$6 | ~$65 | ~$330 | ~$670 | Google only |
| Cloudflare R2 | storage only, "no charges for egress bandwidth" [P] | ~$0 | ~$0 | ~$0 | ~$0 | Adds Cloudflare as a processor (sees IP addresses); EU jurisdiction option to verify |
| Play Asset Delivery (on-demand pack) + Apple Background Assets | $0 (store-hosted) | $0 | $0 | $0 | $0 | Stores are already independent controllers; two extra platform code paths; model update tied to app releases |
| Hugging Face CDN | $0; anonymous limit 3,000 resolver calls per 5 min per IP [P] | $0 | $0 | $0 | $0 | **Not recommended**: a US company receiving every user's IP address, a new transfer to document |

Basis: new installs at 25% of MAU a month while growing [A], 180 MB each. A model change for all users at 100k MAU costs about **$2,100 once** on GCS. The bucket cost of storing the files is under $0.01 a month.

### 3.4 Outside Google Cloud

| Service | Price | Per month | Notes |
|---|---|---|---|
| Apple Developer Program | $99/year [P, secondary source] | ~$8.25 | Required for iOS, TestFlight and Sign in with Apple |
| Google Play registration | $25 once [P] | ~$1 over 24 months | |
| Domain (`.dk`) | Punktum wholesale DKK 72.50/year from 2026-04-01, plus the registrar's margin [P]; ~$15/year [A] | ~$1.25 | One-year terms only from 2026-07-01 |
| Expo EAS | Free: 15 Android + 15 iOS builds a month, low-priority queue. Starter $19/month incl. $45 build credit [P] | $0, then $19 | Starter from the public launch [A]; `eas build --local` stays the fallback; EAS Update is not used (A14) |
| Transactional email (Q17) | Brevo (FR, EU) free 300/day; Postmark free 100/month [P] | $0 | ~0.02 emails per MAU a month (inactivity warnings, Art. 34 notices) [A] |
| Firebase Auth email links | $0 on Blaze, 25,000/day [P] | $0 | ~0.3 sends per MAU a month [A] |
| FCM | $0 [P] | $0 | ~6 pushes per MAU a month (drop, T−3 d, T−24 h, T−6 h, feedback and its reminder) [A] |
| App Check: Play Integrity, App Attest | $0 [P] | $0 | Play Integrity standard tier 10,000 calls/day, which runs out at about 30–40k DAU with a 1 h token TTL; the free increase is requested at about 15k MAU (DESIGN §9) |
| Hugging Face | $0 [P] | $0 | Build time only: CI copies the pinned files into the EU mirror once per model version; the app never contacts Hugging Face |
| GitHub Actions (private repo) | Linux $0.006/min; Free plan includes $12/month of compute (~2,000 Linux minutes) [P] | $0 | ~1,700 min/month expected (CI ~12 min × ~120 runs + nightly calibration ~10 min) [A]. The nightly calibration download from the GCS mirror costs about $0.65/month in egress |

## 4. Cost over time (months 0–24)

**Assumed growth curve [A]:** months 0–3 closed alpha, up to 1k MAU; month 6: 5k; month 12: 20k; month 18: 50k; month 24: 100k (Aarhus, then Copenhagen, then Denmark). New installs are 25% of MAU a month. Places at 5 requests per session. EAS Starter from month 4. Interpolated geometrically between the points.

| Month | MAU | Google Cloud (incl. staging) | Places | EAS | Run rate, model not on GCS | Model on GCS | Run rate, model on GCS | Cumulative since month 0, not on GCS / on GCS |
|---|---|---|---|---|---|---|---|---|
| 0 (build) | 0 | ~$1 | $0 | $0 | ~$1 | $0 | ~$1 | $140 / $140 |
| 1 | 300 | ~$1 | $0 | $0 | ~$1 | ~$2 | ~$3 | $141 / $143 |
| 3 | 1,000 | ~$1.5 | $0 | $0 | ~$2 | ~$5 | ~$7 | $144 / $154 |
| 6 | 5,000 | ~$3 | $0 | $19 | ~$22 | ~$27 | ~$49 | $208 / $270 |
| 9 | 10,000 | ~$4.5 | ~$6 | $19 | ~$29 | ~$54 | ~$83 | $282 / $475 |
| 12 | 20,000 | ~$9 | ~$40 | $19 | ~$68 | ~$108 | ~$176 | $555 / $1,010 |
| 15 | 33,000 | ~$16 | ~$84 | $19 | ~$118 | ~$178 | ~$297 | $854 / $1,766 |
| 18 | 50,000 | ~$24 | ~$152 | $19 | ~$194 | ~$270 | ~$464 | $1,348 / $2,969 |
| 21 | 72,000 | ~$38 | ~$253 | $19 | ~$310 | ~$389 | ~$698 | $2,153 / $4,812 |
| 24 | 100,000 | ~$56 | ~$370 | $19 | ~$445 | ~$540 | ~$985 | $3,463 / $7,580 |

"Run rate" excludes the yearly fees; the cumulative column includes them (Apple $99 and the domain in months 0, 12 and 24, Google Play $25 in month 0). Over 24 months the place picker costs about $2,300 and the model download from our bucket about $4,100; everything on Google Cloud together about $400.

## 5. Assumptions to replace with alpha data

| # | Assumption | Where it matters |
|---|---|---|
| A-C1 | 0.08 meetups per MAU a month, ~5 members each [§12] | Places, chat, pushes |
| A-C2 | 3 options proposed per meetup, 4–6 debounced autocomplete requests each | Places (the largest line) |
| A-C3 | New installs = 25% of MAU a month; a model change re-downloads for every active user | Model distribution |
| A-C4 | ~300 Firestore reads and ~40 writes per MAU a month (§12 base + chat, attendance, votes, pair signals) | Firestore |
| A-C5 | Photos: 200 KB stored, 2 MB egress per MAU a month [§12] | Storage |
| A-C6 | Functions average ~200 ms at gcf_gen1 | Functions |
| A-C7 | `.dk` registrar price ~$15/year | Fixed costs |
| A-C8 | CI stays within GitHub's free compute | GitHub Actions |

## 6. Levers, in order of effect

1. **Model hosting (Q20):** R2 or store asset packs take ~$540/month off at 100k MAU; serving from GCS is the simple, single-processor default.
2. **Places:** keep sessions on Essentials (§3.2); debounce; start autocomplete at 3 characters; consider a short list of "places this pod used before" so later meetups need no search [A].
3. **Photo egress:** thumbnails, device disk cache, JPEG quality 0.7 (DESIGN §12).
4. **Firestore:** single aggregated docs for clients; the concept shortlist before 20k concepts.
5. **No always-on resources:** no `minInstances`, no Vertex endpoints, no Identity Platform (+$275/month at 100k MAU).

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
| Transactional email | https://www.brevo.com/pricing/, https://postmarkapp.com/pricing |
| Hugging Face rate limits | https://huggingface.co/docs/hub/rate-limits |
| Cloudflare R2 | https://developers.cloudflare.com/r2/pricing/ |
| GitHub Actions | https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| On-device model sizes and transfer [ODV] | On-device EmbeddingGemma 2 research, 2026-11-04 (DESIGN §5.1) |
