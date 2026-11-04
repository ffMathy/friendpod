/**
 * sendMessage (DESIGN.md §3.6 "Meetup chat", §4.6, §10.1; A28). One transaction reads the pod, the caller's
 * account and their per-pod bucket, then stores the message and the charge together, so a block, a leave, a
 * return to `planning` or an account deletion that commits first leaves no message behind. Warnings and
 * rejections store and charge nothing. Messages are text only (D14): "Can't make it" is confirmAttendance on the
 * attendance card. The text is never logged.
 */
import {
  CHAT_PUSH_THROTTLE_MS,
  CHAT_RATE_LIMIT_PER_HOUR,
  HOUR_MS,
  chatWindow,
  checkChatText,
  isChatOpen,
  type AccountStatus,
  type CallableInput,
  type CallableOutput,
  type PodState,
} from '@grouper/core';
import { AppError } from '../lib/errors';
import { docs, podMessages, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import { errorFields } from '../lib/log';
import type { PushRecipient } from '../lib/push';
import { rateLimitKey, takeWindow } from '../lib/rateLimits';
import type { AppDeps } from '../lib/runtime';

type Input = CallableInput<'sendMessage'>;
type Output = CallableOutput<'sendMessage'>;
type Held = Extract<Output, { warnings: unknown }>;
interface Stored {
  readonly recipients: readonly string[];
}

/** `rateLimits/{uid}_chat_{podId}`: messages sent; `rateLimits/{uid}_chatPush_{podId}`: pushes received. */
export const CHAT_BUCKET = 'chat';
export const CHAT_PUSH_BUCKET = 'chatPush';

/** Only these states have a current `planning.meetupAt`; any other state closes the chat at once (§4.6). */
const CHAT_STATES: ReadonlySet<PodState> = new Set<PodState>(['scheduled', 'happened']);

/**
 * Once `users.status` is `deleting`, purgeUser may already have deleted this user's messages, while their ID
 * token stays valid for up to an hour (PRIVACY.md §6). A suspended account writes nothing either.
 */
const MAY_WRITE: ReadonlySet<AccountStatus> = new Set<AccountStatus>(['active', 'paused']);

export async function sendMessage(deps: AppDeps, call: CallContext, input: Input): Promise<Output> {
  const { uid, now } = call;
  const refs = docs(deps.db);
  const podRef = refs.pod(input.podId);
  const bucketRef = refs.rateLimit(rateLimitKey(uid, CHAT_BUCKET, input.podId));
  const messageRef = podMessages(deps.db, input.podId).doc();

  const result = await deps.db.runTransaction<Stored | Held>(async (tx) => {
    const [podSnap, userSnap, bucketSnap] = await Promise.all([tx.get(podRef), tx.get(refs.user(uid)), tx.get(bucketRef)]);
    const pod = podSnap.data();
    if (!pod?.memberUids.includes(uid)) throw new AppError('NOT_MEMBER');
    const user = userSnap.data();
    if (!user || !MAY_WRITE.has(user.status)) throw new AppError('STATE');
    const meetupAtMs = pod.planning.meetupAt?.toMillis();
    if (meetupAtMs === undefined || !CHAT_STATES.has(pod.state) || !isChatOpen(new Date(meetupAtMs), new Date(now))) {
      throw new AppError('CHAT_CLOSED');
    }

    const bucket = takeWindow(bucketSnap.data(), now, { limit: CHAT_RATE_LIMIT_PER_HOUR, windowMs: HOUR_MS });
    if (!bucket) throw new AppError('RATE_LIMITED');

    const check = checkChatText(input.text, { beforeMeetup: now < meetupAtMs });
    if (!check.ok) throw new AppError(check.code);
    if (check.warning !== undefined && input.ackContactWarning !== true) return { warnings: [check.warning] };

    tx.create(messageRef, {
      authorUid: uid,
      text: input.text,
      createdAt: ts(now),
      expiresAt: ts(chatWindow(new Date(meetupAtMs)).deleteAt.getTime()),
    });
    tx.set(bucketRef, bucket);
    return { recipients: pod.memberUids.filter((m) => m !== uid) };
  });

  if ('warnings' in result) return result;
  await notifyMembers(deps, input.podId, result.recipients, now);
  return { messageId: messageRef.id };
}

/**
 * "New message in your pod" to the other members, at most once per member and pod per CHAT_PUSH_THROTTLE_MS
 * (a one-take window per member). Best-effort: the message is already stored, so a failure here must not make
 * the client resend it. A slot is used even if FCM then fails, because a missed generic push is harmless and a
 * burst is not.
 */
async function notifyMembers(deps: AppDeps, podId: string, members: readonly string[], now: number): Promise<void> {
  if (members.length === 0) return;
  const refs = docs(deps.db);
  try {
    const slots = members.map((m) => refs.rateLimit(rateLimitKey(m, CHAT_PUSH_BUCKET, podId)));
    const due = await deps.db.runTransaction(async (tx) => {
      const snaps = await tx.getAll(...slots);
      const out: string[] = [];
      snaps.forEach((snap, i) => {
        const next = takeWindow(snap.data(), now, { limit: 1, windowMs: CHAT_PUSH_THROTTLE_MS });
        if (next === null) return;
        tx.set(slots[i]!, next);
        out.push(members[i]!);
      });
      return out;
    });
    if (due.length === 0) return;

    const found = await Promise.all(
      due.map(async (m): Promise<PushRecipient | null> => {
        const [tokens, user] = await Promise.all([refs.pushTokens(m).get(), refs.user(m).get()]);
        const list = tokens.data()?.tokens.map((t) => t.token) ?? [];
        const locale = user.data()?.locale;
        return list.length > 0 && locale !== undefined ? { locale, tokens: list } : null;
      }),
    );
    const recipients = found.filter((r) => r !== null);
    if (recipients.length > 0) await deps.push('chatMessage', recipients);
  } catch (err) {
    deps.log.warn('sendMessage.pushFailed', errorFields(err));
  }
}
