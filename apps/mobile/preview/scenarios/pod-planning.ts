import type { Scenario } from '../runtime/types';
import {
  braetspilPod,
  CAST_PHOTOS,
  ME,
  now,
  ONBOARDED_USER,
  PLACE_RESULTS,
  planOptions,
  POD_BRAETSPIL,
  podCard,
  profileWorld,
  ts,
} from './_kit';

/**
 * Monday 9 Nov: two options, voting closes Tuesday 18:00 (storyboard 3.2). Saturday leads with 3 yes (Mette, Jonas,
 * the viewer); Sunday has 2 (Sofie, Ahmed) and no vote from the viewer yet. Place search returns placeholder cafés
 * (storyboard 3.3).
 */
const scenario: Scenario = {
  id: 'pod-planning',
  title: 'Planning: two options to vote on, one spot left',
  now: now('2026-11-09 12:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  places: PLACE_RESULTS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: '2026-W45', outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'planning', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts('2026-11-07 18:00') }),
    [`pods/${POD_BRAETSPIL}`]: braetspilPod(),
    ...planOptions(POD_BRAETSPIL),
  }),
};

export default scenario;
