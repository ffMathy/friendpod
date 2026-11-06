import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER, profileWorld } from './_kit';

/** No pod again: after 3 weeks with the same cause the reason names the setting (distance) and links to it. */
const scenario: Scenario = {
  id: 'drop-none-setting',
  title: 'No pod this week, third week in a row because of the distance setting',
  now: now('2026-11-12 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'RADIUS' } }),
};

export default scenario;
