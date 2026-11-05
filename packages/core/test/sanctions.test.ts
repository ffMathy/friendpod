import { describe, expect, it } from 'vitest';
import {
  NO_SHOW_PAUSE_MS,
  NO_SHOW_SUSPENSION_MS,
  REPORT_PAUSE_MS,
  SENSITIVE_HOLD_MS,
  UNDERAGE_PAUSE_MS,
  mergeSanction,
  noShowSanction,
  noShowWeight,
  reportOutcome,
  type WeekId,
} from '../src';

const w = (s: string) => s as WeekId;
const NOW = Date.UTC(2027, 0, 10);
const DAY = 86_400_000;

describe('no-show rule (§4.4)', () => {
  it('counts weight within 8 weeks only: 2 pauses for 2 weeks, 3 suspends for 8 weeks', () => {
    expect(noShowWeight([{ weekId: w('2026-W45'), w: 1 }, { weekId: w('2027-W01'), w: 0.5 }], w('2027-W02'))).toBe(0.5);
    expect(noShowSanction([{ weekId: w('2027-W01'), w: 1 }, { weekId: w('2027-W02'), w: 0.5 }], w('2027-W02'), NOW)).toBeNull();
    expect(noShowSanction([{ weekId: w('2026-W52'), w: 1 }, { weekId: w('2027-W02'), w: 1 }], w('2027-W02'), NOW)).toMatchObject({ type: 'pause', until: NOW + NO_SHOW_PAUSE_MS, reason: 'noShow' });
    const three = [1, 1, 0.5, 0.5].map((x, i) => ({ weekId: w(`2027-W0${i + 1}`), w: x as 1 | 0.5 }));
    expect(noShowSanction(three, w('2027-W04'), NOW)).toMatchObject({ type: 'suspension', until: NOW + NO_SHOW_SUSPENSION_MS });
  });
});

describe('report rules (§3.7, S7)', () => {
  const base = { reporterKey: 'r1', podId: 'p1', sensitivePod: false } as const;
  it('pauses on two independent reports within 30 days, or one safety report', () => {
    expect(reportOutcome({ ...base, category: 'content' }, [], NOW).decision).toBe('RECORDED');
    expect(reportOutcome({ ...base, category: 'content' }, [{ reporterKey: 'r1', podId: 'p1', category: 'harassment', createdAt: NOW - DAY }], NOW).sanction).toBeNull();
    expect(reportOutcome({ ...base, category: 'content' }, [{ reporterKey: 'r2', podId: 'p1', category: 'harassment', createdAt: NOW - 31 * DAY }], NOW).sanction).toBeNull();
    expect(reportOutcome({ ...base, category: 'content' }, [{ reporterKey: 'r2', podId: 'p2', category: 'harassment', createdAt: NOW - DAY }], NOW).sanction).toMatchObject({ until: NOW + REPORT_PAUSE_MS, reason: 'reports' });
    expect(reportOutcome({ ...base, category: 'safety' }, [], NOW).sanction).toMatchObject({ until: NOW + REPORT_PAUSE_MS });
  });

  it('under 18: pauses, and restarts only on a report from another pod; "not a genuine member" holds in sensitive pods only', () => {
    expect(reportOutcome({ ...base, category: 'underage' }, [], NOW).sanction).toMatchObject({ reason: 'underageReport', until: NOW + UNDERAGE_PAUSE_MS });
    const prior = [{ reporterKey: 'r0', podId: 'p1', category: 'underage' as const, createdAt: NOW - DAY }];
    expect(reportOutcome({ ...base, category: 'underage' }, prior, NOW, { since: NOW - DAY }).sanction).toBeNull();
    expect(reportOutcome({ ...base, podId: 'p2', category: 'underage' }, prior, NOW, { since: NOW - DAY }).decision).toBe('PAUSE_RESTARTED');
    expect(reportOutcome({ ...base, category: 'notGenuine', sensitivePod: true }, [], NOW)).toMatchObject({ sanction: null, sensitiveHoldUntil: NOW + SENSITIVE_HOLD_MS, decision: 'HOLD' });
    expect(reportOutcome({ ...base, category: 'notGenuine' }, [], NOW).sensitiveHoldUntil).toBeNull();
  });

  it('merges sanctions: a suspension outranks a pause, the later end wins, nothing is longer than both', () => {
    const pause = { type: 'pause' as const, reason: 'reports' as const, until: NOW + 10 * DAY, noticeCode: 'PAUSE_REPORTS' as const };
    expect(mergeSanction({ type: 'suspension', reason: 'noShow', until: NOW + 20 * DAY }, pause, NOW)).toMatchObject({ type: 'suspension', reason: 'noShow', until: NOW + 20 * DAY });
    expect(mergeSanction({ type: 'pause', reason: 'noShow', until: NOW + 5 * DAY }, pause, NOW)).toMatchObject({ type: 'pause', reason: 'reports', until: NOW + 10 * DAY });
    expect(mergeSanction({ type: 'pause', reason: 'noShow', until: NOW - 1 }, pause, NOW)).toEqual(pause);
  });
});
