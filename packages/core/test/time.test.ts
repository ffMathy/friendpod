import { describe, expect, it } from 'vitest';
import {
  CHAT_CLOSES_AFTER_MS,
  CHAT_DELETE_AFTER_MS,
  CHAT_OPENS_BEFORE_MS,
  backfillDeadline,
  chatWindow,
  dropSchedule,
  feedbackClosesAt,
  feedbackTimers,
  isChatOpen,
  meetupTimers,
  nextDropWeek,
  participationEffectiveWeek,
  planningDeadline,
  planningExtensionDeadline,
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
    const H = 3_600_000;
    expect(meetupTimers(t, t - 5 * 24 * H)).toEqual({
      stillComing3d: t - 72 * H,
      stillComing24h: t - 24 * H,
      nudge6h: t - 6 * H,
      attendanceCheck: t - 3 * H,
      reminder: t - 2 * H,
      happened: t + 2 * H,
    });
    expect(feedbackClosesAt(t) - t).toBe(7 * 86_400_000);
    expect(planningExtensionDeadline(t) - t).toBe(24 * H);
  });

  it('asks "Still coming?" at T−3 days only when the meetup is at least 4 days after plan lock (D5)', () => {
    const t = at('2026-11-20T17:00:00Z');
    const H = 3_600_000;
    expect(meetupTimers(t, t - 96 * H).stillComing3d).toBe(t - 72 * H);
    expect(meetupTimers(t, t - 96 * H + 1).stillComing3d).toBeNull();
    expect(meetupTimers(t, t - 30 * H).stillComing3d).toBeNull();
  });

  it('sends the feedback push at 10:00 Copenhagen the morning after, and one reminder 3 days later (D12)', () => {
    const meetup = fromLocal({ year: 2026, month: 11, day: 14, hour: 19, minute: 0 });
    const f = feedbackTimers(meetup);
    expect(toLocal(f.push)).toMatchObject({ year: 2026, month: 11, day: 15, hour: 10, minute: 0 });
    expect(toLocal(f.reminder)).toMatchObject({ month: 11, day: 18, hour: 10, minute: 0 });
    expect(f.reminder - f.push).toBe(72 * 3_600_000);
    // A late meetup still gets the next calendar morning, after `happened` (T+2 h).
    const late = fromLocal({ year: 2026, month: 11, day: 14, hour: 22, minute: 0 });
    expect(toLocal(feedbackTimers(late).push)).toMatchObject({ day: 15, hour: 10 });
    expect(feedbackTimers(late).push).toBeGreaterThan(meetupTimers(late, late - 86_400_000 * 5).happened);
    // Month end.
    expect(toLocal(feedbackTimers(fromLocal({ year: 2026, month: 12, day: 31, hour: 12, minute: 0 })).push)).toMatchObject({ year: 2027, month: 1, day: 1, hour: 10 });
  });

  it('keeps 10:00 local across DST changes (D12)', () => {
    // Fall back on Sunday 25 October 2026: push Sat 24th, reminder Tue 27th, 73 elapsed hours.
    const autumn = feedbackTimers(fromLocal({ year: 2026, month: 10, day: 23, hour: 18, minute: 0 }));
    expect(new Date(autumn.push).toISOString()).toBe('2026-10-24T08:00:00.000Z');
    expect(new Date(autumn.reminder).toISOString()).toBe('2026-10-27T09:00:00.000Z');
    // Spring forward on Sunday 29 March 2026: the push falls on the DST day, at 10:00 CEST.
    const spring = feedbackTimers(fromLocal({ year: 2026, month: 3, day: 28, hour: 18, minute: 0 }));
    expect(new Date(spring.push).toISOString()).toBe('2026-03-29T08:00:00.000Z');
    expect(toLocal(spring.reminder)).toMatchObject({ month: 4, day: 1, hour: 10 });
    expect(spring.push - fromLocal({ year: 2026, month: 3, day: 28, hour: 18, minute: 0 })).toBe(15 * 3_600_000);
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

describe('meetup chat window', () => {
  const meetupAt = new Date('2026-11-14T13:00:00Z');
  const plus = (d: Date, ms: number): Date => new Date(d.getTime() + ms);

  it('opens with "Still coming?" at T−24 h, closes at T+24 h and expires messages at T+72 h', () => {
    const w = chatWindow(meetupAt);
    expect(w.opensAt.getTime()).toBe(meetupTimers(meetupAt.getTime(), 0).stillComing24h);
    expect(w.opensAt.toISOString()).toBe('2026-11-13T13:00:00.000Z');
    expect(w.closesAt.toISOString()).toBe('2026-11-15T13:00:00.000Z');
    expect(w.deleteAt.toISOString()).toBe('2026-11-17T13:00:00.000Z');
    expect([CHAT_OPENS_BEFORE_MS, CHAT_CLOSES_AFTER_MS, CHAT_DELETE_AFTER_MS]).toEqual([86_400_000, 86_400_000, 3 * 86_400_000]);
  });

  it('is open from opensAt inclusive to closesAt exclusive', () => {
    const { opensAt, closesAt } = chatWindow(meetupAt);
    expect(isChatOpen(meetupAt, plus(opensAt, -1))).toBe(false);
    expect(isChatOpen(meetupAt, opensAt)).toBe(true);
    expect(isChatOpen(meetupAt, meetupAt)).toBe(true);
    expect(isChatOpen(meetupAt, plus(closesAt, -1))).toBe(true);
    expect(isChatOpen(meetupAt, closesAt)).toBe(false);
    expect(isChatOpen(meetupAt, plus(closesAt, 3_600_000))).toBe(false);
  });

  it('keeps 24 elapsed hours across the spring-forward weekend (Sunday 29 March 2026)', () => {
    const sunday = new Date(fromLocal({ year: 2026, month: 3, day: 29, hour: 12, minute: 0 }));
    const w = chatWindow(sunday);
    expect(sunday.toISOString()).toBe('2026-03-29T10:00:00.000Z');
    expect(w.opensAt.toISOString()).toBe('2026-03-28T10:00:00.000Z');
    // Saturday 11:00 local: the wall clock moves 25 hours while 24 elapse.
    expect(toLocal(w.opensAt.getTime())).toMatchObject({ day: 28, hour: 11, minute: 0 });
    expect(toLocal(w.closesAt.getTime())).toMatchObject({ day: 30, hour: 12, minute: 0 });
    expect(isChatOpen(sunday, w.opensAt)).toBe(true);
    expect(isChatOpen(sunday, new Date(fromLocal({ year: 2026, month: 3, day: 28, hour: 10, minute: 59 })))).toBe(false);
  });

  it('keeps 24 elapsed hours across the fall-back weekend (Sunday 25 October 2026)', () => {
    const sunday = new Date(fromLocal({ year: 2026, month: 10, day: 25, hour: 12, minute: 0 }));
    const w = chatWindow(sunday);
    expect(sunday.toISOString()).toBe('2026-10-25T11:00:00.000Z');
    // Saturday 13:00 local: the wall clock moves 23 hours while 24 elapse.
    expect(toLocal(w.opensAt.getTime())).toMatchObject({ day: 24, hour: 13, minute: 0 });
    expect(toLocal(w.closesAt.getTime())).toMatchObject({ day: 26, hour: 12, minute: 0 });
    expect(w.deleteAt.getTime() - sunday.getTime()).toBe(72 * 3_600_000);
    expect(isChatOpen(sunday, new Date(fromLocal({ year: 2026, month: 10, day: 24, hour: 12, minute: 30 })))).toBe(false);
    expect(isChatOpen(sunday, new Date(fromLocal({ year: 2026, month: 10, day: 26, hour: 11, minute: 59 })))).toBe(true);
  });

  it('is never open for an invalid date', () => {
    expect(isChatOpen(new Date(Number.NaN), meetupAt)).toBe(false);
    expect(isChatOpen(meetupAt, new Date(Number.NaN))).toBe(false);
  });
});
