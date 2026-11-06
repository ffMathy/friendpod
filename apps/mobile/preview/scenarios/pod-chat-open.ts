import type { Scenario } from '../runtime/types';
import { CAST_PHOTOS, ME, MEMBERS, now, ONBOARDED_USER, POD_BRAETSPIL, podCard, profileWorld, ts } from './_kit';
import { CHAT_CALLABLES, localPlanOptions, LOCKED_VOTES, lockedPlanning, podChat, WEEK46, week46Pod } from './_pod';

/**
 * Saturday 21 Nov, 13:58, just before the meetup: everyone is coming, the chat has five messages (storyboard 3.5).
 * Sending a phone number, an email or a handle shows "You haven't met yet" (app-pod-chat-warning).
 */
const scenario: Scenario = {
  id: 'pod-chat-open',
  title: 'Meetup day, minutes before 14:00: chat open with five messages',
  now: now('2026-11-21 13:58'),
  user: ONBOARDED_USER,
  photos: CAST_PHOTOS,
  callables: CHAT_CALLABLES,
  docs: ({ locale }) => ({
    ...profileWorld({ locale, lastDrop: { weekId: WEEK46.weekId, outcome: 'proposed' } }),
    [`users/${ME}/pods/${POD_BRAETSPIL}`]: podCard({ state: 'scheduled', myStatus: 'accepted', acceptedCount: 5, acceptBy: ts(WEEK46.acceptBy) }),
    [`pods/${POD_BRAETSPIL}`]: week46Pod({
      state: 'scheduled',
      planning: lockedPlanning(locale),
      attendance: Object.fromEntries([ME, ...Object.values(MEMBERS).map((m) => m.uid)].map((uid) => [uid, 'coming'])),
    }),
    ...localPlanOptions(POD_BRAETSPIL, locale, LOCKED_VOTES),
    ...podChat(POD_BRAETSPIL, 'saturday', locale),
  }),
};

export default scenario;
