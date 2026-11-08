import type { Scenario } from '../runtime/types';
import { Timestamp } from '../runtime/timestamp';
import {
  areaDoc,
  BRAETSPIL_CONCEPT,
  CAST_PHOTOS,
  DEFAULT_PREFS,
  interestDocs,
  ME,
  now,
  ONBOARDED_USER,
  sensitiveInterestDocs,
  userDoc,
} from './_kit';

const POPULAR_IN_AARHUS = [
  { conceptId: 'seed_running', da: 'løb', en: 'løb' },
  { conceptId: 'seed_climbing', da: 'klatring', en: 'climbing' },
  { conceptId: 'seed_cooking', da: 'madlavning', en: 'madlavning' },
  { conceptId: 'seed_book_club', da: 'læseklub', en: 'book club' },
];

/**
 * Onboarding steps after the consent (storyboards 1.5–1.7): Art. 9 consent given, four interests (one private).
 * Adding "brætspilsaften" answers with the suggestion "brætspil" (screens.json steps type it), as in storyboard 1.5.
 */
const scenario: Scenario = {
  id: 'onboarding-interests',
  title: 'Onboarding after the consent: interests, preferences, photo, pledge',
  now: now('2026-11-04 20:10'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  onboardingFinished: false,
  docs: ({ locale }) => ({
    // Fresh from completeOnboarding in an alpha-profile city (§6.10): "open to anyone" starts on. The ages stay at the
    // storyboard's 28–42.
    [`users/${ME}`]: userDoc({ locale, interestCount: 4, photo: false, aboutMe: null, prefs: { ...DEFAULT_PREFS, openToAnyone: true } }),
    ...Object.fromEntries(Object.entries(interestDocs()).filter(([path]) => !path.endsWith('inttrailrunninga'))),
    ...sensitiveInterestDocs(),
    // "Popular in Aarhus" as storyboard 1.5 shows it: people's own words, so the English list mixes in Danish ones.
    'areas/aarhus': { ...areaDoc('aarhus', 'live', 412), chips: POPULAR_IN_AARHUS },
  }),
  callables: {
    addInterests: ({ items }, { store, now: at }) => ({
      results: items.map((item, i) => {
        const interestId = `intpreviewadded${'abcdefghij'[i] ?? 'z'}`;
        const display = item.text.trim();
        store.set(`users/${ME}/interests/${interestId}`, {
          display,
          norm: display.toLowerCase(),
          conceptId: 'c_0a1b2c3d4e5f60718293',
          starred: false,
          createdAt: Timestamp.fromMillis(at),
        });
        return display.toLowerCase() === 'brætspilsaften'
          ? { status: 'added' as const, interestId, suggestion: { conceptId: BRAETSPIL_CONCEPT, label: 'brætspil' } }
          : { status: 'added' as const, interestId };
      }),
    }),
  },
};

export default scenario;
