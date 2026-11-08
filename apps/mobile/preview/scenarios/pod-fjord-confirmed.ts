import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, FJORD_POD } from './_colours';

/**
 * Sunday 15 Nov: the Fjord pod ("far på barsel") was confirmed; the reveal on the Fjord field: white type at the fit
 * rule step that keeps every word whole, Paper people, the white "Confirmed" pill.
 */
const scenario: Scenario = {
  id: 'pod-fjord-confirmed',
  title: 'Fjord pod confirmed (far på barsel): the reveal on the Fjord field',
  now: now('2026-11-15 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(FJORD_POD, 'confirmed', locale),
};

export default scenario;
