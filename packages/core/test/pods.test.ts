import { describe, expect, it } from 'vitest';
import {
  attendanceAtPlanLock,
  attendanceCheckPasses,
  attendanceFromNotThere,
  canBackfill,
  comingCount,
  markUnconfirmed,
  membersToNudge,
  planningDeadlineOutcome,
  podNextStep,
  type PodNextStepInput,
} from '../src/pods';
import { meetupTimers } from '../src/time/schedule';
import { POD_STATES } from '../src/types/domain';

describe('attendance (D5)', () => {
  it('counts a yes vote for the winning option as coming at plan lock', () => {
    expect(attendanceAtPlanLock(['a', 'b', 'c', 'd'], { a: 'yes', b: 'no', c: 'yes' })).toEqual({ a: 'coming', b: 'pending', c: 'coming', d: 'pending' });
  });

  it('nudges only members without an answer, then marks them unconfirmed', () => {
    const s = { a: 'coming', b: 'pending', c: 'notComing', d: 'pending' } as const;
    expect(membersToNudge(s)).toEqual(['b', 'd']);
    expect(markUnconfirmed(s)).toEqual({ a: 'coming', b: 'unconfirmed', c: 'notComing', d: 'unconfirmed' });
  });

  it('does not count unconfirmed members as coming: fewer than 3 coming fails the check', () => {
    const s = markUnconfirmed({ a: 'coming', b: 'coming', c: 'pending', d: 'pending' });
    expect(comingCount(s)).toBe(2);
    expect(attendanceCheckPasses(s)).toBe(false);
    expect(attendanceCheckPasses({ ...s, c: 'coming' })).toBe(true);
  });

  it('resolves "Who was there?" with everyone pre-ticked (D15)', () => {
    expect(attendanceFromNotThere(['b', 'c', 'd'], [])).toEqual({ b: 'came', c: 'came', d: 'came' });
    expect(attendanceFromNotThere(['b', 'c', 'd'], ['c'])).toEqual({ b: 'came', c: 'noShow', d: 'came' });
    expect(() => attendanceFromNotThere(['b', 'c'], ['x'])).toThrow();
  });
});

describe('planning (D6, D7)', () => {
  it('gives one 24 h extension before a never-met pod dissolves or a keep-loop pod archives', () => {
    expect(planningDeadlineOutcome({ hasWinner: true, extensionUsed: false, hasMet: false })).toBe('schedule');
    expect(planningDeadlineOutcome({ hasWinner: true, extensionUsed: true, hasMet: true })).toBe('schedule');
    expect(planningDeadlineOutcome({ hasWinner: false, extensionUsed: false, hasMet: false })).toBe('extend');
    expect(planningDeadlineOutcome({ hasWinner: false, extensionUsed: false, hasMet: true })).toBe('extend');
    expect(planningDeadlineOutcome({ hasWinner: false, extensionUsed: true, hasMet: false })).toBe('dissolve');
    expect(planningDeadlineOutcome({ hasWinner: false, extensionUsed: true, hasMet: true })).toBe('archive');
  });

  it('backfills only before the plan locks, once', () => {
    expect(POD_STATES.filter((s) => canBackfill(s, false, false))).toEqual(['proposed', 'planning']);
    expect(canBackfill('planning', true, false)).toBe(false);
  });

  it('never backfills a pod whose plan locked once, even back in planning for a reschedule or keep-loop round', () => {
    expect(POD_STATES.filter((s) => canBackfill(s, false, true))).toEqual([]);
  });
});

describe('next step card (D13)', () => {
  const H = 3_600_000;
  const meetupAt = Date.UTC(2026, 10, 20, 17);
  const t = meetupTimers(meetupAt, meetupAt - 5 * 24 * H);
  const base: PodNextStepInput = {
    state: 'scheduled', now: meetupAt - 4 * 24 * H, votedOnAllOptions: true, optionCount: 2, extended: false, meetupAt, myAttendance: 'pending', attendanceAskedAt: null, feedbackGiven: false,
  };

  it('asks for a new option when there is none yet, or in the extension round once the viewer has voted on all', () => {
    const planning = { ...base, state: 'planning' as const, meetupAt: null };
    expect(podNextStep({ ...planning, optionCount: 0 })).toBe('addOption');
    expect(podNextStep({ ...planning, extended: true })).toBe('addOption');
    expect(podNextStep({ ...planning, extended: true, votedOnAllOptions: false })).toBe('vote');
  });

  it('walks vote → confirm attendance → chat → feedback', () => {
    expect(podNextStep({ ...base, state: 'planning', votedOnAllOptions: false, meetupAt: null })).toBe('vote');
    expect(podNextStep({ ...base, state: 'planning', meetupAt: null })).toBeNull();
    expect(podNextStep(base)).toBeNull();
    expect(podNextStep({ ...base, now: t.stillComing3d!, attendanceAskedAt: t.stillComing3d })).toBe('confirmAttendance');
    expect(podNextStep({ ...base, now: t.stillComing24h, attendanceAskedAt: t.stillComing24h, myAttendance: 'unconfirmed' })).toBe('confirmAttendance');
    expect(podNextStep({ ...base, now: t.stillComing24h, attendanceAskedAt: t.stillComing24h, myAttendance: 'coming' })).toBe('chat');
    expect(podNextStep({ ...base, state: 'happened', now: t.happened })).toBe('feedback');
    expect(podNextStep({ ...base, state: 'happened', now: t.happened, feedbackGiven: true })).toBe('chat');
    expect(podNextStep({ ...base, state: 'happened', now: meetupAt + 25 * H, feedbackGiven: true })).toBeNull();
    expect(podNextStep({ ...base, state: 'archived' })).toBeNull();
  });
});
