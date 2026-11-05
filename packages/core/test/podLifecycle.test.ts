import { describe, expect, it } from 'vitest';
import {
  appendNoShowEvent,
  isLateCancel,
  optionTimeOk,
  resolveAttendance,
  unanimousYes,
  winningOption,
  yesVotes,
  type FeedbackAttendance,
  type NoShowEvent,
} from '../src/pods';
import { dropSchedule, latestReleasedDropWeek } from '../src/time/schedule';
import { fromLocal } from '../src/time/zone';
import type { WeekId } from '../src/types/ids';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('winning option (§3.5)', () => {
  const members = ['a', 'b', 'c', 'd'];
  const now = 1_000;
  it('needs at least 3 yes votes from current members; ties go to the earlier time, then the lower id', () => {
    const o = (id: string, startsAt: number, yes: string[]) => ({ id, startsAt, votes: Object.fromEntries(yes.map((u) => [u, 'yes' as const])) });
    expect(winningOption([o('x', 5_000, ['a', 'b'])], members, now)).toBeNull();
    expect(winningOption([o('x', 5_000, ['a', 'b', 'gone'])], members, now)).toBeNull();
    expect(winningOption([o('x', 5_000, ['a', 'b', 'c'])], members, now)?.id).toBe('x');
    expect(winningOption([o('late', 9_000, ['a', 'b', 'c']), o('early', 5_000, ['b', 'c', 'd'])], members, now)?.id).toBe('early');
    expect(winningOption([o('y', 5_000, ['a', 'b', 'c']), o('x', 5_000, ['b', 'c', 'd'])], members, now)?.id).toBe('x');
    expect(winningOption([o('three', 5_000, ['a', 'b', 'c']), o('four', 9_000, members)], members, now)?.id).toBe('four');
    // An option whose time has come cannot win.
    expect(winningOption([o('past', now, members)], members, now)).toBeNull();
  });

  it('locks early only on a yes from every current member', () => {
    const opt = { id: 'x', startsAt: 1, votes: { a: 'yes', b: 'yes', c: 'yes', d: 'no' } as const };
    expect(yesVotes(opt, members)).toBe(3);
    expect(unanimousYes(opt, members)).toBe(false);
    expect(unanimousYes(opt, ['a', 'b', 'c'])).toBe(true);
    expect(unanimousYes(opt, [])).toBe(false);
  });
});

describe('option window (§4.3)', () => {
  const now = fromLocal({ year: 2027, month: 3, day: 10, hour: 12, minute: 0 });
  it('allows 08:00–22:00 local time within 14 days, never in the past', () => {
    expect(optionTimeOk(fromLocal({ year: 2027, month: 3, day: 12, hour: 8, minute: 0 }), now)).toBe(true);
    expect(optionTimeOk(fromLocal({ year: 2027, month: 3, day: 12, hour: 22, minute: 0 }), now)).toBe(true);
    expect(optionTimeOk(fromLocal({ year: 2027, month: 3, day: 12, hour: 22, minute: 1 }), now)).toBe(false);
    expect(optionTimeOk(fromLocal({ year: 2027, month: 3, day: 12, hour: 7, minute: 59 }), now)).toBe(false);
    expect(optionTimeOk(now + 14 * DAY, now)).toBe(true);
    expect(optionTimeOk(now + 14 * DAY + 1, now)).toBe(false);
    expect(optionTimeOk(now, now)).toBe(false);
    // Across the spring DST change the local hour still decides: 08:00 CEST is 06:00Z.
    const later = now + 10 * DAY;
    expect(optionTimeOk(Date.UTC(2027, 2, 29, 6), later)).toBe(true);
    expect(optionTimeOk(Date.UTC(2027, 2, 29, 5, 59), later)).toBe(false);
  });

  it('counts a cancellation under 24 h before the meetup as late (§4.4)', () => {
    expect(isLateCancel(100 * HOUR, 76 * HOUR)).toBe(false);
    expect(isLateCancel(100 * HOUR, 76 * HOUR + 1)).toBe(true);
  });
});

describe('no-show majority rule (§4.4, D15)', () => {
  const fb = (notThere: string[], members: string[], self: string): FeedbackAttendance => ({
    met: true,
    attendance: Object.fromEntries(members.filter((m) => m !== self).map((m) => [m, notThere.includes(m) ? 'noShow' : 'came'])),
  });
  const members = ['a', 'b', 'c', 'd'];

  it('needs more than half of the other responders, and never applies to a cancellation', () => {
    const r = resolveAttendance(members, { a: fb(['d'], members, 'a'), b: fb(['d'], members, 'b'), c: fb([], members, 'c') }, new Set());
    expect(r.d).toEqual({ outcome: 'noShow', cameVotes: 1 });
    expect(r.a).toEqual({ outcome: 'attended', cameVotes: 2 });
    const half = resolveAttendance(members, { a: fb(['d'], members, 'a'), b: fb([], members, 'b') }, new Set());
    expect(half.d!.outcome).toBe('attended');
    const cancelled = resolveAttendance(members, { a: fb(['d'], members, 'a'), b: fb(['d'], members, 'b') }, new Set(['d']));
    expect(cancelled.d!.outcome).toBe('cancelled');
  });

  it('ignores "we did not meet" answers and never turns silence into a no-show', () => {
    const r = resolveAttendance(members, { a: { met: false, attendance: {} } }, new Set());
    expect(Object.values(r).map((x) => x.outcome)).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
    const self = resolveAttendance(members, { a: fb([], members, 'a') }, new Set());
    expect(self.a!.outcome).toBe('attended');
  });

  it('keeps the last 8 no-show events within 26 weeks', () => {
    const w = (n: number) => `2027-W${String(n).padStart(2, '0')}` as WeekId;
    let events: NoShowEvent[] = Array.from({ length: 8 }, (_, i) => ({ weekId: w(i + 20), w: 1 as const }));
    events = appendNoShowEvent(events, { weekId: w(30), w: 0.5 }, w(30));
    expect(events).toHaveLength(8);
    expect(events[0]!.weekId).toBe(w(21));
    expect(appendNoShowEvent([{ weekId: w(1), w: 1 }], { weekId: w(30), w: 1 }, w(30))).toEqual([{ weekId: w(30), w: 1 }]);
  });
});

describe('latest released drop (§4.2 backfill pool)', () => {
  it('is this week from Thursday 18:00, else last week', () => {
    const s = dropSchedule('2027-W10' as WeekId);
    expect(latestReleasedDropWeek(s.releaseAt)).toBe('2027-W10');
    expect(latestReleasedDropWeek(s.releaseAt - 1)).toBe('2027-W09');
    expect(latestReleasedDropWeek(s.backfillLatest)).toBe('2027-W10');
  });
});
