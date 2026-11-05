/**
 * The per-city waitlist counter and the day-1 funnel (DESIGN.md §3.1 step 12, §6.8): `areas/{areaId}.waitlistCount`
 * moves with onboarding, area changes and erasure in the same transaction; `funnel/{areaId}_{weekId}` counts each user
 * once per stage and holds no uid; "where did you hear" is an aggregate only. Other files onboard into Aarhus and
 * Copenhagen in parallel, so this one uses Aalborg, Odense and Vejle, and compares counters before and after.
 */
import { encodeGeohash, funnelDocId, funnelWeekId, getLaunchArea } from '@grouper/core';
import { expect, it } from 'vitest';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { updateProfile } from '../../src/callables/updateProfile';
import { eraseMatchProfileAndAreaCount } from '../../src/lib/areas';
import { PATHS } from '../../src/lib/firestore';
import { FUNNEL_COLLECTION, recordMilestones } from '../../src/lib/funnel';
import { openArea } from '../../src/tasks/openArea';
import { describeEmulator, emulatorDeps, invoke, newUid } from '../helpers/emulator';
import { forbidInLogs } from '../helpers/logCapture';

// Thu 5 Nov 2026, 13:00 in Copenhagen (week 45).
const NOW = Date.UTC(2026, 10, 5, 12, 0, 0);
const WEEK = funnelWeekId(NOW);
const AALBORG = getLaunchArea('aalborg')!;
const ODENSE = getLaunchArea('odense')!;
const VEJLE = getLaunchArea('vejle')!;
const ESBJERG = encodeGeohash(55.4765, 8.4594, 5);

