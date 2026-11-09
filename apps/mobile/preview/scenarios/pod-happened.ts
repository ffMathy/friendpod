import type { Scenario } from '../runtime/types';
import { BRAETSPIL_MEMBERS, CAST_PHOTOS, ME, MEMBERS, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, roster, ts } from './_kit';
import { localPlanOptions, LOCKED_VOTES, lockedPlanning, podChat, WEEK46, week46Pod } from './_pod';

/**
 * Sunday 22 Nov, 10:05, the morning after the Saturday meetup (storyboards 4.1–4.3, see WEEK46 in _pod.ts): the "How
 * did it go?" push has just arrived; the member sheet and the report sheet open from here. The place and the chat are
 * in the preview's language, as on the other pod screens. Nobody shows a photo, so the avatars are the initials in the
 * pod's deep tone, as the storyboards draw them (brætspil's concept id lands on Tomat).
 */
const scenario: Scenario = {
  id: 'pod-happened',
  title: 'The morning after the meetup: feedback, block or report',
  now: now('2026-11-22 10:05'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'happened', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts(WEEK46.acceptBy) }),
    [`pods/${POD_BRAETSPIL}`]: week46Pod({
      state: 'happened',
      roster: roster(BRAETSPIL_MEMBERS, false),
      planning: lockedPlanning(locale),
      attendance: Object.fromEntries([ME, ...Object.values(MEMBERS).map((m) => m.uid)].map((uid) => [uid, 'coming'])),
    }),
    ...localPlanOptions(POD_BRAETSPIL, locale, LOCKED_VOTES),
    ...podChat(POD_BRAETSPIL, 'saturday', locale),
  }),
};

export default scenario;
