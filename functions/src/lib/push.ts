/**
 * Push notifications with generic payloads only (DESIGN.md §6.1 S4, A14): a fixed text per kind and locale,
 * and `data.kind`. Never a theme, name, place, pod id or count, because FCM, APNs and lock screens see them.
 * The one parameter is `areaOpen`'s city: the recipient's own launch area, the same text for everyone in that city
 * (founder decision 2026-11-05, "<city> is open — your first drop is Thursday 18:00").
 * The app opens Home and reads everything else from Firestore under the rules.
 */
import type { Locale } from '@grouper/core';
import type { Message, Messaging } from 'firebase-admin/messaging';

export const PUSH_KINDS = [
  'dropReady',
  'podConfirmed',
  'podChanged',
  'stillComing',
  'meetupReminder',
  'chatOpen',
  'chatMessage',
  'feedback',
  'weeklyNudge',
  'notice',
  'areaOpen',
] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

interface PushCopy {
  readonly title: string;
  readonly body: string;
}

/** Only `areaOpen` takes a parameter: the launch area's label in both languages. */
export interface PushParams {
  readonly city?: { readonly da: string; readonly en: string };
}

// [A] Danish copy awaits native review together with the app's i18n files.
const COPY: Readonly<Record<Exclude<PushKind, 'areaOpen'>, Readonly<Record<Locale, PushCopy>>>> = {
  dropReady: {
    en: { title: 'Friendpod', body: 'Your weekly drop is here' },
    da: { title: 'Friendpod', body: 'Dit ugentlige drop er her' },
  },
  podConfirmed: {
    en: { title: 'Friendpod', body: 'Your pod is confirmed' },
    da: { title: 'Friendpod', body: 'Din pod er bekræftet' },
  },
  podChanged: {
    en: { title: 'Friendpod', body: 'The pod changed' },
    da: { title: 'Friendpod', body: 'Poden er ændret' },
  },
  stillComing: {
    en: { title: 'Friendpod', body: 'Still coming?' },
    da: { title: 'Friendpod', body: 'Kommer du stadig?' },
  },
  meetupReminder: {
    en: { title: 'Friendpod', body: 'Your meetup is soon' },
    da: { title: 'Friendpod', body: 'Jeres møde er snart' },
  },
  chatOpen: {
    en: { title: 'Friendpod', body: 'Your pod chat is open' },
    da: { title: 'Friendpod', body: 'Din podchat er åben' },
  },
  chatMessage: {
    en: { title: 'Friendpod', body: 'New message in your pod' },
    da: { title: 'Friendpod', body: 'Ny besked i din pod' },
  },
  feedback: {
    en: { title: 'Friendpod', body: 'Did you meet?' },
    da: { title: 'Friendpod', body: 'Mødtes I?' },
  },
  weeklyNudge: {
    en: { title: 'Friendpod', body: 'In this week?' },
    da: { title: 'Friendpod', body: 'Er du med i denne uge?' },
  },
  notice: {
    en: { title: 'Friendpod', body: 'You have a new message from Friendpod' },
    da: { title: 'Friendpod', body: 'Du har en ny besked fra Friendpod' },
  },
};

export interface PushRecipient {
  readonly locale: Locale;
  readonly tokens: readonly string[];
}

function copyFor(kind: PushKind, locale: Locale, params: PushParams): PushCopy {
  if (kind !== 'areaOpen') return COPY[kind][locale];
  if (!params.city) throw new Error('areaOpen needs the city');
  return locale === 'da'
    ? { title: 'Friendpod', body: `${params.city.da} er åben — dit første drop er torsdag kl. 18:00` }
    : { title: 'Friendpod', body: `${params.city.en} is open — your first drop is Thursday 18:00` };
}

/** One FCM message per device token; the only variable parts are the token, the locale and (areaOpen) the city. */
export function genericMessages(kind: PushKind, recipients: readonly PushRecipient[], params: PushParams = {}): Message[] {
  return recipients.flatMap(({ locale, tokens }) => {
    const copy = copyFor(kind, locale, params);
    return tokens.map((token) => ({
      token,
      notification: { title: copy.title, body: copy.body },
      data: { kind },
      android: { notification: { tag: kind } },
      apns: { payload: { aps: { 'thread-id': kind } } },
    }));
  });
}

/** `sendEach` accepts at most 500 messages per call. */
export const PUSH_BATCH = 500;

const STALE_TOKEN_ERRORS = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

export interface PushResult {
  readonly sent: number;
  readonly staleTokens: string[];
}

/** What callables use to push (injected, so tests need no FCM). */
export type PushSender = (kind: PushKind, recipients: readonly PushRecipient[], params?: PushParams) => Promise<PushResult>;

/** Sends in batches of 500 and returns the tokens FCM reported as gone, for pruning from `pushTokens`. */
export async function sendGenericPush(messaging: Messaging, kind: PushKind, recipients: readonly PushRecipient[], params: PushParams = {}): Promise<PushResult> {
  const messages = genericMessages(kind, recipients, params);
  let sent = 0;
  const staleTokens: string[] = [];
  for (let i = 0; i < messages.length; i += PUSH_BATCH) {
    const batch = messages.slice(i, i + PUSH_BATCH);
    const result = await messaging.sendEach(batch);
    sent += result.successCount;
    result.responses.forEach((r, j) => {
      if (!r.success && r.error && STALE_TOKEN_ERRORS.has(r.error.code)) staleTokens.push((batch[j] as { token: string }).token);
    });
  }
  return { sent, staleTokens };
}