describeEmulator('waitlist counter and funnel (emulator)', () => {
  const deps = emulatorDeps(NOW);

  async function onboard(gh5: string, extra: Record<string, unknown> = {}): Promise<string> {
    const uid = newUid();
    const email = `${uid.toLowerCase()}@example.com`;
    await deps.auth.createUser({ uid, email });
    const data = { firstName: 'Ea', dob: '1993-03-03', locale: 'da', area: { gh5 }, legal: { terms: 't1', privacy: 'p1' }, ...extra };
    await invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined, email } });
    return uid;
  }
  const count = async (areaId: string): Promise<number> => ((await deps.db.doc(PATHS.area(areaId)).get()).get('waitlistCount') as number | undefined) ?? 0;
  const funnel = async (areaId: string | null, weekId = WEEK): Promise<Record<string, unknown>> => (await deps.db.collection(FUNNEL_COLLECTION).doc(funnelDocId(areaId, weekId)).get()).data() ?? {};
  const stage = async (areaId: string | null, s: string, weekId = WEEK): Promise<number> => ((await funnel(areaId, weekId))['counts'] as Record<string, number> | undefined)?.[s] ?? 0;
  const source = async (areaId: string | null, s: string): Promise<number> => ((await funnel(areaId))['sources'] as Record<string, number> | undefined)?.[s] ?? 0;
  const milestones = async (uid: string) => ((await deps.db.doc(PATHS.matchProfile(uid)).get()).get('milestones') ?? {}) as Record<string, { toMillis(): number }>;

  it('creates the area doc on first onboarding and increments waitlistCount exactly, with the funnel stages', async () => {
    const before = { count: await count('vejle'), onboarded: await stage('vejle', 'onboarded'), waitlisted: await stage('vejle', 'waitlisted') };
    const uid = await onboard(VEJLE.cells[0]!);
    const area = (await deps.db.doc(PATHS.area('vejle')).get()).data()!;
    expect(area).toMatchObject({ label: { da: 'Vejle', en: 'Vejle' }, status: 'waitlist', profile: 'alpha', goal: { waitlist: 250 } });
    expect(await count('vejle')).toBe(before.count + 1);
    await onboard(VEJLE.cells[1]!);
    expect(await count('vejle')).toBe(before.count + 2);

    expect(await stage('vejle', 'onboarded')).toBe(before.onboarded + 2);
    expect(await stage('vejle', 'waitlisted')).toBe(before.waitlisted + 2);
    const m = await milestones(uid);
    expect(Object.keys(m).sort()).toEqual(['onboardedAt', 'signupAt', 'waitlistedAt']);
    expect(m.onboardedAt!.toMillis()).toBe(NOW);
    // The sign-up counts in the week the Auth user was created.
    expect(await stage('vejle', 'signup', funnelWeekId(m.signupAt!.toMillis()))).toBeGreaterThanOrEqual(2);

    const doc = await funnel('vejle');
    expect(doc).toMatchObject({ areaId: 'vejle', weekId: WEEK });
    expect(doc['expiresAt']).toBeDefined();
    expect(JSON.stringify(doc)).not.toContain(uid);
  });

  it('counts "where did you hear" as an aggregate only, once per user, never on the user', async () => {
    const before = await source('odense', 'dadsGroup');
    const uid = await onboard(ODENSE.cells[0]!, { heardFrom: 'dadsGroup' });
    forbidInLogs('dadsGroup');
    expect(await source('odense', 'dadsGroup')).toBe(before + 1);
    const user = (await deps.db.doc(PATHS.user(uid)).get()).data()!;
    const profile = (await deps.db.doc(PATHS.matchProfile(uid)).get()).data()!;
    expect(JSON.stringify(user)).not.toContain('dadsGroup');
    expect(JSON.stringify(profile)).not.toContain('dadsGroup');
    // A repeated completeOnboarding answers ALREADY_EXISTS or returns early: nothing is counted again.
    const email = `${uid.toLowerCase()}@example.com`;
    await invoke('completeOnboarding', completeOnboarding, deps, { firstName: 'Ea', dob: '1993-03-03', locale: 'da', area: { gh5: ODENSE.cells[0] }, legal: { terms: 't1', privacy: 'p1' }, heardFrom: 'dadsGroup' }, { uid, claims: { onb: undefined, email } });
    expect(await source('odense', 'dadsGroup')).toBe(before + 1);
    // Skippable: no answer, no source counter.
    const total = async () => Object.values(((await funnel('odense'))['sources'] ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
    const sum = await total();
    await onboard(ODENSE.cells[1]!);
    expect(await total()).toBe(sum);
  });

  it('counts users outside every area in the `none` row, without an area counter', async () => {
    const before = await stage(null, 'onboarded');
    const uid = await onboard(ESBJERG);
    expect(await stage(null, 'onboarded')).toBe(before + 1);
    expect(Object.keys(await milestones(uid)).sort()).toEqual(['onboardedAt', 'signupAt']);
  });

  it('moves the count with an area change, and counts waitlisted once per user', async () => {
    const uid = await onboard(VEJLE.cells[2]!);
    const before = { vejle: await count('vejle'), odense: await count('odense'), waitlisted: await stage('odense', 'waitlisted') };
    await invoke('updateProfile', updateProfile, deps, { area: { gh5: ODENSE.cells[2] } }, { uid });
    expect(await count('vejle')).toBe(before.vejle - 1);
    expect(await count('odense')).toBe(before.odense + 1);
    // Already waitlisted (in Vejle): the move does not count the stage again.
    expect(await stage('odense', 'waitlisted')).toBe(before.waitlisted);

    // An unrelated update leaves the counts alone; moving out of every area decrements.
    await invoke('updateProfile', updateProfile, deps, { firstName: 'Eja' }, { uid });
    expect(await count('odense')).toBe(before.odense + 1);
    await invoke('updateProfile', updateProfile, deps, { area: { gh5: ESBJERG } }, { uid });
    expect(await count('odense')).toBe(before.odense);
  });

  it('decrements at erasure exactly once and deletes the milestones with the profile', async () => {
    const uid = await onboard(VEJLE.cells[3]!);
    const before = await count('vejle');
    const onboarded = await stage('vejle', 'onboarded');
    await expect(eraseMatchProfileAndAreaCount(deps, uid)).resolves.toEqual({ erased: true });
    await expect(eraseMatchProfileAndAreaCount(deps, uid)).resolves.toEqual({ erased: false });
    expect(await count('vejle')).toBe(before - 1);
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).exists).toBe(false);
    // The uid-free counters stay.
    expect(await stage('vejle', 'onboarded')).toBe(onboarded);
  });

  it('counts later stages once per user, and happened meetups as first then second', async () => {
    const uid = await onboard(VEJLE.cells[4]!);
    const before = { p: await stage('vejle', 'firstProposal'), c: await stage('vejle', 'firstConfirmed'), m1: await stage('vejle', 'firstMeetupHappened'), m2: await stage('vejle', 'secondMeetup') };
    expect(await recordMilestones(deps, uid, ['firstProposal'], NOW)).toEqual(['firstProposal']);
    expect(await recordMilestones(deps, uid, ['firstProposal'], NOW + 1000)).toEqual([]);
    expect(await recordMilestones(deps, uid, ['firstConfirmed'], NOW)).toEqual(['firstConfirmed']);
    expect(await recordMilestones(deps, uid, ['meetupHappened'], NOW)).toEqual(['firstMeetupHappened']);
    expect(await recordMilestones(deps, uid, ['meetupHappened'], NOW)).toEqual(['secondMeetup']);
    expect(await recordMilestones(deps, uid, ['meetupHappened'], NOW)).toEqual([]);
    expect(await stage('vejle', 'firstProposal')).toBe(before.p + 1);
    expect(await stage('vejle', 'firstConfirmed')).toBe(before.c + 1);
    expect(await stage('vejle', 'firstMeetupHappened')).toBe(before.m1 + 1);
    expect(await stage('vejle', 'secondMeetup')).toBe(before.m2 + 1);
    // No profile (erased): nothing to count.
    expect(await recordMilestones(deps, newUid(), ['firstProposal'], NOW)).toEqual([]);
  });

  it('opens a live area: marks everyone firstDropEligible once and pushes "<city> is open" once', async () => {
    const a = await onboard(AALBORG.cells[0]!);
    const b = await onboard(AALBORG.cells[1]!);
    await deps.db.doc(PATHS.pushTokens(a)).set({ tokens: [{ token: 'tok-a', platform: 'ios', updatedAt: new Date(NOW) }] });
    const before = await stage('aalborg', 'firstDropEligible');

    // Still on the waitlist: nothing happens.
    await expect(openArea(deps, 'aalborg')).resolves.toMatchObject({ outcome: 'notLive', marked: 0 });

    await deps.db.doc(PATHS.area('aalborg')).update({ status: 'live' });
    deps.pushes.length = 0;
    await expect(openArea(deps, 'aalborg')).resolves.toMatchObject({ outcome: 'opened', marked: 2, pushed: 1 });
    expect(await stage('aalborg', 'firstDropEligible')).toBe(before + 2);
    expect(deps.pushes).toEqual([{ kind: 'areaOpen', recipients: [{ locale: 'da', tokens: ['tok-a'] }], params: { city: { da: 'Aalborg', en: 'Aalborg' } } }]);
    expect(Object.keys(await milestones(b))).toContain('firstDropEligibleAt');

    // A retry counts and notifies nobody again; a newcomer to the live area is eligible at once.
    await expect(openArea(deps, 'aalborg')).resolves.toMatchObject({ outcome: 'opened', marked: 0, pushed: 0 });
    expect(deps.pushes).toHaveLength(1);
    const c = await onboard(AALBORG.cells[2]!);
    expect(Object.keys(await milestones(c))).toContain('firstDropEligibleAt');
    expect(Object.keys(await milestones(c))).not.toContain('waitlistedAt');
    expect(await stage('aalborg', 'firstDropEligible')).toBe(before + 3);
  });
});
