import { describe, expect, it } from 'vitest';
import {
  backfillDeadline,
  dropSchedule,
  feedbackClosesAt,
  meetupTimers,
  nextDropWeek,
  participationEffectiveWeek,
  planningDeadline,
  proposalDecisionAt,
} from '../src/time/schedule';
import { addWeeks, dateInWeek, isoWeekOfDate, isoWeeksInYear, isWeekId, parseWeekId, weekIdAt, weeksBetween } from '../src/time/weekId';
import { fromLocal, toLocal } from '../src/time/zone';
import type { WeekId } from '../src/types/ids';

const iso = (ms: number): string => new Date(ms).toISOString();
const at = (s: string): number => Date.parse(s);

describe('ISO week ids', () => {
  it.each([
    ['2026-11-12', '2026-W46'],
    ['2026-01-01', '2026-W01'],
    ['2026-12-31', '2026-W53'],
    ['2027-01-03', '2026-W53'],
    ['2027-01-04', '2027-W01'],
    ['2024-12-30', '2025-W01'],
    ['2021-01-03', '2020-W53'],
  ])('%s is in %s', (date, week) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    expect(isoWeekOfDate({ year: y, month: m, day: d })).toBe(week);
  });

  it('knows which years have 53 weeks', () => {
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2025)).toBe(52);
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isWeekId('2026-W53')).toBe(true);
    expect(isWeekId('2025-W53')).toBe(false);
    expect(isWeekId('2026-W00')).toBe(false);
    expect(isWeekId('2026-W5')).toBe(false);
  });

  it('adds weeks and counts weeks across year boundaries', () => {
    expect(addWeeks('2026-W52' as WeekId, 1)).toBe('2026-W53');
    expect(addWeeks('2026-W53' as WeekId, 1)).toBe('2027-W01');
    expect(addWeeks('2027-W01' as WeekId, -1)).toBe('2026-W53');
    expect(addWeeks('2026-W46' as WeekId, 26)).toBe('2027-W19');
    expect(weeksBetween('2026-W46' as WeekId, '2027-W19' as WeekId)).toBe(26);
    expect(weeksBetween('2027-W01' as WeekId, '2026-W52' as WeekId)).toBe(-2);
    expect(dateInWeek('2026-W53' as WeekId, 4)).toEqual({ year: 2026, month: 12, day: 31 });
    expect(parseWeekId('2026-W46')).toEqual({ year: 2026, week: 46 });
  });

  it('uses the Copenhagen calendar date, not UTC', () => {
    // Sunday 23:30 in Copenhagen is still week 46; in UTC it is already Sunday 22:30, same week,
    // but Monday 00:30 local (Sunday 23:30 UTC) belongs to week 47.
    expect(weekIdAt(at('2026-11-15T22:30:00Z'))).toBe('2026-W46');
    expect(weekIdAt(at('2026-11-15T23:30:00Z'))).toBe('2026-W47');
  });
});

describe('time zone conversion', () => {
  it('round-trips local wall time through DST changes', () => {
    expect(iso(fromLocal({ year: 2026, month: 3, day: 29, hour: 18, minute: 0 }))).toBe('2026-03-29T16:00:00.000Z');
    expect(iso(fromLocal({ year: 2026, month: 3, day: 28, hour: 18, minute: 0 }))).toBe('2026-03-28T17:00:00.000Z');
    expect(toLocal(at('2026-10-25T00:30:00Z'))).toMatchObject({ hour: 2, minute: 30 });
    expect(toLocal(at('2026-10-25T01:30:00Z'))).toMatchObject({ hour: 2, minute: 30 });
  });

  it('shifts a wall time inside the spring-forward gap forward', () => {
    expect(iso(fromLocal({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }))).toBe('2026-03-29T01:30:00.000Z');
  });
});

