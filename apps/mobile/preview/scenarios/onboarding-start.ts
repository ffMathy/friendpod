import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, NEW_USER, now } from './_kit';

/** Signed in, before completeOnboarding: no profile yet (storyboards 1.2 About you, 1.3 Your area). */
const scenario: Scenario = {
  id: 'onboarding-start',
  title: 'Signed in, not onboarded yet (no profile, no claim)',
  now: now('2026-11-04 19:55'),
  user: NEW_USER,
  photos: CAST_PHOTOS,
};

export default scenario;
