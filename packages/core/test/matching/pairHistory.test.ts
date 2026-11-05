import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { compatFailure } from '../../src/matching/constraints';
import { deriveContext } from '../../src/matching/context';
import { matchComponent } from '../../src/matching/matchComponent';
import {
  meetAgainOutcome,
  mergeRecentUntil,
  NEVER_WEEK_ID,
  recentUntilAfterMeetAgain,
  setRecentAfterMeetAgain,
  type MeetAgainAnswer,
} from '../../src/matching/pairHistory';
import { ALPHA_PROFILE, LAUNCH_PROFILE, recentUntilWeek } from '../../src/matching/profiles';
import { addWeeks, isWeekId } from '../../src/time/weekId';
import type { WeekId } from '../../src/types/ids';
import { matchInputArb, mkInput, mkUser, WEEK } from './fixtures';

const answer = fc.constantFrom<MeetAgainAnswer>(true, false, null);

describe('meet again (D9)', () => {
  it('turns two answers into a pair outcome: any "no" is final, mutual "yes" relaxes', () => {
    expect(meetAgainOutcome(true, true)).toBe('relaxed');
    expect(meetAgainOutcome(true, false)).toBe('never');
    expect(meetAgainOutcome(null, false)).toBe('never');
    expect(meetAgainOutcome(true, null)).toBe('pending');
    expect(meetAgainOutcome(true, null, true)).toBe('none');
    expect(meetAgainOutcome(null, null)).toBe('none');
    fc.assert(
      fc.property(answer, answer, fc.boolean(), (a, b, closed) => {
        expect(meetAgainOutcome(a, b, closed)).toBe(meetAgainOutcome(b, a, closed));
      }),
    );
  });

  it('shortens the co-member window to 4 weeks after a mutual yes, in both profiles', () => {
    expect(recentUntilAfterMeetAgain(WEEK, 'relaxed', LAUNCH_PROFILE)).toBe(addWeeks(WEEK, 4));
    expect(recentUntilAfterMeetAgain(WEEK, 'relaxed', ALPHA_PROFILE)).toBe(addWeeks(WEEK, 4));
    expect(recentUntilAfterMeetAgain(WEEK, 'never', LAUNCH_PROFILE)).toBe(NEVER_WEEK_ID);
    expect(recentUntilAfterMeetAgain(WEEK, 'pending', LAUNCH_PROFILE)).toBeNull();
    expect(recentUntilAfterMeetAgain(WEEK, 'none', LAUNCH_PROFILE)).toBeNull();
    expect(isWeekId(NEVER_WEEK_ID)).toBe(true);
  });

  it('writes recentH so that "never" is final and a relaxation only replaces the co-member window', () => {
    const coMember = recentUntilWeek(WEEK, 'coMember', LAUNCH_PROFILE);
    const relaxed = addWeeks(WEEK, 4);
    expect(setRecentAfterMeetAgain(coMember, relaxed, coMember)).toBe(relaxed);
    expect(setRecentAfterMeetAgain(undefined, relaxed, coMember)).toBe(relaxed);
    expect(setRecentAfterMeetAgain(NEVER_WEEK_ID, relaxed, coMember)).toBe(NEVER_WEEK_ID);
    expect(setRecentAfterMeetAgain(relaxed, NEVER_WEEK_ID, coMember)).toBe(NEVER_WEEK_ID);
    const later = addWeeks(coMember, 2);
    expect(setRecentAfterMeetAgain(later, relaxed, coMember)).toBe(later);
    expect(mergeRecentUntil(NEVER_WEEK_ID, relaxed)).toBe(NEVER_WEEK_ID);
    expect(mergeRecentUntil(undefined, relaxed)).toBe(relaxed);
  });

  it('H5 lets a mutual-yes pair meet again from week +4 and never a pair with a "no"', () => {
    fc.assert(
      fc.property(answer, answer, fc.integer({ min: 0, max: 60 }), fc.boolean(), (a, b, weeksLater, oneSided) => {
        const outcome = meetAgainOutcome(a, b, true);
        const coMember = recentUntilWeek(WEEK, 'coMember', LAUNCH_PROFILE);
        const after = recentUntilAfterMeetAgain(WEEK, outcome, LAUNCH_PROFILE);
        const until = after === null ? coMember : setRecentAfterMeetAgain(coMember, after, coMember);
        // Either side's entry is enough for H5, so the property also holds when only one profile was updated.
        const users = [mkUser('u1', { recentH: { h_u2: until } }), mkUser('u2', { recentH: oneSided ? {} : { h_u1: until } })];
        const now = addWeeks(WEEK, weeksLater);
        const ctx = deriveContext({ ...mkInput(users), weekId: now as WeekId });
        const failure = compatFailure(ctx, 0, 1);
        const expectedOpen = outcome === 'never' ? false : outcome === 'relaxed' ? weeksLater >= 4 : weeksLater >= 26;
        expect(failure === null, `${outcome} after ${weeksLater} weeks`).toBe(expectedOpen);
        if (!expectedOpen) expect(failure).toBe('H5');
      }),
      { numRuns: 400 },
    );
  });

  it('never places a soft-blocked pair in one pod, whichever side said no', () => {
    fc.assert(
      fc.property(matchInputArb, fc.array(fc.tuple(fc.nat(), fc.nat(), fc.boolean()), { maxLength: 30 }), (input, picks) => {
        const users = [...input.users];
        if (users.length < 2) return;
        const pairs: [string, string][] = [];
        for (const [i, j, side] of picks) {
          const a = i % users.length;
          const b = j % users.length;
          if (a === b) continue;
          const [x, y] = side ? [a, b] : [b, a];
          users[x] = { ...users[x]!, recentH: { ...users[x]!.recentH, [users[y]!.uidH]: NEVER_WEEK_ID } };
          pairs.push([users[a]!.uid, users[b]!.uid]);
        }
        const result = matchComponent({ ...input, users });
        for (const pod of result.pods) {
          for (const [a, b] of pairs) expect(pod.members.includes(a) && pod.members.includes(b), `${a} with ${b}`).toBe(false);
        }
      }),
      { numRuns: 150 },
    );
  });
});
