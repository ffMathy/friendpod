import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FUNNEL_MILESTONE_FIELD,
  FUNNEL_NO_AREA,
  FUNNEL_STAGES,
  funnelDocId,
  funnelExpiresAtMs,
  funnelWeekId,
  meetupMilestone,
  newMilestones,
  suppressFunnelCounts,
} from '../src/metrics/funnel';
import { funnelDocSchema, matchProfileDocSchema, milestonesSchema } from '../src/schemas/documents';
import type { WeekId } from '../src/types/ids';

const ts = { toMillis: () => 0 };

describe('funnel (§6.8)', () => {
  it('has the eight founder stages in order, each with its own milestone field', () => {
    expect(FUNNEL_STAGES).toEqual(['signup', 'onboarded', 'waitlisted', 'firstDropEligible', 'firstProposal', 'firstConfirmed', 'firstMeetupHappened', 'secondMeetup']);
    expect(new Set(Object.values(FUNNEL_MILESTONE_FIELD)).size).toBe(FUNNEL_STAGES.length);
    expect(Object.keys(milestonesSchema.shape).sort()).toEqual(Object.values(FUNNEL_MILESTONE_FIELD).sort());
  });

  it('keys docs by area and ISO week (Europe/Copenhagen), with `none` outside every area', () => {
    expect(funnelDocId('aarhus', '2026-W45' as WeekId)).toBe('aarhus_2026-W45');
    expect(funnelDocId(null, '2026-W45' as WeekId)).toBe(`${FUNNEL_NO_AREA}_2026-W45`);
    // Sunday 8 Nov 2026 23:30 UTC is Monday 9 Nov in Copenhagen: week 46.
    expect(funnelWeekId(Date.UTC(2026, 10, 8, 23, 30))).toBe('2026-W46');
    expect(funnelWeekId(Date.UTC(2026, 10, 8, 22, 30))).toBe('2026-W45');
  });

  it('expires a doc 104 weeks after its week starts (24 months)', () => {
    expect(new Date(funnelExpiresAtMs('2026-W45' as WeekId)).toISOString()).toBe('2028-10-30T00:00:00.000Z');
  });

  it('counts each user once per stage', () => {
    expect(newMilestones({}, ['signup', 'onboarded'])).toEqual(['signup', 'onboarded']);
    expect(newMilestones({ signupAt: ts }, ['onboarded', 'signup'])).toEqual(['onboarded']);
    fc.assert(
      fc.property(fc.subarray([...FUNNEL_STAGES]), fc.subarray([...FUNNEL_STAGES]), (reached, asked) => {
        const m = Object.fromEntries(reached.map((s) => [FUNNEL_MILESTONE_FIELD[s], ts]));
        const fresh = newMilestones(m, asked);
        for (const s of fresh) expect(reached).not.toContain(s);
        // After recording them, asking again yields nothing.
        const after = { ...m, ...Object.fromEntries(fresh.map((s) => [FUNNEL_MILESTONE_FIELD[s], ts])) };
        expect(newMilestones(after, asked)).toEqual([]);
      }),
    );
  });

  it('turns happened meetups into the first, then the second meetup, then nothing', () => {
    expect(meetupMilestone({})).toBe('firstMeetupHappened');
    expect(meetupMilestone({ firstMeetupHappenedAt: ts })).toBe('secondMeetup');
    expect(meetupMilestone({ firstMeetupHappenedAt: ts, secondMeetupAt: ts })).toBeNull();
  });

  it('suppresses cells 1–9 as "<10" for display', () => {
    expect(suppressFunnelCounts({ signup: 0, onboarded: 9, waitlisted: 10, firstDropEligible: 250 })).toEqual({
      signup: 0, onboarded: '<10', waitlisted: 10, firstDropEligible: 250, firstProposal: 0, firstConfirmed: 0, firstMeetupHappened: 0, secondMeetup: 0,
    });
  });

  it('validates funnel docs, filling missing counters with 0, and holds no uid', () => {
    const doc = funnelDocSchema.parse({ areaId: 'vejle', weekId: '2026-W45', counts: { signup: 3 }, expiresAt: ts });
    expect(doc.counts).toMatchObject({ signup: 3, onboarded: 0, secondMeetup: 0 });
    expect(Object.keys(funnelDocSchema.shape).sort()).toEqual(['areaId', 'counts', 'expiresAt', 'weekId']);
    expect(funnelDocSchema.safeParse({ areaId: 'none', weekId: '2026-W45', counts: {}, expiresAt: ts }).success).toBe(true);
    expect(funnelDocSchema.safeParse({ areaId: 'vejle', weekId: '2026-W45', counts: { signup: -1 }, expiresAt: ts }).success).toBe(false);
  });

  it('defaults milestones to {} on older match profiles and rejects unknown milestones', () => {
    expect(milestonesSchema.safeParse({ signupAt: ts, firstTimerAt: ts }).success).toBe(false);
    expect(matchProfileDocSchema.shape.milestones.parse(undefined)).toEqual({});
  });
});
