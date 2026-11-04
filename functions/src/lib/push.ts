/**
 * Push notifications with generic payloads only (DESIGN.md §6.1 S4, A14): a fixed text per kind and locale,
 * and `data.kind`. Never a theme, name, place, pod id or count, because FCM, APNs and lock screens see them.
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
] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

interface PushCopy {
  readonly title: string;
  readonly body: string;
}

// [A] Danish copy awaits native review together with the app's i18n files.
const COPY: Readonly<Record<PushKind, Readonly<Record<Locale, PushCopy>>>> = {
  dropReady: {
    en: { title: 'Grouper', body: 'Your weekly drop is here' },
    da: { title: 'Grouper', body: 'Dit ugentlige drop er her' },
  },
  podConfirmed: {
    en: { title: 'Grouper', body: 'Your pod is confirmed' },
    da: { title: 'Grouper', body: 'Din pod er bekræftet' },
  },
  podChanged: {
    en: { title: 'Grouper', body: 'The pod changed' },
    da: { title: 'Grouper', body: 'Poden er ændret' },
  },
  stillComing: {
    en: { title: 'Grouper', body: 'Still coming?' },
    da: { title: 'Grouper', body: 'Kommer du stadig?' },
  },
  meetupReminder: {
    en: { title: 'Grouper', body: 'Your meetup is soon' },
    da: { title: 'Grouper', body: 'Jeres møde er snart' },
  },
  chatOpen: {
    en: { title: 'Grouper', body: 'Your pod chat is open' },
    da: { title: 'Grouper', body: 'Din podchat er åben' },
  },
  chatMessage: {
    en: { title: 'Grouper', body: 'New message in your pod' },
    da: { title: 'Grouper', body: 'Ny besked i din pod' },
  },
  feedback: {
    en: { title: 'Grouper', body: 'Did you meet?' },
    da: { title: 'Grouper', body: 'Mødtes I?' },
  },
  weeklyNudge: {
    en: { title: 'Grouper', body: 'In this week?' },
    da: { title: 'Grouper', body: 'Er du med i denne uge?' },
  },
  notice: {
    en: { title: 'Grouper', body: 'You have a new message from Grouper' },
    da: { title: 'Grouper', body: 'Du har en ny besked fra Grouper' },
  },
};

export interface PushRecipient {
  readonly locale: Locale;
  readonly tokens: readonly string[];
}

/** One FCM message per device token; the only variable parts are the token and the locale of the fixed copy. */
export function genericMessages(kind: PushKind, recipients: readonly PushRecipient[]): Message[] {
  return recipients.flatMap(({ locale, tokens }) => {
    const copy = COPY[kind][locale];
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
export type PushSender = (kind: PushKind, recipients: readonly PushRecipient[]) => Promise<PushResult>;

/** Sends in batches of 500 and returns the tokens FCM reported as gone, for pruning from `pushTokens`. */
export async function sendGenericPush(messaging: Messaging, kind: PushKind, recipients: readonly PushRecipient[]): Promise<PushResult> {
  const messages = genericMessages(kind, recipients);
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
