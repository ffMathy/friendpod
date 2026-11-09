/**
 * Shared fixtures for scenarios: one small, consistent world that mirrors the storyboards (Aarhus C, the brætspil pod
 * with Mette, Jonas, Sofie and Ahmed, the viewer's interests). Names and places are placeholders: never real venues
 * or real people. Every document here must parse with its @grouper/core schema (`npm run preview:check`).
 */
import { AVAILABILITY, consentProofFor, fromLocal, googleMapsPlaceUrl, type Locale } from '@grouper/core';
import { Timestamp } from '../runtime/timestamp';
import type { DocData, PlaceFixture, PreviewUser } from '../runtime/types';

// ---------------------------------------------------------------- time

/** Copenhagen wall-clock time, "2026-11-14 18:00", as epoch ms (DST-correct). */
export function at(local: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`preview kit: bad local time "${local}"`);
  return fromLocal({ year: +m[1]!, month: +m[2]!, day: +m[3]!, hour: +m[4]!, minute: +m[5]! });
}

/** A Firestore Timestamp at a Copenhagen wall-clock time (or epoch ms). */
export function ts(local: string | number): Timestamp {
  return Timestamp.fromMillis(typeof local === 'number' ? local : at(local));
}

/** A scenario's `now` from Copenhagen wall-clock time. */
export const now = at;

// ---------------------------------------------------------------- people

export const ME = 'u_me';

/**
 * The viewer. The storyboards call him Mathias; the preview uses another first name so no real person appears in
 * placeholder content. Born 14 Mar 1991 (35), lives in Aarhus C.
 */
export const VIEWER = { uid: ME, firstName: 'Emil', birthYear: 1991 } as const;

export const MEMBERS = {
  mette: { uid: 'u_mette', firstName: 'Mette' },
  jonas: { uid: 'u_jonas', firstName: 'Jonas' },
  sofie: { uid: 'u_sofie', firstName: 'Sofie' },
  ahmed: { uid: 'u_ahmed', firstName: 'Ahmed' },
} as const;

/** The other pod on "This week" (storyboard 2.1: avatars L, K, N). */
export const SOURDOUGH_MEMBERS = {
  laura: { uid: 'u_laura', firstName: 'Laura' },
  kasper: { uid: 'u_kasper', firstName: 'Kasper' },
  nadia: { uid: 'u_nadia', firstName: 'Nadia' },
} as const;

/** The one blocked person (storyboard 5.3 "Blocked people: 1 person"). */
export const BLOCKED = { uid: 'u_rasmus', firstName: 'Rasmus' } as const;

