// Test data for the end-to-end and derived checks: the worlds a scenario's Given starts from.
//
// The existing app runs here as its web preview (see ail/friendpod.ail.md), whose data is a fixture world chosen
// when the app opens. This file is the one place that knows how: a rebuilt app, or the native app on a simulator with
// the Firebase emulators, changes these helpers and nothing else.

/** A world a scenario starts in, as the spec's Given names it. */
export type World = 'new member';

/** Each world, as the web preview's fixture scenario that holds it. */
const PREVIEW_SCENARIO: Record<World, string> = {
  // Signed in, not onboarded yet: no profile, no claim. Today is 4 November 2026 19:55 in Copenhagen.
  'new member': 'onboarding-start',
};

/** Today in every world, as the scenarios' Givens say it. */
export const TODAY = '2026-11-04 19:55';

/** The address that opens `route` as the world's user, in `locale`. */
export function urlFor(base: string, route: string, world: World, locale: 'en' | 'da' = 'en'): string {
  const url = new URL(route, base);
  url.searchParams.set('scenario', PREVIEW_SCENARIO[world]);
  url.searchParams.set('locale', locale);
  return url.toString();
}
