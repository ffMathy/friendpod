import type { Scenario } from '../runtime/types';
import { ABOUT_ME, areaDoc, CAST_PHOTOS, interestDocs, ME, now, ONBOARDED_USER, sensitiveInterestDocs, userDoc } from './_kit';

/**
 * The last onboarding step (storyboard 1.7, "Almost done"): consent given, interests and preferences saved, no photo
 * yet, and the storyboard's "About me" typed in the user's own language (not saved yet; Finish saves it).
 */
const scenario: Scenario = {
  id: 'onboarding-final',
  title: 'Onboarding step 6: photo, About me, notifications, safety pledge',
  now: now('2026-11-04 20:14'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  onboardingFinished: false,
  pushPermission: 'notDetermined',
  docs: ({ locale }) => ({
    // The field starts from the profile; here it holds what the storyboard shows typed in.
    [`users/${ME}`]: userDoc({ locale, photo: false, aboutMe: ABOUT_ME[locale] }),
    ...interestDocs(),
    ...sensitiveInterestDocs(),
    'areas/aarhus': areaDoc('aarhus', 'live', 412),
  }),
};

export default scenario;
