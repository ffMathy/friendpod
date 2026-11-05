# Thin-market simulation

> **This is a synthetic simulation with assumed behaviour.** No real users, interests or outcomes went into it. Every behavioural number (acceptance, show-up, planning success, interest popularity, locations, ages) is an assumption in `tools/sim/src/city.ts` and `tools/sim/src/behaviour.ts`. Read the results as a model of how the matcher's rules interact in a small market, not as a forecast.

| | |
|---|---|
| Date | 2026-11-04 |
| Matcher | `@grouper/core` `matchComponent` (DESIGN.md §6.3) at the scaffold commit that adds this file |
| Harness | `tools/sim` (DESIGN.md §6.9) |
| Runs | n = 100 / 200 / 300 users × 3 variants × seeds 1–3, 12 weekly drops each |

## How to reproduce

```sh
npm ci                                                        # at the repository root
npm run sim:thin-market -- --json out/thin-market.json        # table below; raw runs in tools/sim/out/
npm run sim -- --n 200 --weeks 12 --profile alpha --seed 1 --cohorts 5 --per-week   # one run, full JSON
npm run bench:match -- --n 20000 --concepts 30000 --history 30 [--heap 384]         # n = 20k benchmark
```

All runs are deterministic for a seed (no `Math.random`, no wall-clock limits); only the timing fields change between runs.

## What is simulated

