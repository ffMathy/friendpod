import { chatWindow, isChatOpen, type PodDoc, type PodState } from '@grouper/core';
import { useEffect, useState } from 'react';

/**
 * Where a pod's meetup chat stands for the viewer (§3.6, §4.6 "Meetup chat window"):
 * - upcoming: a meetup is scheduled and its window opens later;
 * - open:     `isChatOpen` and the pod is still `scheduled` or `happened`, as `sendMessage` requires;
 * - ended:    24 h after the meetup;
 * - off:      no meetup is scheduled (never, or it was moved or cancelled), which also closes an open chat.
 */
export type ChatStatus =
  | { readonly kind: 'upcoming'; readonly opensAt: Date; readonly closesAt: Date }
  | { readonly kind: 'open'; readonly closesAt: Date }
  | { readonly kind: 'ended' }
  | { readonly kind: 'off' };

export type ChatPod = Pick<PodDoc, 'state' | 'planning'>;

const CHAT_STATES: ReadonlySet<PodState> = new Set(['scheduled', 'happened']);

export function chatStatus(pod: ChatPod, now: number): ChatStatus {
  const at = pod.planning.meetupAt;
  if (!at) return { kind: 'off' };
  const meetupAt = new Date(at.toMillis());
  const { opensAt, closesAt } = chatWindow(meetupAt);
  if (now >= closesAt.getTime()) return { kind: 'ended' };
  if (!CHAT_STATES.has(pod.state)) return { kind: 'off' };
  if (isChatOpen(meetupAt, new Date(now))) return { kind: 'open', closesAt };
  return { kind: 'upcoming', opensAt, closesAt };
}

/** setTimeout's limit; a longer wait just wakes up early and waits again. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * `chatStatus` that re-renders when the window opens or closes. The clock is state rather than read during render,
 * so the React Compiler cannot memoise a stale status.
 */
export function useChatStatus(pod: ChatPod | null | undefined): ChatStatus | null {
  const [now, setNow] = useState(() => Date.now());
  const meetupMs = pod?.planning.meetupAt?.toMillis() ?? null;

  useEffect(() => {
    setNow(Date.now());
    if (meetupMs === null) return undefined;
    const { opensAt, closesAt } = chatWindow(new Date(meetupMs));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wakeAtNextBoundary = () => {
      const current = Date.now();
      const next = [opensAt.getTime(), closesAt.getTime()].find((boundary) => boundary > current);
      if (next === undefined) return;
      timer = setTimeout(() => {
        setNow(Date.now());
        wakeAtNextBoundary();
      }, Math.min(next - current, MAX_TIMEOUT_MS));
    };
    wakeAtNextBoundary();
    return () => clearTimeout(timer);
  }, [meetupMs]);

  return pod ? chatStatus(pod, now) : null;
}
