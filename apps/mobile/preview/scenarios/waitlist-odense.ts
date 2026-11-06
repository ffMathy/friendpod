import type { Scenario } from '../runtime/types';
import { areaDoc, CAST_PHOTOS, interestDocs, ME, now, ODENSE_C, ONBOARDED_USER, userDoc } from './_kit';

/** Onboarded in Odense, which is still on its waitlist: 186 of 250 (storyboard 1.8). */
const scenario: Scenario = {
  id: 'waitlist-odense',
  title: "Onboarded in a city that isn't open yet: Odense waitlist, 186 of 250",
  now: now('2026-11-10 12:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    [`users/${ME}`]: userDoc({ locale, area: ODENSE_C, art9At: null, interestCount: 4, lastDrop: { weekId: '2026-W45', outcome: 'unmatched', reason: 'AREA_WAITLIST' } }),
    ...interestDocs(),
    'areas/odense': areaDoc('odense', 'waitlist', 186),
  }),
};

export default scenario;
