import { preview } from '../runtime/state';
import type { PlaceFixture, Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, ts } from './_kit';
import { localPlanOptions, placeResults, WEEK46, week46Pod } from './_pod';

/**
 * Monday 16 Nov: two options, voting closes Tuesday 17 Nov 18:00 (storyboard 3.2). Saturday 21 Nov leads with 3 yes
 * (Mette, Jonas, the viewer); Sunday 22 Nov has 2 (Sofie, Ahmed) and no vote from the viewer yet. Place search returns
 * placeholder cafés (storyboard 3.3). Places are named in the preview's language.
 */
const scenario: Scenario = {
  id: 'pod-planning',
  title: 'Planning: two options to vote on, one spot left',
  now: now('2026-11-16 12:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  // Read when the app searches, so the results follow the preview's language like the documents do.
  get places(): readonly PlaceFixture[] {
    return placeResults(preview().locale);
  },
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'planning', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts(WEEK46.acceptBy) }),
    [`pods/${POD_BRAETSPIL}`]: week46Pod(),
    ...localPlanOptions(POD_BRAETSPIL, locale),
  }),
};

export default scenario;
