import type { PodCardDoc } from '@grouper/core';
import type { Href, router as appRouter } from 'expo-router';

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

/** The tab a push destination is a page of: This week (`index`), or the Pods tab's list and pod page. */
type PushTab = 'index' | '(pods)';

/**
 * Which tab a destination of `routeForPush` belongs to, or null for the screens shown over the tabs (the meetup chat,
 * the notices list).
 */
export function tabForRoute(href: Href): PushTab | null {
  const path = typeof href === 'string' ? href : href.pathname;
  if (path === '/') return 'index';
  if (path === '/pods' || path === '/pod/[podId]') return '(pods)';
  return null;
}

/**
 * Opens a push destination from wherever the user is (`segments`, from `useSegments()`). A screen over the tabs is opened
 * on top. A page of a tab is shown in its tab, with the tab's first page underneath (the Pods list under a pod), and
 * without a second copy of the tabs: from a screen over the tabs, or within the same tab, everything above it is
 * dismissed first; from another tab it is a switch of tabs.
 */
export function openPushRoute(router: Pick<typeof appRouter, 'navigate' | 'dismissTo'>, href: Href, segments: readonly string[]): void {
  const tab = tabForRoute(href);
  if (tab === null) {
    router.navigate(href);
    return;
  }
  // "/" is also where sign-in and onboarding start; This week is named by its group so it resolves from anywhere.
  const target: Href = tab === 'index' ? '/(tabs)' : href;
  const currentTab = segments[0] === '(tabs)' ? (segments[1] ?? 'index') : null;
  if (currentTab === null || currentTab === tab) router.dismissTo(target, { withAnchor: true });
  else router.navigate(target, { withAnchor: true });
}