describe('drop schedule (§4.1)', () => {
  it('computes an ordinary winter week', () => {
    const s = dropSchedule('2026-W46' as WeekId);
    expect(iso(s.nudgeAt)).toBe('2026-11-09T09:00:00.000Z');
    expect(iso(s.optInCutoffAt)).toBe('2026-11-12T11:00:00.000Z');
    expect(iso(s.computeAt)).toBe('2026-11-12T15:00:00.000Z');
    expect(iso(s.releaseAt)).toBe('2026-11-12T17:00:00.000Z');
    expect(iso(s.acceptBy)).toBe('2026-11-14T17:00:00.000Z');
    expect(iso(s.backfillLatest)).toBe('2026-11-15T17:00:00.000Z');
    expect(s.acceptBy - s.releaseAt).toBe(48 * 3_600_000);
  });

  it('is DST-correct in the spring-forward week (2026-W13, clocks change Sunday 29 March)', () => {
    const s = dropSchedule('2026-W13' as WeekId);
    expect(iso(s.releaseAt)).toBe('2026-03-26T17:00:00.000Z');
    expect(iso(s.acceptBy)).toBe('2026-03-28T17:00:00.000Z');
    expect(iso(s.backfillLatest)).toBe('2026-03-29T16:00:00.000Z');
    expect(s.backfillLatest - s.releaseAt).toBe(71 * 3_600_000);
    expect(iso(dropSchedule('2026-W14' as WeekId).nudgeAt)).toBe('2026-03-30T08:00:00.000Z');
  });

  it('is DST-correct in the fall-back week (2026-W43, clocks change Sunday 25 October)', () => {
    const s = dropSchedule('2026-W43' as WeekId);
    expect(iso(s.releaseAt)).toBe('2026-10-22T16:00:00.000Z');
    expect(iso(s.backfillLatest)).toBe('2026-10-25T17:00:00.000Z');
    expect(s.backfillLatest - s.releaseAt).toBe(73 * 3_600_000);
    expect(iso(dropSchedule('2026-W44' as WeekId).computeAt)).toBe('2026-10-29T15:00:00.000Z');
  });

  it('handles the week that spans the new year', () => {
    const s = dropSchedule('2026-W53' as WeekId);
    expect(iso(s.releaseAt)).toBe('2026-12-31T17:00:00.000Z');
    expect(iso(s.backfillLatest)).toBe('2027-01-03T17:00:00.000Z');
  });

  it('caps the backfill deadline at Sunday 18:00 and picks the later decision time', () => {
    const s = dropSchedule('2026-W46' as WeekId);
    const early = s.acceptBy;
    expect(backfillDeadline(early, '2026-W46' as WeekId)).toBe(s.backfillLatest);
    const thu = s.releaseAt + 3_600_000;
    expect(backfillDeadline(thu, '2026-W46' as WeekId)).toBe(thu + 24 * 3_600_000);
    expect(proposalDecisionAt(s.acceptBy, null)).toBe(s.acceptBy);
    expect(proposalDecisionAt(s.acceptBy, s.backfillLatest)).toBe(s.backfillLatest);
  });

  it('computes planning, meetup and feedback timers as absolute offsets', () => {
    const t = at('2026-11-14T10:00:00Z');
    expect(planningDeadline(t, 'confirmation') - t).toBe(72 * 3_600_000);
    expect(planningDeadline(t, 'keep') - t).toBe(72 * 3_600_000);
    expect(planningDeadline(t, 'reschedule') - t).toBe(48 * 3_600_000);
    expect(planningDeadline(t, 'replan') - t).toBe(48 * 3_600_000);
    expect(meetupTimers(t)).toEqual({ stillComingAt: t - 86_400_000, attendanceCheckAt: t - 6 * 3_600_000, reminderAt: t - 2 * 3_600_000, happenedAt: t + 2 * 3_600_000 });
    expect(feedbackClosesAt(t) - t).toBe(7 * 86_400_000);
  });

  it('applies participation changes at the right drop', () => {
    const wed = at('2026-11-11T12:00:00Z');
    const thuAfterCutoff = at('2026-11-12T11:30:00Z');
    const thuAfterRelease = at('2026-11-12T17:30:00Z');
    expect(participationEffectiveWeek('auto', wed)).toBe('2026-W46');
    expect(participationEffectiveWeek('auto', thuAfterCutoff)).toBe('2026-W47');
    expect(participationEffectiveWeek('pause', thuAfterCutoff)).toBe('2026-W46');
    expect(participationEffectiveWeek('skipNext', thuAfterCutoff)).toBe('2026-W46');
    expect(participationEffectiveWeek('skipNext', thuAfterRelease)).toBe('2026-W47');
    expect(nextDropWeek(thuAfterRelease)).toBe('2026-W47');
  });
});
