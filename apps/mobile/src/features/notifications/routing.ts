import type { PodCardDoc } from '@friendpod/core';
import type { Href } from 'expo-router';

/**
 * Push kinds the server sends (functions/src/lib/push.ts). The payload carries only `data.kind` (S4, A14): never a
 * pod id, theme, name or count, so where a tap leads is worked out here from the user's own pod cards.
 */
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

export function isPushKind(value: unknown): value is PushKind {
  return typeof value === 'string' && (PUSH_KINDS as readonly string[]).includes(value);
}

export interface CardRow {
  readonly id: string;
  readonly data: Pick<PodCardDoc, 'state' | 'myStatus'>;
}

/** Which of the viewer's confirmed pods a pod-level push can be about. */
const STATES_FOR: Partial<Record<PushKind, readonly PodCardDoc['state'][]>> = {
  podConfirmed: ['planning'],
  podChanged: ['planning', 'scheduled', 'happened'],
  stillComing: ['scheduled'],
  meetupReminder: ['scheduled'],
  chatOpen: ['scheduled', 'happened'],
  chatMessage: ['scheduled', 'happened'],
  feedback: ['happened'],
};

/**
 * Where a tapped push leads. Drop, nudge and city pushes open Home; a notice opens the notices list. A pod push opens
 * that pod (its chat for chat pushes) when exactly one of the viewer's pods fits, else the Pods tab to choose from.
 */
export function routeForPush(kind: PushKind, cards: readonly CardRow[]): Href {
  if (kind === 'notice') return '/settings/notices';
  const states = STATES_FOR[kind];
  if (!states) return '/';
  const matching = cards.filter((c) => c.data.myStatus === 'accepted' && states.includes(c.data.state));
  const only = matching.length === 1 ? matching[0] : undefined;
  if (!only) return '/pods';
  const podId = only.id;
  return kind === 'chatOpen' || kind === 'chatMessage'
    ? { pathname: '/pod/[podId]/chat', params: { podId } }
    : { pathname: '/pod/[podId]', params: { podId } };
}
