import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, now, ONBOARDED_USER } from './_kit';
import { colourPodWorld, BLAD_POD } from './_colours';

/**
 * Sunday 15 Nov: the Blad pod (trail running) was confirmed; the reveal on the Blad field: Ink type and people, a white
 * sun.
 */
const scenario: Scenario = {
  id: 'pod-blad-confirmed',
  title: 'Blad pod confirmed (trail running): the reveal on the Blad field',
  now: now('2026-11-15 10:00'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => colourPodWorld(BLAD_POD, 'confirmed', locale),
};

export default scenario;
