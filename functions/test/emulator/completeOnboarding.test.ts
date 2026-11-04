import { emailHash, encodeGeohash, getLaunchArea, identityHash, participationEffectiveWeek, resolveLaunchArea } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import { ageOn, completeOnboarding } from '../../src/callables/completeOnboarding';
import { PATHS, UNDERAGE_MARKER_TTL_MS } from '../../src/lib/firestore';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { forbidInLogs } from '../helpers/logCapture';

// Wed 4 Nov 2026, 13:00 in Copenhagen.
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const AARHUS = getLaunchArea('aarhus')!;
const AARHUS_CELL = AARHUS.cells[0]!;
const OUTSIDE_CELL = encodeGeohash(55.3959, 10.3883, 5); // Odense: not a launch area yet
const LEGAL = { terms: 'terms-2026-11', privacy: 'privacy-2026-11' };

describe('ageOn', () => {
  it('counts whole years on the Copenhagen calendar date and rejects future dates', () => {
    expect(ageOn('2008-11-04', NOW)).toBe(18);
    expect(ageOn('2008-11-05', NOW)).toBe(17);
    // 23:30 UTC on 3 Nov is already 4 Nov in Copenhagen.
    expect(ageOn('2008-11-04', Date.UTC(2026, 10, 3, 23, 30))).toBe(18);
    expect(ageOn('2026-11-05', NOW)).toBeNull();
    expect(ageOn('2026-11-04', NOW)).toBe(0);
  });
});

