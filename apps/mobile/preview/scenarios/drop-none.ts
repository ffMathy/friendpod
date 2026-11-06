import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER, profileWorld } from './_kit';

/** Thursday 12 Nov, 18:30: no pod this week, for a reason that names no setting (storyboard 2.5). */
const scenario: Scenario = {
  id: 'drop-none',
  title: 'No pod this week (not enough people sharing an interest)',
  now: now('2026-11-12 18:30'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => profileWorld({ locale, lastDrop: { weekId: '2026-W46', outcome: 'unmatched', reason: 'NO_THEME_BUCKET' } }),
};

export default scenario;
