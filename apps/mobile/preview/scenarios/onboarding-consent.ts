import type { Scenario } from '../runtime/types';
import { areaDoc, CAST_PHOTOS, ME, now, ONBOARDED_USER, userDoc } from './_kit';

/** Right after completeOnboarding: profile in Aarhus C, no interests, no Art. 9 consent yet (storyboard 1.4). */
const scenario: Scenario = {
  id: 'onboarding-consent',
  title: 'Onboarding after the claim: consent for private interests not given yet',
  now: now('2026-11-04 20:02'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  onboardingFinished: false,
  docs: ({ locale }) => ({
    [`users/${ME}`]: userDoc({ locale, art9At: null, interestCount: 0, photo: false, aboutMe: null }),
    'areas/aarhus': areaDoc('aarhus', 'live', 412),
  }),
};

export default scenario;
