import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, profileWorld } from './_kit';

/**
 * A member in their first weeks, for the calm empty states of Me and its pages: no photo yet, no meetups yet, last
 * week's drop found no pod because the distance setting is small (the note on Me names it), notifications not turned
 * on, nobody blocked and no messages from Grouper.
 */
const scenario: Scenario = {
  id: 'me-new',
  title: 'New member: no photo, no meetups, a setting that keeps them out, nothing blocked or sent',
  now: now('2026-11-10 12:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  pushPermission: 'notDetermined',
  docs: ({ locale }) => {
    const world = profileWorld({ locale, photo: false, lastDrop: { weekId: '2026-W45', outcome: 'unmatched', reason: 'RADIUS' } });
    const user = world[`users/${ME}`] ?? {};
    return { ...world, [`users/${ME}`]: { ...user, stats: { attended: 0, noShows: 0, lateCancels: 0 } } };
  },
};

export default scenario;
