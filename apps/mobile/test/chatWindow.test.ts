import { act, renderHook } from '@testing-library/react-native';
import { chatStatus, useChatStatus, type ChatPod } from '@/features/chat/window';

const HOUR = 3_600_000;
const T = Date.UTC(2026, 10, 12, 17, 0); // a meetup on Thursday 12 November 2026, 18:00 in Copenhagen

const pod = (state: ChatPod['state'], meetupAt: number | null): ChatPod => ({
  state,
  planning: { deadline: { toMillis: () => T - 72 * HOUR }, ...(meetupAt === null ? {} : { meetupAt: { toMillis: () => meetupAt } }) },
});

describe('chatStatus (§4.6 "Meetup chat window")', () => {
  it('opens at T−24 h and closes at T+24 h around the scheduled meetup', () => {
    const scheduled = pod('scheduled', T);
    expect(chatStatus(scheduled, T - 24 * HOUR - 1)).toEqual({
      kind: 'upcoming',
      opensAt: new Date(T - 24 * HOUR),
      closesAt: new Date(T + 24 * HOUR),
    });
    expect(chatStatus(scheduled, T - 24 * HOUR)).toEqual({ kind: 'open', closesAt: new Date(T + 24 * HOUR) });
    expect(chatStatus(pod('happened', T), T + 24 * HOUR - 1).kind).toBe('open');
    expect(chatStatus(pod('happened', T), T + 24 * HOUR)).toEqual({ kind: 'ended' });
    expect(chatStatus(pod('archived', T), T + 7 * 24 * HOUR)).toEqual({ kind: 'ended' });
  });

  it('is off without a scheduled meetup: never scheduled, moved back to planning, or cancelled', () => {
    expect(chatStatus(pod('planning', null), T)).toEqual({ kind: 'off' });
    expect(chatStatus(pod('planning', T), T)).toEqual({ kind: 'off' });
    expect(chatStatus(pod('dissolved', T), T - HOUR)).toEqual({ kind: 'off' });
  });
});

describe('useChatStatus', () => {
  beforeEach(() => jest.useFakeTimers({ now: T - 24 * HOUR - 1000 }));
  afterEach(() => jest.useRealTimers());

  it('re-renders when the window opens and when it closes', async () => {
    const { result } = await renderHook(() => useChatStatus(pod('scheduled', T)));
    expect(result.current?.kind).toBe('upcoming');
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current?.kind).toBe('open');
    await act(async () => {
      jest.advanceTimersByTime(48 * HOUR);
    });
    expect(result.current?.kind).toBe('ended');
  });
});
