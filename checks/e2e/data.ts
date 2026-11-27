// Test data for the end-to-end and derived checks: the worlds a scenario's Given starts from.
//
// The existing app runs here as its web preview (see ail/friendpod.ail.md), whose data is a fixture world chosen
// when the app opens (apps/mobile/preview/scenarios). This file is the one place that knows how: a rebuilt app, or
// the native app on a simulator with the Firebase emulators, changes these helpers and nothing else.
//
// Every world is in Aarhus C (unless it says otherwise), the viewer is Emil (born 14 March 1991), and "today" is the
// Copenhagen time given with each world. The brætspil (board games) pod has Mette, Jonas, Sofie and Ahmed.

/** Each world a scenario can start in, by the words its Given uses, and the web preview's fixture scenario for it. */
const PREVIEW_SCENARIO = {
  // ---- signed out (Monday 10 November 2026, 12:00)
  /** The welcome screen with sign-in. */
  'signed out': 'signed-out',
  /** An email sign-in link was sent; the address is kept on the phone. */
  'signed out, email link sent': 'signed-out-link-pending',

  // ---- onboarding (4 November 2026)
  /** Signed in, not onboarded yet: no profile. 19:55. */
  'new member': 'onboarding-start',
  /** Onboarded (steps 1–2 done), not asked about private interests yet. 20:02. */
  'member choosing about private interests': 'onboarding-consent',
  /** Onboarding after the private-interest consent: interests, preferences, photo, pledge to go. 20:10. */
  'member adding interests': 'onboarding-interests',
  /** Onboarding step 6: photo, About me, notifications, safety pledge. 20:14. */
  'member on the last onboarding step': 'onboarding-final',

  // ---- home and settings (Tuesday 10 November 2026, week 46, 12:00 unless said)
  /** Onboarded in Odense, which is not open yet: the waitlist, 186 of 250. */
  'member in a city on the waitlist': 'waitlist-odense',
  /** Onboarded, one scheduled pod, interests (some private), settings data, a ready data export. */
  'member this week': 'this-week',
  /** Like "member this week", but they said no to private interests. */
  'member without private-interest consent': 'this-week-no-consent',
  /** New member: no photo, no meetups, a setting that keeps them out, nothing blocked, no messages. */
  'new member with nothing yet': 'me-new',
  /** Messages from Friendpod: one of each kind. */
  'member with messages from Friendpod': 'me-notices',
  /** Privacy settings and delete account, no data export in progress. */
  'member in privacy settings': 'privacy-settings',

  // ---- the weekly drop (Thursday 12 November 2026, 18:30 unless said)
  /** The drop is out: a brætspil pod proposal, not answered yet. */
  'member with a pod proposal': 'drop-proposal',
  /** Accepted the proposal, waiting for the others (3 of 5 said yes). Friday 13 November, 10:00. */
  'member waiting for the others': 'drop-waiting',
  /** No pod this week: not enough people sharing an interest. */
  'member with no pod this week': 'drop-none',
  /** No pod this week, the third week in a row, because of the distance setting. */
  'member kept out by a setting': 'drop-none-setting',
  /** A pod proposal about a private interest (gravid), week 48. Thursday 26 November, 18:30. */
  'member with a private pod proposal': 'drop-private',
  /** A Fjord-coloured pod proposal (far på barsel), not answered. */
  'member with a Fjord pod proposal': 'pod-fjord-proposal',
  /** A Solsikke-coloured pod proposal (sourdough), not answered. */
  'member with a Solsikke pod proposal': 'pod-solsikke-proposal',
  /** An open-to-anyone pod proposal, not answered. */
  'member with an open pod proposal': 'pod-open-proposal',

  // ---- pods (Sunday 15 November 2026, 10:00 unless said)
  /** The brætspil pod is confirmed: members revealed, plan the meetup by Tuesday 18:00. */
  'member of a confirmed pod': 'pod-confirmed',
  /** A Fjord pod (far på barsel) is confirmed: the reveal. */
  'member of a confirmed Fjord pod': 'pod-fjord-confirmed',
  /** A Solsikke pod (sourdough) is confirmed: the reveal. */
  'member of a confirmed Solsikke pod': 'pod-solsikke-confirmed',
  /** A Blad pod (trail running) is confirmed: the reveal. */
  'member of a confirmed Blad pod': 'pod-blad-confirmed',
  /** An open-to-anyone pod is confirmed: the reveal on the Blomme field. */
  'member of a confirmed open pod': 'pod-open-confirmed',
  /** Planning: two options to vote on, one spot left. Monday 16 November, 12:00. */
  'member planning a meetup': 'pod-planning',
  /** Planning, extra round: no option got 3 yes votes; add another by Wednesday 18:00. Wednesday 18 November, 10:00. */
  'member in the extra planning round': 'pod-planning-extended',
  /** Scheduled pod the day before: "Still coming?", chat open. Friday 20 November, 19:30. */
  'member the day before a meetup': 'pod-scheduled',
  /** Meetup day, minutes before 14:00: chat open with five messages. Saturday 21 November, 13:58. */
  'member just before a meetup': 'pod-chat-open',
  /** The morning after the meetup: feedback, block or report. Sunday 22 November, 10:05. */
  'member the morning after a meetup': 'pod-happened',
  /** A confirmed pod about a private interest (gravid): photos hidden until each member shows theirs. Sunday 29 November, 11:00. */
  'member of a confirmed private pod': 'pod-private-confirmed',
  /** A scheduled pod about a private interest, the day before: chat open. Friday 4 December, 19:30. */
  'member the day before a private meetup': 'pod-private-scheduled',
} as const;

/** A world a scenario starts in, as the spec's Given names it. */
export type World = keyof typeof PREVIEW_SCENARIO;

/** Every world, for tools that list them. */
export const WORLDS = Object.keys(PREVIEW_SCENARIO) as World[];

/** The address that opens `route` as the world's user, in `locale`. */
export function urlFor(base: string, route: string, world: World, locale: 'en' | 'da' = 'en'): string {
  const url = new URL(route, base);
  url.searchParams.set('scenario', PREVIEW_SCENARIO[world]);
  url.searchParams.set('locale', locale);
  return url.toString();
}
