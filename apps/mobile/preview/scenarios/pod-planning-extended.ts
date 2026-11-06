import { preview } from '../runtime/state';
import type { PlaceFixture, Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, MEMBERS, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, ts } from './_kit';
import { localPlanOptions, placeResults, WEEK46, week46Pod } from './_pod';

/**
 * Wednesday 18 Nov, 10:00: Tuesday's deadline passed without 3 yes votes on one option (Saturday: Mette and Jonas;
 * Sunday: Sofie and Ahmed; the viewer can make neither), so the pod has its one extra 24 h round, until Wednesday
 * 18:00: "No time works yet — add another option" (D7, §3.5, the planning sticky note). One spot is left for a third
 * option; if nothing gets 3 yes votes by then, the pod ends.
 */
const scenario: Scenario = {
  id: 'pod-planning-extended',
  title: 'Planning, extra round: no option got 3 yes votes, add another by Wednesday 18:00',
  now: now('2026-11-18 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  get places(): readonly PlaceFixture[] {
    return placeResults(preview().locale);
  },
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'planning', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts(WEEK46.acceptBy) }),
    [`pods/${POD_BRAETSPIL}`]: week46Pod({ planning: { deadline: ts('2026-11-18 18:00'), extended: true } }),
    ...localPlanOptions(POD_BRAETSPIL, locale, {
      saturday: { [MEMBERS.mette.uid]: 'yes', [MEMBERS.jonas.uid]: 'yes', [MEMBERS.sofie.uid]: 'no', [ME]: 'no' },
      sunday: { [MEMBERS.sofie.uid]: 'yes', [MEMBERS.ahmed.uid]: 'yes', [MEMBERS.jonas.uid]: 'no', [ME]: 'no' },
    }),
  }),
};

export default scenario;