describeEmulator('completeOnboarding (emulator)', () => {
  const deps = emulatorDeps(NOW);

  async function authUser(email: string): Promise<string> {
    const uid = newUid();
    await deps.auth.createUser({ uid, email, displayName: 'Ada Google-Name', photoURL: 'https://lh3.googleusercontent.com/a/photo' });
    return uid;
  }

  const input = (o: Record<string, unknown> = {}) => ({ firstName: 'Ada', dob: '1990-05-17', locale: 'da', area: { gh5: AARHUS_CELL }, legal: LEGAL, ...o });
  const onboard = (uid: string, data: unknown, email: string) => invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined, email } });

  it('creates users and matchProfiles with the area profile defaults, keeps only birthYear, and sets onb', async () => {
    const email = `ada.${newUid()}@example.com`;
    const uid = await authUser(email);
    forbidInLogs(uid, email, 'Ada', '1990-05-17', 'Google-Name');

    await expect(onboard(uid, input({ prefs: { maxKm: 15 } }), email)).resolves.toEqual({ areaStatus: AARHUS.status });

    const user = (await deps.db.doc(PATHS.user(uid)).get()).data()!;
    expect(user).toMatchObject({
      firstName: 'Ada',
      locale: 'da',
      birthYear: 1990,
      area: { gh5: AARHUS_CELL, label: AARHUS.label.da, areaId: 'aarhus' },
      // Aarhus uses the alpha profile: own age ±10, "open to anyone" on by default (§6.10).
      prefs: { ageMin: 26, ageMax: 46, maxKm: 15, languages: ['da'], availability: 63, sameGenderOnly: false, openToAnyone: true },
      gender: null,
      participation: { mode: 'auto' },
      status: 'active',
      legal: LEGAL,
      interestCount: 0,
    });
    expect(JSON.stringify(user)).not.toMatch(/05-17|1990-05/);

    const profile = (await deps.db.doc(PATHS.matchProfile(uid)).get()).data()!;
    expect(profile).toMatchObject({
      status: 'active',
      areaId: 'aarhus',
      gh5: AARHUS_CELL,
      birthYear: 1990,
      ageMin: 26,
      ageMax: 46,
      maxKm: 15,
      themes: [],
      secondary: [],
      reliability: 0.8,
      openToAnyone: true,
      waitingSinceWeek: participationEffectiveWeek('auto', NOW),
      participation: { mode: 'auto', skipWeekId: null, optInWeekId: null, pausedUntil: null },
    });

    const record = await deps.auth.getUser(uid);
    expect(record.displayName).toBeUndefined();
    expect(record.photoURL).toBeUndefined();
    expect(record.customClaims).toEqual({ onb: true });
  });

  it('uses the launch defaults outside every launch area', async () => {
    expect(resolveLaunchArea(OUTSIDE_CELL)).toBeNull();
    const email = `out.${newUid()}@example.com`;
    const uid = await authUser(email);
    await expect(onboard(uid, input({ area: { gh5: OUTSIDE_CELL }, locale: 'en' }), email)).resolves.toEqual({ areaStatus: 'outside' });
    const user = (await deps.db.doc(PATHS.user(uid)).get()).data()!;
    expect(user.area).toEqual({ gh5: OUTSIDE_CELL, label: '', areaId: null });
    expect(user.prefs).toMatchObject({ ageMin: 29, ageMax: 43, languages: ['en'], openToAnyone: false });
  });

  it('deletes an under-18 Auth user, stores only a 30-day email marker, and repeats the answer on retry', async () => {
    const email = `minor.${newUid()}@example.com`;
    const uid = await authUser(email);
    forbidInLogs(uid, email, '2009-01-01');

    expect(await errorCode(onboard(uid, input({ dob: '2009-01-01' }), email))).toBe('UNDERAGE');
    await expect(deps.auth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await deps.db.doc(PATHS.user(uid)).get()).exists).toBe(false);
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).exists).toBe(false);
    const marker = await deps.db.doc(PATHS.underageMarker(await emailHash(testUidHmac, 'underage', email))).get();
    expect(marker.data()).toEqual({ createdAt: expect.anything(), expiresAt: expect.anything() });
    expect(marker.data()!.expiresAt.toMillis()).toBe(NOW + UNDERAGE_MARKER_TTL_MS);

    // Same email, new account, an adult date of birth: same answer without a new check (§3.1).
    const retry = await authUser(email.toUpperCase());
    expect(await errorCode(onboard(retry, input(), email.toUpperCase()))).toBe('UNDERAGE');
    await expect(deps.auth.getUser(retry)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect((await deps.db.doc(PATHS.user(retry)).get()).exists).toBe(false);

    // After 30 days the marker no longer applies, even before TTL removes it.
    deps.clock.now = NOW + UNDERAGE_MARKER_TTL_MS + 1000;
    try {
      const later = await authUser(email);
      await expect(onboard(later, input(), email)).resolves.toMatchObject({ areaStatus: AARHUS.status });
    } finally {
      deps.clock.now = NOW;
    }
  });

  it('keys the marker on the Apple identity when the token has no email, and writes nothing for a deleted user', async () => {
    // Sign in with Apple without the email scope (§11): no email claim, only the provider's stable `sub`.
    const appleSub = `001234.${newUid()}.0042`;
    const appleToken = { onb: undefined, firebase: { sign_in_provider: 'apple.com', identities: { 'apple.com': [appleSub] } } };
    const uid = newUid();
    await deps.auth.createUser({ uid });
    forbidInLogs(uid, appleSub, 'Kid', '2012-03-01');
    const call = (forUid: string, dob: string) => invoke('completeOnboarding', completeOnboarding, deps, input({ firstName: 'Kid', dob }), { uid: forUid, claims: appleToken });

    expect(await errorCode(call(uid, '2012-03-01'))).toBe('UNDERAGE');
    await expect(deps.auth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    const marker = await deps.db.doc(PATHS.underageMarker(await identityHash(testUidHmac, 'underage', 'apple.com', appleSub))).get();
    expect(marker.data()!.expiresAt.toMillis()).toBe(NOW + UNDERAGE_MARKER_TTL_MS);

    // The same, still unexpired ID token with an adult date of birth (back from the error, new date): no profile.
    expect(await errorCode(call(uid, '1990-03-01'))).toBe('UNDERAGE');
    expect((await deps.db.doc(PATHS.user(uid)).get()).exists).toBe(false);
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).exists).toBe(false);

    // Apple returns the same `sub` for a new Firebase user: same answer.
    const again = newUid();
    await deps.auth.createUser({ uid: again });
    expect(await errorCode(call(again, '1990-03-01'))).toBe('UNDERAGE');
    expect((await deps.db.doc(PATHS.user(again)).get()).exists).toBe(false);
  });

  it('writes no profile for a uid whose Auth user no longer exists, even without any marker key', async () => {
    const uid = newUid(); // never created in Auth: as after a deletion, with the old ID token still valid
    expect(await errorCode(invoke('completeOnboarding', completeOnboarding, deps, input(), { uid, claims: { onb: undefined } }))).toBe('UNAUTHENTICATED');
    expect((await deps.db.doc(PATHS.user(uid)).get()).exists).toBe(false);
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).exists).toBe(false);
  });

  it('removes the new profile again when the Auth user is deleted while the call runs', async () => {
    const email = `race.${newUid()}@example.com`;
    const uid = await authUser(email);
    const realAuth = deps.auth;
    // A concurrent under-18 call from the same token deletes the user between the existence check and the claims.
    const auth = new Proxy(realAuth, {
      get(target, key) {
        if (key === 'updateUser') return async (...args: Parameters<typeof realAuth.updateUser>) => (await target.deleteUser(uid), target.updateUser(...args));
        const value: unknown = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const racing = { ...deps, db: deps.db, auth };
    expect(await errorCode(invoke('completeOnboarding', completeOnboarding, racing, input(), { uid, claims: { onb: undefined, email } }))).toBe('UNAUTHENTICATED');
    expect((await deps.db.doc(PATHS.user(uid)).get()).exists).toBe(false);
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).exists).toBe(false);
  });

  it('refuses an already onboarded caller, and finishes the Auth steps if an earlier call stopped halfway', async () => {
    const email = `twice.${newUid()}@example.com`;
    const uid = await authUser(email);
    expect(await errorCode(invoke('completeOnboarding', completeOnboarding, deps, input(), { uid, claims: { onb: true, email } }))).toBe('ALREADY_EXISTS');

    await onboard(uid, input(), email);
    await deps.auth.setCustomUserClaims(uid, null);
    await deps.auth.updateUser(uid, { displayName: 'Ada Google-Name' });
    await expect(onboard(uid, input({ firstName: 'Other' }), email)).resolves.toEqual({ areaStatus: AARHUS.status });
    expect((await deps.auth.getUser(uid)).customClaims).toEqual({ onb: true });
    expect((await deps.auth.getUser(uid)).displayName).toBeUndefined();
    expect((await deps.db.doc(PATHS.user(uid)).get()).data()!.firstName).toBe('Ada');
  });

  it('rejects implausible dates of birth and preferences that only fail once merged with the defaults', async () => {
    const email = `bad.${newUid()}@example.com`;
    const uid = await authUser(email);
    expect(await errorCode(onboard(uid, input({ dob: '2027-01-01' }), email))).toBe('VALIDATION');
    expect(await errorCode(onboard(uid, input({ dob: '1900-01-01' }), email))).toBe('VALIDATION');
    // Default ageMin is 26 here, so ageMax 30 leaves a range narrower than 5 years.
    expect(await errorCode(onboard(uid, input({ prefs: { ageMax: 30 } }), email))).toBe('VALIDATION');
    expect(await errorCode(onboard(uid, input({ prefs: { sameGenderOnly: true } }), email))).toBe('VALIDATION');
    expect((await deps.db.doc(PATHS.user(uid)).get()).exists).toBe(false);
    expect((await deps.auth.getUser(uid)).customClaims ?? {}).toEqual({});
  });
});
