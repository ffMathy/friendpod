# Grouper: go-to-market plan

| | |
|---|---|
| Status | Draft for founder review |
| Date | 2026-11-05 |
| Companions | [OVERVIEW.md](./OVERVIEW.md), [DESIGN.md](./DESIGN.md) §6.10 (alpha profile), [COSTS.md](./COSTS.md), [research/thin-market-sim.md](../research/thin-market-sim.md) |
| Launch cities | Copenhagen, Aarhus, Odense, Aalborg, Vejle |

Contact details, group names and sizes were found by web research on 2026-11-05. Facebook and Instagram groups cannot be inspected without logging in, so sizes and posting rules are unverified unless stated. Check every entry by hand before contacting it. **(U)** marks an entry whose URL or existence could not be confirmed.

---

## 1. The plan in one page

1. **Each city opens only when it is dense enough.** About **250 sign-ups per city** [A], concentrated around a few starter interests. The simulation says that at 200–300 testers per city, with all four alpha levers (Q19), about three in four proposed pods confirm and a first pod comes after a median of about 3 weeks. At 100 it is about 5 weeks and many testers wait in vain.
2. **People install now and wait inside the app.** After sign-up and onboarding, a waitlisted city shows its own screen: a live counter ("Odense: 186 of 250"), a share link and what happens next. It stays until the city opens, then a push says "Odense is open. Your first drop is Thursday at 18:00". People who are already onboarded are ready on day one. That answers the risk of a web-only list, where nobody has the app when the city opens.
3. **Recruit through communities, not ads.** Start with four channels, because each brings people who want new friends and fit a starter interest:
   - new dads (§4);
   - newcomers to the city (§5);
   - students and young professionals (§6);
   - hobby hubs (§7).
4. **Make the first drop and the first meetup succeed:**
   - starter-interest cohorts;
   - "open to meet anyone" on by default;
   - **first-timers first** in matching;
   - a pod confirms at 3;
   - partner venues for the first meetups.
5. **Measure the funnel from day one** (§9) and judge every channel on how many people reach a second meetup, not on sign-ups.
6. **Municipalities come later.** After 3–6 months of data in one city, offer that municipality a paid pilot (§8).

## 2. City rollout

