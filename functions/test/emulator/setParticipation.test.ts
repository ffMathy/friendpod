import { addWeeks, dropSchedule, getLaunchArea, weekIdAt } from '@grouper/core';
import { Timestamp } from 'firebase-admin/firestore';
import { expect, it } from 'vitest';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { setParticipation } from '../../src/callables/setParticipation';
import { PATHS } from '../../src/lib/firestore';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid } from '../helpers/emulator';

const WED = Date.UTC(2026, 10, 4, 12, 0, 0);
const WEEK = weekIdAt(WED);
const NEXT = addWeeks(WEEK, 1);
const THU_AFTER_CUTOFF = dropSchedule(WEEK).optInCutoffAt + 3_600_000;
const DAY = 86_400_000;

describeEmulator('setParticipation (emulator)', () => {
  const deps = emulatorDeps(WED);

  async function onboarded(): Promise<string> {
    const uid = newUid();
    await deps.auth.createUser({ uid });
    const data = { firstName: 'Cai', dob: '1988-08-08', locale: 'da', area: { gh5: getLaunchArea('aarhus')!.cells[0] }, legal: { terms: 't1', privacy: 'p1' } };
    await invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined } });
    return uid;
  }
  const set = (uid: string, data: unknown, at = WED) => {
    deps.clock.now = at;
    return invoke('setParticipation', setParticipation, deps, data, { uid }).finally(() => {
      deps.clock.now = WED;
    });
  };
  const docsOf = async (uid: string) => ({
    user: (await deps.db.doc(PATHS.user(uid)).get()).data()!,
    profile: (await deps.db.doc(PATHS.matchProfile(uid)).get()).data()!,
  });

  it('pauses at once in both documents, with an end date', async () => {
    const uid = await onboarded();
    await expect(set(uid, { mode: 'pause', until: WED + 14 * DAY })).resolves.toEqual({ effectiveWeekId: WEEK });
    const { user, profile } = await docsOf(uid);
    expect(user.status).toBe('paused');
    expect(user.participation).toEqual({ mode: 'auto', pauseReason: 'user', pausedUntil: Timestamp.fromMillis(WED + 14 * DAY) });
    expect(profile.status).toBe('paused');
    expect(profile.participation).toEqual({ mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: Timestamp.fromMillis(WED + 14 * DAY) });
    expect(profile.updatedAt.toMillis()).toBe(WED);
  });

  it('resumes after the Thu 12:00 cutoff from next week only', async () => {
    const uid = await onboarded();
    await set(uid, { mode: 'pause' });
    await expect(set(uid, { mode: 'auto' }, THU_AFTER_CUTOFF)).resolves.toEqual({ effectiveWeekId: NEXT });
    const { user, profile } = await docsOf(uid);
    expect(user.status).toBe('active');
    expect(user.participation).toEqual({ mode: 'auto', skipWeekId: WEEK });
    expect(profile).toMatchObject({ status: 'active', participation: { mode: 'auto', skipWeekId: WEEK, optInWeekId: null, pausedUntil: null } });
  });

  it('skips the next drop and records manual opt-ins', async () => {
    const uid = await onboarded();
    await expect(set(uid, { mode: 'skipNext' })).resolves.toEqual({ effectiveWeekId: WEEK });
    expect((await docsOf(uid)).profile.participation.skipWeekId).toBe(WEEK);

    await expect(set(uid, { mode: 'manual' }, THU_AFTER_CUTOFF)).resolves.toEqual({ effectiveWeekId: NEXT });
    const { user, profile } = await docsOf(uid);
    expect(user.participation).toEqual({ mode: 'manual', optInWeekId: NEXT });
    expect(profile.participation).toEqual({ mode: 'manual', skipWeekId: null, optInWeekId: NEXT, pausedUntil: null });
  });

  it('does not let the user lift an automated safety pause', async () => {
    const uid = await onboarded();
    await deps.db.doc(PATHS.user(uid)).update({ status: 'paused', 'participation.pauseReason': 'reports' });
    await deps.db.doc(PATHS.matchProfile(uid)).update({ status: 'paused' });
    expect(await errorCode(set(uid, { mode: 'auto' }))).toBe('STATE');
    await expect(set(uid, { mode: 'pause' })).resolves.toEqual({ effectiveWeekId: WEEK });
    expect((await docsOf(uid)).user.participation.pauseReason).toBe('reports');
  });

  it('validates the pause end and the mode', async () => {
    const uid = await onboarded();
    expect(await errorCode(set(uid, { mode: 'pause', until: WED - 1 }))).toBe('VALIDATION');
    expect(await errorCode(set(uid, { mode: 'auto', until: WED + DAY }))).toBe('VALIDATION');
    expect(await errorCode(set(uid, { mode: 'sometimes' }))).toBe('VALIDATION');
    expect(await errorCode(set(newUid(), { mode: 'auto' }))).toBe('NOT_FOUND');
  });
});
