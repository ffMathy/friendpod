import type { Scenario } from '../runtime/types';
import { areaDoc, CAST_PHOTOS, interestDocs, ME, now, ONBOARDED_USER, userDoc } from './_kit';

/** Like this-week, but the blanket Art. 9 consent was never given: no private interests (Settings → Privacy). */
const scenario: Scenario = {
  id: 'this-week-no-consent',
  title: 'Onboarded member who said no to private interests',
  now: now('2026-11-10 12:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    [`users/${ME}`]: userDoc({ locale, art9At: null, interestCount: 4, lastDrop: { weekId: '2026-W45', outcome: 'proposed' } }),
    ...interestDocs(),
    'areas/aarhus': areaDoc('aarhus', 'live', 412),
  }),
};

export default scenario;