- **City (assumptions).** Home locations from a Gaussian mixture of eight Aarhus neighbourhoods, kept inside the `aarhus` launch area (DESIGN.md §6.4). Ages 18–75, skewed young (18–24: 18%, 25–34: 30%, 35–44: 20%, 45–54: 14%, 55–64: 10%, 65–75: 8%). Age range = the profile default (±7 launch, ±10 alpha); 15% narrow it to an 8-year window. Radius 5/10/15/25 km at 15/45/25/15%. 10% want same-gender pods (gender 52% woman, 45% man, 3% non-binary). Languages: Danish only 70%, Danish + English 22%, English only 8%. Availability: each of the six slots on with 25–75%. 0.5% of users block one random other user.
- **Interests (assumptions).** 3–10 interests per user (mean ~5.3), drawn from 2,000 concepts with a Zipf–Mandelbrot law (s = 1, q = 3; the most popular concept is held by ~20% of users). About 5% of concepts are sensitive; every sensitive holding has consent. Danish/English variants are assumed already merged into concepts. Concept vectors sit in EmbeddingGemma 2's measured band (unrelated pairs cos ≈ 0.77–0.85, research/embedding-calibration), and τ = 0.85 in `sec(u,v)`.
- **Behaviour (assumptions).** Accept = logistic(1.0 + 3·(x − 0.35) − 0.8·d/maxKm), where x is the member's own theme and pair terms of V; this gives a mean invite acceptance of 0.66, inside the 0.6–0.7 range DESIGN.md §6.9 uses. Show-up = r(u). A confirmed pod agrees on an option with probability 0.85. A meetup with fewer than 3 attendees does not count. Three declines in a row pause a user for 2 weeks. A confirmed pod holds an active slot for 2 weeks (4 if kept). Meet-again = 0.25 + 0.5·sec + 0.25·exp(−|Δage|/6) + noise; a pod is kept when ≥ 3 attendees choose Keep.
- **Drop mechanics (from the design).** Pair history (H5 windows from the profile), reliability, waiting priority, dissolved-pod priority, `≤ 1 new pod per drop`, max 2 active pods, S5 eligibility (account ≥ 14 days; the alpha waives the attended-meetup gate for founder-invited testers), S1 density (12), backfill with 2–3 accepted (up to 3 invites from the week's unmatched pool, all constraints re-checked).
- **Variants.** `launch` and `alpha` are the two parameter profiles of DESIGN.md §6.10 with open recruiting. `alpha + 5 seed-theme cohorts` adds the alpha's recruiting rule: every tester also holds one of 5 seed themes (the 5 most popular concepts, kept ordinary).
- **Not implemented in the matcher yet,** so these results are a lower bound with respect to them: `swapBetweenNearbyPods` and `moveMember` (Phase 2), confirmed soft links and the H5 relaxation (Phase 3). "Open to anyone" (Q12) is implemented and drives most alpha pods.

## Results

Mean over 3 seeds, with the min–max range in brackets. "Match rate" is proposed ÷ opted in per drop (DESIGN.md §6.8). "Confirmation" is confirmed ÷ proposed pods. "Weeks to first pod" counts drops until a user's first confirmed pod (1 = the first drop); ">12" means the percentile falls on users never matched in 12 weeks. "Never matched" users are split by the dominant reason code of their unmatched weeks; "proposed, never confirmed" are users who got proposals that never confirmed.

| n | variant | match rate | invite accept | confirmation | proposals of 6 | wks to 1st pod P50 | P90 | never matched | …same-gender | …sensitive-only | …age | …language | …no shared theme | …proposed, never confirmed | match ms/week (max) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 100 | launch | 2% [1%–3%] | 66% [51%–75%] | 19% [0%–33%] | 0% [0%–0%] | 3/3 >12 | 3/3 >12 | 97% [95%–100%] | 5% [2%–11%] | 0% [0%–0%] | 39% [32%–51%] | 3% [2%–3%] | 18% [12%–26%] | 5% [0%–13%] | 7.6 [4.0–14.4] |
| 100 | alpha | 21% [18%–24%] | 64% [62%–70%] | 37% [29%–47%] | 11% [7%–15%] | 1/3 >12 (11.0, 9.0) | 3/3 >12 | 49% [44%–53%] | 4% [1%–8%] | 0% [0%–0%] | 16% [14%–18%] | 2% [1%–3%] | 6% [3%–8%] | 11% [8%–15%] | 6.3 [5.0–8.0] |
| 100 | alpha + 5 seed-theme cohorts | 23% [22%–24%] | 65% [63%–66%] | 30% [26%–33%] | 3% [0%–6%] | 2/3 >12 (9.0) | 3/3 >12 | 51% [49%–53%] | 7% [7%–8%] | 0% [0%–0%] | 14% [13%–16%] | 3% [1%–5%] | 0% [0%–0%] | 18% [16%–20%] | 7.2 [6.6–7.9] |
| 200 | launch | 5% [5%–5%] | 69% [59%–75%] | 43% [21%–60%] | 2% [0%–7%] | 3/3 >12 | 3/3 >12 | 79% [73%–90%] | 8% [6%–11%] | 0% [0%–0%] | 29% [25%–34%] | 5% [2%–8%] | 8% [4%–11%] | 5% [2%–12%] | 8.8 [8.3–9.4] |
| 200 | alpha | 29% [27%–31%] | 64% [61%–66%] | 35% [32%–38%] | 13% [8%–22%] | 7.3 [6.0–9.0] | 3/3 >12 | 38% [35%–46%] | 6% [5%–8%] | 0% [0%–0%] | 8% [5%–12%] | 2% [2%–3%] | 1% [1%–2%] | 12% [12%–14%] | 10.0 [6.5–14.8] |
| 200 | alpha + 5 seed-theme cohorts | 36% [32%–38%] | 65% [64%–67%] | 35% [32%–38%] | 6% [4%–7%] | 5.0 [4.0–6.0] | 3/3 >12 | 33% [32%–35%] | 8% [7%–10%] | 0% [0%–0%] | 5% [3%–8%] | 2% [2%–3%] | 0% [0%–0%] | 11% [9%–14%] | 11.2 [9.9–13.8] |
| 300 | launch | 11% [10%–13%] | 69% [68%–70%] | 35% [27%–40%] | 2% [2%–3%] | 3/3 >12 | 3/3 >12 | 69% [68%–71%] | 7% [6%–8%] | 0% [0%–1%] | 25% [23%–26%] | 4% [2%–5%] | 3% [2%–4%] | 10% [8%–14%] | 10.4 [7.8–12.7] |
| 300 | alpha | 34% [33%–35%] | 65% [64%–66%] | 39% [35%–41%] | 12% [11%–14%] | 5.7 [5.0–7.0] | 3/3 >12 | 29% [27%–33%] | 7% [5%–8%] | 0% [0%–0%] | 6% [6%–7%] | 1% [1%–2%] | 0% [0%–1%] | 8% [7%–10%] | 16.5 [12.0–25.4] |
| 300 | alpha + 5 seed-theme cohorts | 42% [41%–44%] | 65% [64%–67%] | 35% [33%–36%] | 8% [6%–8%] | 4.3 [4.0–5.0] | 3/3 >12 | 28% [25%–32%] | 7% [5%–9%] | 0% [0%–0%] | 2% [1%–3%] | 1% [1%–1%] | 0% [0%–0%] | 13% [11%–14%] | 16.7 [12.1–19.0] |

Proposal sizes and confirmation by size (pooled over the 3 seeds):

| n | variant | proposals 4 / 5 / 6 | confirmed: of 4 / of 5 / of 6 | open-to-anyone share of proposals | confirmed pods rescued by backfill | sensitive-themed proposals (3 seeds) | meetup happened | kept (2nd meetup) |
|---|---|---|---|---|---|---|---|---|
| 100 | launch | 75% / 25% / 0% | 8% / 25% / – | 44% | 0% | 0 | 100% | 100% |
| 100 | alpha | 69% / 20% / 11% | 26% / 55% / 67% | 85% | 33% | 3 | 74% | 34% |
| 100 | alpha + 5 seed-theme cohorts | 84% / 14% / 3% | 26% / 44% / 80% | 45% | 19% | 0 | 81% | 34% |
| 200 | launch | 83% / 14% / 2% | 37% / 77% / 50% | 30% | 26% | 0 | 66% | 63% |
| 200 | alpha | 66% / 21% / 13% | 24% / 43% / 78% | 68% | 27% | 10 | 72% | 32% |
| 200 | alpha + 5 seed-theme cohorts | 75% / 19% / 6% | 26% / 57% / 74% | 27% | 26% | 0 | 67% | 54% |
| 300 | launch | 81% / 17% / 2% | 28% / 56% / 86% | 28% | 19% | 0 | 70% | 43% |
| 300 | alpha | 67% / 20% / 12% | 28% / 52% / 73% | 59% | 24% | 14 | 72% | 43% |
| 300 | alpha + 5 seed-theme cohorts | 70% / 22% / 8% | 24% / 54% / 79% | 24% | 24% | 0 | 71% | 49% |

For comparison, with independent acceptance p = 0.65 the share of proposals reaching 4 accepts is 18% for 4 invitees, 43% for 5 and 65% for 6. The simulated rates are a little higher because backfill rescues 19–33% of confirmed pods.

## Interpretation

1. **The launch defaults do not work for 100–300 users.** Match rate is 2–11% and 69–97% of users get no confirmed pod in 12 weeks. The binding constraints are age (±7 years, mutual) and the lack of a shared theme. This is the gap the alpha profile was designed for (A26).
2. **The alpha profile multiplies the match rate by 3–10** (21–34%), almost entirely through "open to anyone": 59–85% of alpha proposals use that theme. Seed-theme cohorts cut that reliance to 24–45% and lift the match rate further (23–42%).
3. **Time to first pod misses the M1 exit criterion (P50 ≤ 3) under these assumptions.** Best case is 4.3 weeks (alpha + cohorts, n = 300), then 5.0 (n = 200); at n = 100 the median is 9–11 weeks or not reached at all. A first *proposal* comes sooner (P50 1–4 weeks with cohorts), so the delay is mainly confirmation.
4. **Confirmation misses the M1 exit criterion (≥ 40%) because most proposals have only 4 invitees.** 66–84% of alpha proposals have 4 members, and a 4-member proposal needs every invitee to accept (24–28% confirm, against 67–80% for 6). The "6 whenever 6 are compatible" rule rarely binds: in a thin market, six people who are pairwise compatible on age, radius, language, availability and pair history are rare. DESIGN.md's "about 54% at 60% acceptance with 6-person proposals" assumes 6-person proposals; the simulated mix gives 30–39%.
5. **28–51% of alpha testers get no confirmed pod in 12 weeks** (P90 is never reached). The largest causes are proposals that never confirm (8–18%), age (2–16%) and same-gender pools (4–8%). Language is minor (1–3%). "Sensitive-only" is 0% because every synthetic user also has ordinary interests.
6. **Sensitive themes almost never form at this size,** as intended: S1 needs 12 eligible consenting holders of the same concept within 25 km. A few sensitive-themed proposals appear only when a sensitive concept happens to be among the most popular (alpha, seeds 2–3); the launch profile's attended-meetup gate (S5) blocks them in the first weeks.

What would move the M1 numbers, to test here before M1: stronger cohorting (fewer, larger seed themes, or recruiting by neighbourhood), an availability-aware `grow` that keeps more candidates alive, inviting 5–6 whenever the pool allows, and a softer age default. Each is a product decision; the harness can rank them once the founder picks candidates.

## matchComponent at n = 20,000

Synthetic component: 20,000 users in the Aarhus area, 30,000 concepts (§6.4 expects 20–40k), 30 pair-history entries per user, launch profile. The bench writes the gzipped input snapshot exactly as `dropOrchestrator` would (§6.5), then decodes and matches it in a fresh Node 24 process. Hardware: the shared sandbox (Intel Xeon @ 2.30 GHz, 4 vCPU; the matcher itself is single-threaded), not Cloud Run.

| | Node default heap | `--max-old-space-size=384` |
|---|---|---|
| Snapshot size (JSON / gzip) | 64.0 MB / 19.9 MB | same |
| Decode (gunzip + JSON.parse + zod validation) | 3.1 s | 2.4 s |
| `matchComponent` | 2.1 s | 2.0 s |
| Peak RSS (whole process) | 812 MB | 627 MB |
| Eligible / matched | 19,004 / 14,512 (76%) | same |
| Pods (4 / 5 / 6) | 2,772 (699 / 722 / 1,351) | same |
| Local-search moves evaluated | 2.58 M (budget 20 M) | same |

- **Runtime is far inside the 1,800 s task limit,** even allowing a several-fold slowdown on 1 Cloud Run vCPU. The move budget, not a clock, bounds local search, so a retry on a slower instance gives the same pods (the two runs above produced identical results).
- **Memory fits 1 GiB, but decoding, not matching, sets the peak.** The matcher's own structures add about 35 MB; the rest is the decompressed JSON, the parsed objects and zod's validated copy. With an explicit heap cap (as Node applies inside a memory-limited container) the peak is 627 MB. Recommendation for the `matchComponent` task: keep 1 GiB, set `NODE_OPTIONS=--max-old-space-size=512`, and if memory gets tight, verify the snapshot's `inputHash` instead of re-validating the trusted server-written file with zod.
- Still open for M0: the n = 50k benchmark (§6.4 sharding threshold) and the same run on Cloud Run.

## Caveats

- Every behavioural constant is a guess; the conclusions above are about mechanics (pod-size mix, which constraints bind), which are less sensitive to the guesses than the absolute rates.
- Interest popularity is the biggest unknown. Real tags fragment more than a 2,000-concept Zipf law (§5.3: ~163 clusters for 68 true concepts at τ 0.93), which would make the launch results worse and make cohorts and "open to anyone" more important.
- Not modelled: reschedule rounds, late cancellations, reports and sanctions, manual participation, repeated Keep loops, re-plans after blocks, and users joining over time (everyone joins before week 1).

## All four levers (founder decision Q19, 2026-11-05)

The founder chose all four alpha levers: (a) seed-theme cohorts, (b) prefer 5–6 invitees, (c) default age range ±13 instead of ±10, (d) a pod confirms at 3 accepts instead of 4. Same synthetic city and behaviour as above, alpha profile, 5 seed-theme cohorts, seeds 1–3, 12 weeks. The simulator now honours the profile's `confirmationMin` (it was hard-coded to 4 before).

| Testers | Levers | Match rate | Confirmation | Never matched in 12 weeks | Weeks to first pod (P50, per seed) | Meetup happened |
|---|---|---|---|---|---|---|
| 100 | a | 23% | 30% | 51% | –, –, 9 | 81% |
| 100 | a+b+c | 27% | 30% | 49% | 9, 10, 11 | 67% |
| 100 | **a+b+c+d** | 22% | **70%** | **37%** | **6, 5, 4** | 59% |
| 200 | a | 36% | 35% | 33% | 4, 6, 5 | 67% |
| 200 | a+b+c | 38% | 38% | 29% | 5, 4, 4 | 68% |
| 200 | **a+b+c+d** | 34% | **73%** | **24%** | **3, 3, 3** | 54% |
| 300 | a | 42% | 35% | 28% | 5, 4, 4 | 71% |
| 300 | a+b+c | 45% | 38% | 24% | 4, 3, 4 | 68% |
| 300 | **a+b+c+d** | 40% | **76%** | **19%** | **3, 2, 3** | 53% |
| 500 | a | 50% | 42% | 18% | 3, 3, 3 | 71% |
| 500 | **a+b+c+d** | 47% | **79%** | **12%** | **2, 2, 2** | 56% |
| 1,000 | a | 57% | 50% | 11% | 2, 2, 2 | 72% |
| 1,000 | **a+b+c+d** | 56% | **84%** | **6%** | **1, 1, 2** | 56% |

- **(d) is the lever that matters.** Confirming at 3 roughly doubles the confirmation rate and brings the first pod to about 3 weeks at 200–300 testers. Both M1 exit targets (confirmation ≥ 35–40%, first pod P50 ≤ 3–5 weeks) are met from about 200 testers per city.
- **The price of (d):** more pods start with only 3 people, so more meetups fall through (53–59% happen, against 67–81% without it), because the sim cancels a meetup when fewer than 3 show up. The attendance nudges (D5) and the extension round (D7) are not modelled and should help here.
- **(b) changed nothing measurable:** the alpha already proposes 6 whenever 6 compatible people exist; the limit is how many compatible people there are, not the preference.
- **(c) helps a little** (2–4 points less never-matched) at the cost of wider age spans in pods.
- **Per city:** each launch city is its own pool, so these numbers apply per city. Five cities at once need about 200–300 testers *each* (1,000–1,500 total), concentrated rather than spread thinly.
