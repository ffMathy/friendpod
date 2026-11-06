/**
 * Shared pieces of the pod scenarios (pod-planning, pod-scheduled, pod-chat-open): the placeholder places in the
 * preview's language, the plan and options that use them, and a `sendMessage` that warns about contact details before
 * the meetup as the server does. Placeholders only, never real venues.
 */
import { checkChatText, type Locale } from '@grouper/core';
import type { CallableHandlers, DocData, PlaceFixture } from '../runtime/types';
import { Timestamp } from '../runtime/timestamp';
import { chatMessages, LOCKED_PLANNING, ME, place, planOptions } from './_kit';

/** The two option venues of storyboards 3.2 and 3.4, named in the preview's language. */
export function podPlaces(locale: Locale): { readonly boardGameCafe: DocData; readonly libraryCafe: DocData } {
  return locale === 'da'
    ? {
        boardGameCafe: place('placeholderBoardGameCafe', '[Brætspilscafé]', 'Aarhus C', 56.1572, 10.2079, 'cafe'),
        libraryCafe: place('placeholderLibraryCafe', '[Bibliotekscafé]', 'Aarhus Havn', 56.1535, 10.2142, 'library'),
      }
    : {
        boardGameCafe: place('placeholderBoardGameCafe', '[Board game café]', 'Aarhus C', 56.1572, 10.2079, 'cafe'),
        libraryCafe: place('placeholderLibraryCafe', '[Library café]', 'Aarhus harbour', 56.1535, 10.2142, 'library'),
      };
}

/** The locked plan (Saturday 14 Nov, 14:00) at the board game café, in the preview's language. */
export function lockedPlanning(locale: Locale): DocData {
  return { ...LOCKED_PLANNING, place: podPlaces(locale).boardGameCafe };
}

/** The two options of "Plan the meetup" (Saturday 14:00, Sunday 11:00), with the places in the preview's language. */
export function localPlanOptions(podId: string, locale: Locale): Record<string, DocData> {
  const places = podPlaces(locale);
  return Object.fromEntries(
    Object.entries(planOptions(podId)).map(([path, doc]) => [path, { ...doc, place: path.endsWith('/optionSaturday') ? places.boardGameCafe : places.libraryCafe }]),
  );
}

/**
 * The storyboard chat (3.5) as the pod scenarios show it. In Danish, Sofie answers Mette's "glæder mig til i morgen"
 * with "Glæder mig også!" ("I lige måde" reads like returning a greeting).
 */
export function podChat(podId: string, upTo: 'friday' | 'saturday', locale: Locale): Record<string, DocData> {
  const messages = chatMessages(podId, upTo, locale);
  const sofie = `pods/${podId}/messages/m2`;
  const reply = messages[sofie];
  if (locale !== 'da' || !reply) return messages;
  return { ...messages, [sofie]: { ...reply, text: 'Glæder mig også! Det er første gang, jeg prøver sådan noget, så jeg er lidt nervøs.' } };
}

/**
 * Place search results for "Suggest a time" (storyboard 3.3). The address is the area only: the app writes the kind
 * of place in front of it ("Café · Aarhus C"). The preview's search matches typed words against the name, so each
 * name holds "café" to come up for the storyboard's "café latin" ("[Café bar name]" stands in for its coffee bar).
 */
export function placeResults(locale: Locale): readonly PlaceFixture[] {
  const da = locale === 'da';
  return [
    { placeId: 'placeholderCafeLatinQ', name: da ? '[Cafénavn], Latinerkvarteret' : '[Café name], Latin Quarter', address: 'Aarhus C', lat: 56.1588, lng: 10.2085, primaryType: 'cafe' },
    { placeId: 'placeholderCoffeeBar1', name: da ? '[Cafébarens navn]' : '[Café bar name]', address: 'Aarhus C', lat: 56.1561, lng: 10.2095, primaryType: 'cafe' },
    { placeId: 'placeholderBakeryCafe2', name: da ? '[Bagericaféens navn]' : '[Bakery café name]', address: 'Aarhus C', lat: 56.1502, lng: 10.2061, primaryType: 'bakery' },
  ];
}

/**
 * `sendMessage` as the server answers it (§3.6): before the meetup, contact details (a phone number, an email, a
 * handle or a link) are not stored until "Send anyway" resends with `ackContactWarning`.
 */
export const CHAT_CALLABLES: CallableHandlers = {
  sendMessage: ({ podId, text, ackContactWarning }, ctx) => {
    const pod = ctx.store.get(`pods/${podId}`);
    const meetupAt = (pod?.planning as { meetupAt?: Timestamp } | undefined)?.meetupAt?.toMillis() ?? ctx.now;
    const check = checkChatText(text.trim(), { beforeMeetup: ctx.now < meetupAt });
    if (check.ok && check.warning && ackContactWarning !== true) return { warnings: [check.warning] };
    const messageId = ctx.store.newId('message');
    ctx.store.set(`pods/${podId}/messages/${messageId}`, {
      authorUid: ctx.uid ?? ME,
      text,
      createdAt: Timestamp.fromMillis(ctx.now),
      expiresAt: Timestamp.fromMillis(meetupAt + 72 * 3_600_000),
    });
    return { messageId };
  },
};