/** A placeholder photo: the initial on the storyboard's avatar colour, as a data: URI (served by runtime/network.ts). */
function avatar(firstName: string, bg: string, fg = '#18211D'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${bg}"/><text x="128" y="128" dy="0.35em" text-anchor="middle" font-family="Plus Jakarta Sans, Helvetica, Arial, sans-serif" font-weight="800" font-size="104" fill="${fg}">${firstName.slice(0, 1)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Photos of everyone in the fixtures, in the storyboards' avatar colours (members in order, the viewer dark). */
export const CAST_PHOTOS: Readonly<Record<string, string>> = {
  [ME]: avatar(VIEWER.firstName, '#18211D', '#FFFFFF'),
  [MEMBERS.mette.uid]: avatar(MEMBERS.mette.firstName, '#F7D58E'),
  [MEMBERS.jonas.uid]: avatar(MEMBERS.jonas.firstName, '#8DBFAE'),
  [MEMBERS.sofie.uid]: avatar(MEMBERS.sofie.firstName, '#CFC6EE'),
  [MEMBERS.ahmed.uid]: avatar(MEMBERS.ahmed.firstName, '#F4C2B0'),
  [SOURDOUGH_MEMBERS.laura.uid]: avatar(SOURDOUGH_MEMBERS.laura.firstName, '#F7D58E'),
  [SOURDOUGH_MEMBERS.kasper.uid]: avatar(SOURDOUGH_MEMBERS.kasper.firstName, '#8DBFAE'),
  [SOURDOUGH_MEMBERS.nadia.uid]: avatar(SOURDOUGH_MEMBERS.nadia.firstName, '#CFC6EE'),
};

export const ONBOARDED_USER: PreviewUser = { uid: ME, email: 'emil@example.com', claims: { onb: true }, provider: 'apple.com' };
export const NEW_USER: PreviewUser = { uid: ME, email: 'emil@example.com', claims: {}, provider: 'apple.com' };

// ---------------------------------------------------------------- ids (server-made: 20/16-char lowercase base32)

export const POD_BRAETSPIL = 'braetspilpodaarhus46';
export const POD_SOURDOUGH = 'sourdoughpodaarhus45';
export const POD_PRIVATE = 'privatepodaarhusweek';

export const INTEREST_IDS = {
  braetspil: 'intbraetspilaaaa',
  sourdough: 'intsourdoughaaaa',
  farPaaBarsel: 'intfarpaabarsela',
  trailRunning: 'inttrailrunninga',
  braetspilsaften: 'intbraetspilsaft',
  gravid: 'intgravidaaaaaaa',
} as const;

// ---------------------------------------------------------------- area

export const AARHUS_C = { gh5: 'u1zr2', label: 'Aarhus C', areaId: 'aarhus' } as const;
export const ODENSE_C = { gh5: 'u1z7h', label: 'Odense C', areaId: 'odense' } as const;

const CHIPS = [
  { conceptId: 'seed_running', da: 'løb', en: 'running' },
  { conceptId: 'seed_climbing', da: 'klatring', en: 'climbing' },
  { conceptId: 'seed_cooking', da: 'madlavning', en: 'cooking' },
  { conceptId: 'seed_book_club', da: 'læseklub', en: 'book club' },
];

export function areaDoc(id: 'aarhus' | 'odense', status: 'waitlist' | 'beta' | 'live', waitlistCount: number): DocData {
  return {
    label: id === 'aarhus' ? { da: 'Aarhus', en: 'Aarhus' } : { da: 'Odense', en: 'Odense' },
    status,
    profile: 'launch',
    waitlistCount,
    goal: { waitlist: 250, optedIn: 200, predictedMatchRate: 0.5, consecutiveWeeks: 2 },
    chips: CHIPS,
    configVersion: 1,
  };
}

// ---------------------------------------------------------------- places (placeholders, never real venues)

export function place(placeId: string, name: string, address: string, lat: number, lng: number, type: string): DocData {
  return { placeId, name, address, lat, lng, type, mapUrl: googleMapsPlaceUrl(placeId, name) };
}

export const BOARD_GAME_CAFE = place('placeholderBoardGameCafe', '[Board game café]', 'Aarhus C', 56.1572, 10.2079, 'cafe');
export const LIBRARY_CAFE = place('placeholderLibraryCafe', '[Library café]', 'Aarhus harbour', 56.1535, 10.2142, 'library');
export const BAKERY_CAFE = place('placeholderBakeryCafe01', '[Bakery café]', 'Frederiksbjerg, Aarhus C', 56.147, 10.203, 'bakery');

/** Place search results for "Suggest a time and place" (storyboard 3.3). */
export const PLACE_RESULTS: readonly PlaceFixture[] = [
  { placeId: 'placeholderCafeLatinQ', name: '[Café name], Latin Quarter', address: 'Café · Aarhus C', lat: 56.1588, lng: 10.2085, primaryType: 'cafe' },
  { placeId: 'placeholderCoffeeBar1', name: '[Coffee bar name]', address: 'Café · Aarhus C', lat: 56.1561, lng: 10.2095, primaryType: 'coffee_shop' },
  { placeId: 'placeholderBakeryCafe2', name: '[Bakery café name]', address: 'Bakery · Aarhus C', lat: 56.1502, lng: 10.2061, primaryType: 'bakery' },
];

// ---------------------------------------------------------------- the viewer's profile

export interface ProfileOptions {
  readonly locale?: Locale;
  readonly area?: { readonly gh5: string; readonly label: string; readonly areaId: string | null };
  /** The blanket Art. 9 consent (D3), given on this date. Default: given 4 Nov 2026. `null`: never given. */
  readonly art9At?: string | null;
  readonly lastDrop?: DocData | null;
  readonly photo?: boolean;
  /** Default: the storyboard's "About me" (1.7). `null`: none written. */
  readonly aboutMe?: string | null;
  readonly interestCount?: number;
  readonly participation?: DocData;
  readonly prefs?: DocData;
}

export const DEFAULT_PREFS = {
  ageMin: 28,
  ageMax: 42,
  maxKm: 10,
  languages: ['da', 'en'],
  availability: AVAILABILITY.weekdayEvening | AVAILABILITY.saturdayDay | AVAILABILITY.sundayDay,
  sameGenderOnly: false,
  openToAnyone: false,
} as const;

/** The storyboard's "About me" (1.7), and how a Danish member would write it. */
export const ABOUT_ME: Readonly<Record<Locale, string>> = {
  en: 'New in Aarhus, dad of a toddler, always up for a game',
  da: 'Ny i Aarhus, far til en tumling og altid klar på et spil',
};

export function userDoc(o: ProfileOptions = {}): DocData {
  const art9At = o.art9At === undefined ? '2026-11-04 20:15' : o.art9At;
  const proof = consentProofFor('art9-blanket-en-v1');
  return {
    firstName: VIEWER.firstName,
    locale: o.locale ?? 'en',
    birthYear: VIEWER.birthYear,
    area: o.area ?? AARHUS_C,
    prefs: o.prefs ?? DEFAULT_PREFS,
    gender: null,
    participation: o.participation ?? { mode: 'auto' },
    photo: o.photo === false ? null : { v: 1 },
    stats: { attended: 2, noShows: 0, lateCancels: 0 },
    status: 'active',
    lastDrop: o.lastDrop === undefined ? null : o.lastDrop,
    legal: {
      terms: 'terms-2026-11.draft-1',
      privacy: 'privacy-2026-11.draft-1',
      ...(art9At ? { art9: { textVersion: proof.textVersion, textSha256: proof.textSha256, at: ts(art9At) } } : {}),
    },
    ...(o.aboutMe === null ? {} : { aboutMe: o.aboutMe ?? ABOUT_ME[o.locale ?? 'en'] }),
    interestCount: o.interestCount ?? 5,
    createdAt: ts('2026-11-04 20:00'),
    lastActiveAt: ts('2026-11-10 08:00'),
  };
}

/**
 * The concept id of brætspil (interest and pod theme). Pod colours come from the word shown, not the concept id
 * (`@/lib/podColor`): "brætspil" lands on Tomat, the storyboards' brætspil colour.
 */
export const BRAETSPIL_CONCEPT = 'seed_boardgames';
/**
 * The other fixture concepts. The colours come from the words (blend spec §3.4, by the salted word hash): sourdough
 * Solsikke (0), trail running Blad (1), far på barsel Fjord (4). The interest and the sourdough pod share the word, so
 * they share its colour.
 */
export const SOURDOUGH_CONCEPT = 'seed_bread_baking';
export const TRAIL_RUNNING_CONCEPT = 'seed_trail_runs';
export const FAR_PAA_BARSEL_CONCEPT = 'seed_dads_on_leave';

function interest(display: string, norm: string, conceptId: string, createdAt: string, starred = false): DocData {
  return { display, norm, conceptId, starred, createdAt: ts(createdAt) };
}

/** The viewer's ordinary interests (storyboards 1.5, 2.1, 5.2), keyed by document path. */
export function interestDocs(o: { readonly withSuggestionSource?: boolean } = {}): Record<string, DocData> {
  const base = `users/${ME}/interests`;
  return {
    [`${base}/${INTEREST_IDS.braetspil}`]: interest('brætspil', 'brætspil', BRAETSPIL_CONCEPT, '2026-11-04 20:05', true),
    [`${base}/${INTEREST_IDS.sourdough}`]: interest('sourdough', 'sourdough', SOURDOUGH_CONCEPT, '2026-11-04 20:06'),
    [`${base}/${INTEREST_IDS.farPaaBarsel}`]: interest('far på barsel', 'far på barsel', FAR_PAA_BARSEL_CONCEPT, '2026-11-04 20:07'),
    ...(o.withSuggestionSource
      ? { [`${base}/${INTEREST_IDS.braetspilsaften}`]: interest('brætspilsaften', 'brætspilsaften', 'c_0a1b2c3d4e5f60718293', '2026-11-04 20:09') }
      : { [`${base}/${INTEREST_IDS.trailRunning}`]: interest('trail running', 'trail running', TRAIL_RUNNING_CONCEPT, '2026-11-04 20:08') }),
  };
}

/** The viewer's one private interest, "gravid", consented on 4 Nov 2026 (storyboard 5.2). */
export function sensitiveInterestDocs(): Record<string, DocData> {
  return {
    [`users/${ME}/sensitiveInterests/${INTEREST_IDS.gravid}`]: {
      display: 'gravid',
      norm: 'gravid',
      conceptId: 'c_9f8e7d6c5b4a39281706_p',
      selfFlagged: false,
      source: 'model',
      consentEventId: 'consentEventArt9Grant',
      consentTextVersion: 'art9-blanket-en-v1',
      consentedAt: ts('2026-11-04 20:15'),
      starred: false,
    },
  };
}

/** Profile, interests, private interest and the Aarhus area doc (live): the base of every signed-in scenario. */
export function profileWorld(o: ProfileOptions & { readonly areaStatus?: 'waitlist' | 'beta' | 'live' } = {}): Record<string, DocData> {
  return {
    [`users/${ME}`]: userDoc(o),
    ...interestDocs(),
    ...sensitiveInterestDocs(),
    'areas/aarhus': areaDoc('aarhus', o.areaStatus ?? 'live', 412),
  };
}

// ---------------------------------------------------------------- pods

type Member = { readonly uid: string; readonly firstName: string };

export function roster(members: readonly Member[], photos = true): DocData {
  const out: Record<string, DocData> = {};
  for (const m of members) out[m.uid] = { firstName: m.firstName, photoV: photos ? 1 : null };
  return out;
}

export const BRAETSPIL_MEMBERS: readonly Member[] = [MEMBERS.mette, MEMBERS.jonas, MEMBERS.sofie, MEMBERS.ahmed, { uid: ME, firstName: VIEWER.firstName }];

/** The reasons behind the brætspil proposal (storyboard 2.3). */
export const BRAETSPIL_REASONS = [
  { code: 'THEME', yourWording: 'brætspil' },
  { code: 'ALSO_SHARE', yourWordings: ['sourdough', 'trail running'] },
  { code: 'AREA', label: 'Aarhus C' },
  { code: 'NEAR_YOU', km: 10 },
  { code: 'AGE_SPAN', min: 29, max: 38 },
  { code: 'PRIORITY', weeks: 2 },
] as const;

export function podCard(overrides: DocData = {}): DocData {
  return {
    state: 'proposed',
    myStatus: 'invited',
    themeLabel: 'brætspil',
    themeSensitive: false,
    sizeTarget: 5,
    acceptedCount: 2,
    acceptBy: ts('2026-11-14 18:00'),
    reasons: BRAETSPIL_REASONS,
    areaLabel: 'Aarhus C',
    ageSpan: { min: 29, max: 38 },
    ...overrides,
  };
}

/** `pods/{podId}` of the confirmed brætspil pod; planning until Tuesday 18:00 unless overridden. */
export function braetspilPod(overrides: DocData = {}): DocData {
  return {
    state: 'planning',
    weekId: '2026-W45',
    areaLabel: 'Aarhus C',
    theme: { kind: 'concept', conceptId: BRAETSPIL_CONCEPT, sensitive: false },
    memberUids: BRAETSPIL_MEMBERS.map((m) => m.uid),
    roster: roster(BRAETSPIL_MEMBERS),
    podInterests: { da: ['surdej', 'kaffe', 'vandring'], en: ['sourdough', 'coffee', 'hiking'] },
    planning: { deadline: ts('2026-11-10 18:00') },
    confirmedAt: ts('2026-11-07 11:20'),
    ...overrides,
  };
}

/**
 * The locked plan: Saturday 14 Nov 2026, 14:00, at the board game café (storyboards 3.4, 3.5, 4.x). The storyboards
 * say "Saturday 15 Nov", which is a Sunday in 2026; the preview keeps the weekdays and shifts the dates.
 */
export const LOCKED_PLANNING = {
  deadline: ts('2026-11-10 18:00'),
  winningOptionId: 'optionSaturday',
  meetupAt: ts('2026-11-14 14:00'),
  planLockedAt: ts('2026-11-10 18:00'),
  place: BOARD_GAME_CAFE,
};

/** The two options of "Plan the meetup" (storyboard 3.2): Saturday 14:00 and Sunday 11:00. */
export function planOptions(podId: string): Record<string, DocData> {
  return {
    [`pods/${podId}/options/optionSaturday`]: {
      authorUid: MEMBERS.mette.uid,
      startsAt: ts('2026-11-14 14:00'),
      place: BOARD_GAME_CAFE,
      votes: { [MEMBERS.mette.uid]: 'yes', [MEMBERS.jonas.uid]: 'yes', [ME]: 'yes' },
      createdAt: ts('2026-11-07 12:10'),
    },
    [`pods/${podId}/options/optionSunday`]: {
      authorUid: MEMBERS.sofie.uid,
      startsAt: ts('2026-11-15 11:00'),
      place: LIBRARY_CAFE,
      votes: { [MEMBERS.sofie.uid]: 'yes', [MEMBERS.ahmed.uid]: 'yes' },
      createdAt: ts('2026-11-07 15:40'),
    },
  };
}

/** The meetup chat (storyboard 3.5), in the preview's language; messages expire 72 h after the meetup. */
const CHAT: readonly (readonly [string, string, string, Readonly<Record<Locale, string>>])[] = [
  ['m1', MEMBERS.mette.uid, '2026-11-13 15:02', {
    en: 'Hi all, looking forward to tomorrow! I can bring Codenames if the café is busy.',
    da: 'Hej alle sammen, glæder mig til i morgen! Jeg tager Codenames med, hvis der er fyldt på caféen.',
  }],
  ['m2', MEMBERS.sofie.uid, '2026-11-13 18:40', {
    en: 'Same here. First time doing something like this, so a bit nervous.',
    da: 'I lige måde. Det er første gang, jeg prøver sådan noget, så jeg er lidt nervøs.',
  }],
  ['m3', ME, '2026-11-13 19:05', { en: 'Me too, it will be fine. See you at 14!', da: 'Også mig, det skal nok gå. Vi ses kl. 14!' }],
  ['m4', MEMBERS.jonas.uid, '2026-11-14 13:41', { en: 'Running 10 min late, sorry! Save me a seat.', da: 'Jeg er 10 min. forsinket, undskyld! Hold en plads til mig.' }],
  ['m5', MEMBERS.ahmed.uid, '2026-11-14 13:55', { en: "I'm here, table by the window, green jacket.", da: 'Jeg er her, bordet ved vinduet, grøn jakke.' }],
];

export function chatMessages(podId: string, upTo: 'friday' | 'saturday', locale: Locale = 'en'): Record<string, DocData> {
  const expiresAt = ts('2026-11-17 14:00');
  const out: Record<string, DocData> = {};
  for (const [id, authorUid, createdAt, text] of upTo === 'friday' ? CHAT.slice(0, 3) : CHAT) {
    out[`pods/${podId}/messages/${id}`] = { authorUid, text: text[locale], createdAt: ts(createdAt), expiresAt };
  }
  return out;
}