| City | Expected order | Why | Main channels |
|---|---|---|---|
| Aarhus | 1st | Strongest hubs: Dokk1, Spilcaféen ×2, Boulders ×4, Studenterhus, International Community Aarhus | Dads (Fars Legestue at Dokk1), students, newcomers |
| Copenhagen | 1st–2nd | Biggest pool, but spread out; aim for one or two areas first (e.g. Nørrebro, Vesterbro, Østerbro) [A] | Newcomers (Copenhagen Expat Meetup, International House), dads (very few dads' groups) |
| Odense | 2nd | New Spilcaféen branch (opened late 2025), SDU, International House Odense with Welcome Day | Students, newcomers, board games |
| Aalborg | 2nd–3rd | Spilcaféen, Boulders, AAU (UniRun, about 900 runners), International House North Denmark | Students, newcomers |
| Vejle | Last | The thinnest hobby scene, but the best municipal newcomer service | Newcomers (tilflytterservice), library and Spinderihallerne |

All five open on the waitlist. A city opens when it reaches its goal (`areas/{areaId}.goal`, default 250 [A]). Ads and events go to the city closest to its goal, not to all five at once.

**City links.** Every city has a share link, `https://<hosting domain>/c/<city>`, which explains the app and links to the App Store and Google Play. Links carry no personal data and no referral tracking.

## 3. Starter interests per cohort

Use about 5 starter interests per city, so the first pods form around them [SIM]:

| Starter interest | Why | Where the people are |
|---|---|---|
| New dads / far på barsel | Few groups exist; Copenhagen ran only one dads' group in 2020, against 1,376 mothers' groups | §4 |
| Board games | Easy, low-pressure meetups in a café | Spilcaféen, Bastard Café, board game meetups |
| Running | A social run is a meetup format already | Social run crews, university running clubs |
| Climbing / bouldering | Gyms are social, and cafés are attached | Boulders, Beta Boulders, local climbing clubs |
| New in the city | The most motivated audience | §5 |

## 4. New dads

**Facebook and Instagram are not where to start.** Searches found no dad-specific Facebook group with a visible name, size or rules; they exist behind login. The real hubs are offline and run by organisations.

**Organisations (highest leverage first):**

| Organisation | What | Contact | Notes |
|---|---|---|---|
| Far for livet (Forum for Mænds Sundhed) | Runs 56 Fars Legestuer (dads' drop-in playgroups) across Denmark, in all five cities | farforlivet.dk, Kontakt@farforlivet.dk, 23 37 86 97 (Sarah, project lead), 23 60 98 84 (Frederik), facebook.com/farforlivet | One partnership reaches every Legestue. Pitch pods as the weekly follow-on for dads who meet at a Legestue |
| Foreningen Far | About 50 fædregrupper (dads' groups) in Copenhagen, Aarhus, Aalborg, Odense and online; "Gåture for fædre" (walks for fathers) | foreningenfar.dk/kontakt, fundraising@foreningenfar.dk (partnerships), facebook.com/foreningenfar.dk, instagram.com/foreningenfar | Offer the app as a tool for their groups, not a competitor |
| Fædretræf | Free 7-meeting courses for 6–14 dads, by municipality | faedretraef.dk/kontakt-os | Supported by Sundhedsoplysning.dk |
| Municipal health visitors (sundhedspleje) | Form the parents' groups | Copenhagen: kk.dk barsels- og mødregrupper page; Vejle: ashhu@vejle.dk | Copenhagen offers dad-only or mixed groups on request since 2023 |

**Local Fars Legestuer:**

| City | Where and when | Contact |
|---|---|---|
| Copenhagen N | Støberiet, Blågårds Plads 5, Mondays 11–14 | facebook.com/groups/51623911631 (members only) |
| Copenhagen Ø | Boldklubben Skjold, P.H. Lings Allé 10, Thursdays 10–13 | Jan Sørensen, js@bkskjold.dk, 31 90 49 56 |
| Copenhagen (others) | Ørstedsparken, Sundby Torv, Øselgade, Vanløse, Frederiksberg | Each has a page on farforlivet.dk/aktiviteter |
| Aarhus | Dokk1, Thursdays 12–14:30 (closed weeks 27–32) | Health visitor Dorthe 51 57 51 44, pedagogue Mikael 23 61 06 18 |
| Odense | Bolbro Brugerhus, Stadionvej 50, entrance L, Mondays 12–15 | facebook.com/farslegestueodense |
| Aalborg | Nordkraft, 5th floor, Fridays 12–14:30 | Brian Rohde, 9931 6999 |
| Vejle | Bryggen children's library, Søndertorv 2, Wednesdays 11–13 (closed in July) | Library: Marie Gorm, magor@vejlebib.dk; health visitor: Asha Hussein, ashhu@vejle.dk |

The Nørrebro Legestue has been closed since autumn 2025.

**Other dad-adjacent channels:**
- Barselshuset "Fars Fredag", Aarhus **(U)**.
- På barsel med FOF Aarhus (facebook.com/paabarselmedFOFAarhus).
- Barselsakademiet KBH (facebook.com/barselsakademi).
- Barsel i København – Børn i byen, a media outlet, so expect paid placement.
- On Instagram, search #farpåbarsel, #farsel and #barselsfar.

**The approach:**
1. Email Far for livet and Foreningen Far first, with one page: what the app does, that it is free, and an offer to run the first pods for their dads.
2. Visit a Legestue in Aarhus and in Odense once, as a person, with a flyer and QR code to the city link.
3. Run a pod for dads on leave yourself in the first city ("Tuesday walk with prams, four places left") and post about it afterwards.

## 5. Newcomers to the city

The most motivated audience. Two groups need different channels: **internationals** (English) and **Danes moving within Denmark** (tilflyttere, Danish). No Danish-language "Ny i Aarhus"-style Facebook group showed up in search, so search Facebook directly.

| City | Channel | Contact / notes |
|---|---|---|
| Copenhagen | Copenhagen Expat Meetup (Meetup, about 7,800 members) | meetup.com/copenhagen_expat_meetup. Free event every other week at the Main or Nørrebro library; organiser Maria Depesova. A strong co-host |
| Copenhagen | International House Copenhagen | ihcph.kk.dk. "Welcome to Copenhagen" events every other month, International Café, Welcome Ambassadors |
| Copenhagen | InterNations Copenhagen (about 30,800 members) | internations.org; volunteer Ambassadors |
| Copenhagen | Expats in Copenhagen and similar Facebook groups **(U)** | Ask admins first |
| Copenhagen | r/copenhagen (about 189,000), r/Denmark | Answer "moving to Copenhagen" threads as the founder; no ads |
| Copenhagen | KU Dual Career and Spouse Network | ism.ku.dk/dual-career |
| Aarhus | International Community Aarhus (about 100 free events a year) **(U: domain)** | The best co-host in Aarhus |
| Aarhus | International Aarhus (municipality) | international.aarhus.dk. Newcomers' Info Evenings, Welcome Buddy Programme, Aarhus City Welcome at Dokk1 with an exhibitor "Information Bazaar" (2026 edition was 19 Sep; aim for 2027) |
| Aarhus | AU Expat Partner Programme, Aarhus Explorers | internationalstaff.au.dk/expatpartnerprogramme |
| Aarhus | Aarhus Internationals (Facebook, about 15,000, dated) **(U)**, r/Aarhus, InterNations Aarhus | |
| Odense | International House Odense | odense.dk/ico, internationalcommunity@odense.dk, +45 63 75 60 40. Community Cafés, Talk & Connect, International Welcome Day with an exhibitor page |
| Odense | Internationals in Odense (Facebook) **(U)**; Odense International Board Games Group, Thursdays 19:00 at Papas Papbar **(U)** | |
| Aalborg | International House North Denmark | ihnd.dk, info@ihnd.dk, +45 99 31 15 30. Internationals' Fair each September, Culture Companions |
| Aalborg | Spouse Space (IHND) | pernille.vigso@aalborg.dk |
| Aalborg | International Network Aalborg (facebook.com/groups/355548414515238), Xpat Network North (facebook.com/groups/XpatNetworkNorth), AAU+1 Spouse and Partner Network | |
| Vejle | Tilflytterservice / Ny i Vejle | **Newcomer guide Louise Nielsen, +45 21 81 04 36, bosaetningsguide@vejle.dk**. Welcome evenings in Danish and English each September, Connect & Learn evenings |
| Vejle | Internationals in Vejle (facebook.com/groups/1525768524354139), Spouse House Vejle (facebook.com/groups/spousehousevejle), The Better Halves Club (WhatsApp, 200+, first Thursday of the month at Café BRYG; Claire Salvetti, +45 52 82 69 45) | |
| Vejle | Spinderihallerne communities (Together Vejle, Curious Minds) | spinderihallerne.dk/en/communities |
| National | Work in Denmark spouse programme, lifeindenmark.borger.dk, JCI Denmark (650+ members aged 20–39), The International (the-intl.com), The Copenhagen Post | Media can be pitched for stories |

**The approach:**
1. **Gatekeepers first.** Vejle's newcomer guide, International House Odense, IHND and International Community Aarhus all run free newcomer events and look for activities to point people to. Offer a "join a 5-person group" slot or flyer at their events, and ask for exhibitor spots at the 2027 welcome fairs.
2. **Co-host with Meetup organisers.** Big mixers can use pods to split into small tables, which shows what the product does.
3. **Spouse and partner networks fit best.** Accompanying partners are isolated and often free in the daytime, so offer daytime pods.
4. **Danish tilflyttere:** ask each municipality's tilflytter or bosætning staff whether a flyer can go into their welcome material.

## 6. Students and young professionals

**Why they help:**
- **Density.** Thousands of people in one place, at the same life stage, with similar schedules. That is exactly what fills a city's pool quickly.
- **They are looking.** New students, exchange students and people in their first job in a new city are actively trying to make friends, especially in the first months.
- **They share.** The waitlist's share link spreads fastest in groups that already talk to each other.
- **Fixed moments.** Intro weeks (rusuger) in late August and early February give two big recruitment windows a year.

**Things to watch:**
- Students often form their own circles quickly, so the pull is strongest in the first semester and for internationals and master's students who arrive alone.
- Keep the age range in mind. The alpha default is ±13 years, so a 21-year-old will usually meet people up to their mid-thirties.

**How to get started:**
1. Pick one university per city.
2. Contact the student house and the student union, not the university administration:
   - Copenhagen: Studenterhuset, CBS Students;
   - Aarhus: Studenterhus Aarhus;
   - Odense: Studenterhus Odense;
   - Aalborg: Studentersamfundet;
   - Vejle: UCL Events Vejle on Facebook.
3. Ask for three things:
   - a poster and QR code in the bar;
   - a mention in the intro-week material, through the rusvejledere (intro-week tutors);
   - a one-off "find your pod" evening.
4. Use existing social formats: "Run for Friendship" at Studenterhus Aarhus (Tue/Thu 17:00) and AAU's UniRun.
5. For young professionals:
   - IDA networks (which run board game nights);
   - JCI chapters (aged 20–39);
   - Djøf;
   - newcomer channels, because many of them are new to the city.

| City | Student channels |
|---|---|
| Copenhagen | Studenterhuset (studenterhuset.com), CBS Students (cbsstudents.dk), KU, DTU, ITU, Erhvervsakademi København (ek.dk) |
| Aarhus | Studenterhus Aarhus (studenterhusaarhus.dk), AU, VIA, Erhvervsakademi Aarhus |
| Odense | Studenterhus Odense (studenterhus.dk), SDU, UCL |
| Aalborg | Studentersamfundet (studentersamfundet.dk), Studenterhuset (studenterhuset.dk), AAU, UCN |
| Vejle | StudyIn Vejle (studyin.vejle.dk), UCL Vejle ("UCL Events Vejle" on Facebook), SDU Vejle (new IT/STEM programmes from 2026) |

## 7. Hobby hubs

**What we ask for, what they get:**

| We ask | They get |
|---|---|
| A poster with a QR code to the city link, near the counter | Customers: pods suggested at their venue as a meetup place |
| Permission to suggest them as a meetup spot | Groups of 4–6 arriving on quiet weekday evenings |
| Optionally, host a launch "pod night" | Free promotion in our posts, and a regular stream of new faces |

**How to approach them:**
1. Start with chains: **Spilcaféen** (Aarhus ×2, Odense, Aalborg, Kolding near Vejle) and **Boulders** (11 gyms). One yes covers several cities.
2. Visit independents in person on a quiet afternoon with a printed poster. Ask the owner, not the staff on shift.
3. Offer a launch night in the first city (for example a board game evening at Spilcaféen Aarhus), and use photos from it for posts and press.
4. Follow up with numbers after a month: how many pods suggested their venue.
5. Never ask for money or exclusivity.

**Contact list:**

| City | Place | Type | Contact |
|---|---|---|---|
| Copenhagen | Bastard Café (Huset, Valby Kulturhus, Nørrebro) | Board games | bastardcafe.dk |
| Copenhagen | Beta Boulders (Sydhavn, Vanløse, Østerbro) | Bouldering, Friday bars | betaboulders.com |
| Copenhagen | Boulders (Sydhavn, Valby, Vanløse, Amager, Hvidovre) | Bouldering | boulders.dk/kontakt, 72 10 00 19 |
| Copenhagen | Dansk Bjerg- og Klatreklub (Blocs & Walls) | Climbing club | dbkk.dk |
| Copenhagen | Mikkeller Running Club (Mon/Wed from Warpigs) | Social run | mikkeller.com/mrc, IG @mrccopenhagen |
| Copenhagen | Mad & Kaffe Running (Fri 7:00) | Social run | mkrunning.dk |
| Copenhagen | GRØD Social Runners (1st/3rd Sunday) | Social run | groed.com |
| Copenhagen | Folkehuset Absalon | Running club + fællesspisning (communal dinners) | absaloncph.dk |
| Copenhagen | parkrun (Amager Fælled, Fælledparken, Amager Strandpark, Damhusengen) **(U)** | 5 km, Saturdays 9:00 | Event directors |
| Copenhagen | Københavns Hovedbibliotek | Library | bibliotek.kk.dk/hovedbiblioteket |
| Copenhagen | Ungdomshuset Folkekøkken | Community kitchen | ungdomshuset.dk |
| Copenhagen | Labitat | Hackerspace | labitat.dk |
| Aarhus | Spilcaféen (Vestergade 58A, Fredensgade 38) | Board games | aarhus@spilcafeen.dk, IG @spilcafeen |
| Aarhus | Boulders (City, Nord, Syd, Aaby) | Bouldering | boulders.dk/kontakt |
| Aarhus | Run for Friendship (Studenterhus Aarhus) | Social run | studenterhusaarhus.dk |
| Aarhus | RUNAAR **(U)** | Social running crew | runningcrews.com/crews/runaar |
| Aarhus | Aarhus 1900 Atletik & Løb | Running club | aarhus1900.dk |
| Aarhus | Dokk1 / Aarhus Bibliotekerne | Library | dokk1.dk, aakb.dk/arrangementer |
| Aarhus | Open Space Aarhus | Maker space | osaa.dk |
| Odense | Spilcaféen (Slotsgade 26A, new) | Board games | odense@spilcafeen.dk |
| Odense | Boulders Odense City | Bouldering | boulders.dk/kontakt |
| Odense | Odense Klatreklub | Climbing club | odenseklatreklub.dk |
| Odense | Odense Running Crew | Social run | runningcrews.com/crews/odense-running-crew |
| Odense | Odense Atletik | Running club | odenseatletik.dk |
| Odense | Odense Centralbibliotek | Library | odensebib.dk |
| Aalborg | Spilcaféen (Bredegade 3) | Board games | aalborg@spilcafeen.dk |
| Aalborg | Dice 'N Drinks **(U)** | Board games | Sankelmarksgade |
| Aalborg | Boulders Aalborg | Bouldering | boulders.dk/kontakt |
| Aalborg | Aalborg Klatreklub | Climbing club | aalborgklatreklub.dk |
| Aalborg | Aalborg Atletik | Running club | aalborgatletik.dk |
| Aalborg | Aalborg Hovedbibliotek | Library | aalborgbibliotekerne.dk/hovedbiblioteket |
| Aalborg | Hal9k | Hackerspace | hal9k.dk |
| Vejle | Spinderihallerne | Community and culture hub | spinderihallerne.dk |
| Vejle | Vejle Bibliotek (moving to Engen Kulturhus, expected Dec 2026; hiring a young-adult programme officer) | Library | vejlebib.dk |
| Vejle | Fra Hånden | Ceramics café | visitdenmark.com listing |
| Vejle | Vejle Idrætshøjskole | Sports folk high school | vih.dk |
| Vejle | Spilcaféen Kolding (about 25 km away) | Board games | kolding@spilcafeen.dk |

Vejle has no board game café, bouldering gym or social run crew that the research could find, so lean on the library, Spinderihallerne and the newcomer service there.

## 8. Municipalities (after the alpha)

Boblberg shows the model: free for citizens, and municipalities subscribe because loneliness is a public-health problem. Published examples are Brønderslev at 84,000 DKK a year (two-year trial) and Herning at 166,000 DKK a year, both 2019–2023.

**Our pitch: from posts to people meeting.** We can report what Boblberg can't:
- pods confirmed;
- meetups that happened;
- groups that met again.

Municipalities only get aggregate numbers, with counts under 10 suppressed, so no personal data is shared.

**The path:**
1. Run the alpha in one city.
2. Measure for 3–6 months.
3. Offer that municipality a paid pilot with a short notice period.
4. Use it as the reference for the next municipalities.

Pitch the health-prevention, elderly-care and integration departments, the health visitors (for dads) and the libraries. This would be the first revenue, and changes F12 ("free for now"); decide when we get there.

**Grants** need a non-profit or civil-society partner (for example the Social and Housing Agency's grant calendar and municipal loneliness pools). Pairing with an association such as Foreningen Far is the usual route.

## 9. Funnel from day one

Counted per city and ISO week, without any analytics SDK. The counters are uid-free aggregates, each user counts once per stage, and counts under 10 are suppressed.

| Stage | Question it answers |
|---|---|
| Signed up | Did the channel bring people? |
| Onboarded | Is onboarding too long? |
| Waitlisted | How full is the city? |
| City live (first drop eligible) | |
| First proposal | Does matching find them? |
| First confirmed pod | Do pods form? |
| First meetup happened | Do people actually meet? |
| Second meetup | **The north-star metric: did a group keep going?** |

Ask every new user one optional question in onboarding, "Where did you hear about Grouper?" (dads' group, newcomer event, university, café/gym poster, friend, social media, press, other) [A]. This is the only way to compare channels without tracking links. It is aggregated per city and week like the funnel.

## 10. Keeping people from uninstalling

1. **Waiting happens in the app, with progress.** The waitlist screen shows the counter, share link and "add a few more interests", and the opening push brings people back.
2. **The first drop is almost certain:**
   - starter-interest cohorts;
   - "open to meet anyone" on by default;
   - **first-timers first** in matching;
   - confirmation at 3.
3. **The first meetup succeeds:**
   - partner venues;
   - attendance nudges;
   - "hasn't confirmed";
   - the meetup chat.
4. **"Keep pod" is the long-term hook.** A group that meets twice keeps the app.
5. **Few, meaningful notifications only.**
6. **The app-size risk.** The bundled model adds about 210 MB (about 415 MB on Android). Weekly apps are the first to go when storage runs out. If the funnel shows uninstalls between waitlist and opening, move the model to an on-demand download hosted by the app stores.

## 11. Budget: 3,000 DKK

| Item | Amount [A] | Purpose |
|---|---|---|
| Posters and flyers with QR codes for hobby hubs, libraries and Legestuer in the first city | 600 DKK | Offline presence where the cohorts already are |
| Launch pod night at a partner café in the first city (coffee or board game fees for the first pods) | 1,200 DKK | Real first meetups, photos for posts and press |
| Test ad, geo-targeted Instagram/Facebook in the first city, aimed at one starter interest, linking to the city page | 500 DKK | Measure the cost per onboarded user before spending more |
| Reserve: more ads only if the test is cheap enough, or a second city's launch night | 700 DKK | |

Don't split the money across five cities. Spend it in the city closest to its goal.

## 12. Timeline

| When | What |
|---|---|
| Nov–Dec 2026 | Partnership emails (Far for livet, Foreningen Far, Spilcaféen, Boulders, International Houses, Vejle newcomer guide); posters in the first city; waitlist open for all five cities |
| Late Jan–Feb 2027 | Intro weeks for the spring semester; student houses; first city aims to open |
| Spring 2027 | Alpha in the first city; funnel review every 2 weeks; second city opens when it reaches its goal |
| Aug–Sep 2027 | Intro weeks; Aarhus City Welcome, Odense Welcome Day, IHND fair, Vejle welcome evenings |
| After 3–6 months of data | Municipal pilot pitch (§8) |

## 13. Posting in groups without being spammy

1. **Ask the admin before posting.** Many Danish parent and expat groups have a no-ads rule. If they agree, say "posted with admin approval".
2. **Lead with a real meetup, not the app.** For example: "A dads' walking pod in Aarhus C on Tuesday mornings, four places left".
3. **Post as a person, in Danish** (English for expat groups). Say who you are and answer every comment.
4. **One local, specific post per group.** No national copy-paste across many groups.
5. **Give the host something useful:** free pods for their regulars, a printable flyer, an anonymous summary of what people in their area ask for.
6. **Never scrape members or send cold messages.**
