import { consentProofFor, getLaunchArea, uidHash } from '@grouper/core';
import { expect, it } from 'vitest';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { updateProfile } from '../../src/callables/updateProfile';
import { CONSENT_EVENT_RETENTION_MS, ERASURE_LEDGER_TTL_MS, PATHS } from '../../src/lib/firestore';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';
import { forbidInLogs } from '../helpers/logCapture';

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const AARHUS = getLaunchArea('aarhus')!;
const COPENHAGEN = getLaunchArea('copenhagen')!;
const consent = (id: Parameters<typeof consentProofFor>[0]) => ({ ...consentProofFor(id), appVersion: '1.2.3', checked: true as const });

describeEmulator('updateProfile (emulator)', () => {
  const deps = emulatorDeps(NOW);

  async function onboarded(): Promise<string> {
    const uid = newUid();
    const email = `${uid.toLowerCase()}@example.com`;
    await deps.auth.createUser({ uid, email });
    const data = { firstName: 'Bo', dob: '1992-02-02', locale: 'en', area: { gh5: AARHUS.cells[0] }, legal: { terms: 't1', privacy: 'p1' } };
    await invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined, email } });
    return uid;
  }
  const update = (uid: string, data: unknown) => invoke('updateProfile', updateProfile, deps, data, { uid });
  const genderEvents = async (uid: string) =>
    (await deps.db.collection('consentEvents').where('uid', '==', uid).where('scope', '==', 'gender').get()).docs.map((d) => d.data());

  it('stores gender only with same-gender pods and its consent, and records the grant', async () => {
    const uid = await onboarded();
    forbidInLogs(uid, 'woman');
    await expect(update(uid, { prefs: { sameGenderOnly: true }, gender: 'woman', genderConsent: consent('gender-en-v1') })).resolves.toEqual({ ok: true });

    const user = (await deps.db.doc(PATHS.user(uid)).get()).data()!;
    expect(user).toMatchObject({ gender: 'woman', prefs: { sameGenderOnly: true } });
    expect(user.legal.genderConsentAt.toMillis()).toBe(NOW);
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).data()).toMatchObject({ gender: 'woman', sameGenderOnly: true });

    const events = await genderEvents(uid);
    expect(events).toEqual([
      expect.objectContaining({ action: 'grant', textVersion: 'gender-en-v1', textSha256: consentProofFor('gender-en-v1').textSha256, locale: 'en', appVersion: '1.2.3', method: 'checkbox+button' }),
    ]);
    expect(events[0]!.expiresAt).toBeUndefined();
    expect(JSON.stringify(events)).not.toContain('woman');
  });

  it('deletes gender everywhere when same-gender pods are turned off, with a withdraw event and a ledger entry', async () => {
    const uid = await onboarded();
    await update(uid, { prefs: { sameGenderOnly: true }, gender: 'man', genderConsent: consent('gender-da-v1') });
    const later = NOW + 3_600_000;
    deps.clock.now = later;
    try {
      await expect(update(uid, { prefs: { sameGenderOnly: false } })).resolves.toEqual({ ok: true });
    } finally {
      deps.clock.now = NOW;
    }

    const user = (await deps.db.doc(PATHS.user(uid)).get()).data()!;
    expect(user.gender).toBeNull();
    expect(user.prefs.sameGenderOnly).toBe(false);
    expect(user.legal).toEqual({ terms: 't1', privacy: 'p1' });
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).data()).toMatchObject({ gender: null, sameGenderOnly: false });

    const events = (await genderEvents(uid)).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
    expect(events.map((e) => e.action)).toEqual(['grant', 'withdraw']);
    expect(events[1]).toMatchObject({ textVersion: 'gender-da-v1', locale: 'da' });
    for (const e of events) expect(e.expiresAt.toMillis()).toBe(later + CONSENT_EVENT_RETENTION_MS);

    const ledger = (await deps.db.collection('erasureLedger').where('uidH', '==', await uidHash(testUidHmac, uid)).get()).docs.map((d) => d.data());
    expect(ledger).toEqual([expect.objectContaining({ kind: 'gender' })]);
    expect(ledger[0]!.at.toMillis()).toBe(later);
    expect(ledger[0]!.expiresAt.toMillis()).toBe(later + ERASURE_LEDGER_TTL_MS);
    expect(JSON.stringify(ledger)).not.toContain(uid);
  });

  it('rejects gender without valid consent, without same-gender pods, and non-binary without the addendum', async () => {
    const uid = await onboarded();
    expect(await errorCode(update(uid, { prefs: { sameGenderOnly: true } }))).toBe('GENDER_CONSENT');
    expect(await errorCode(update(uid, { prefs: { sameGenderOnly: true }, gender: 'woman', genderConsent: { ...consent('gender-en-v1'), textSha256: '0'.repeat(64) } }))).toBe('GENDER_CONSENT');
    expect(await errorCode(update(uid, { prefs: { sameGenderOnly: true }, gender: 'woman', genderConsent: consent('art9-blanket-en-v1') }))).toBe('GENDER_CONSENT');
    expect(await errorCode(update(uid, { prefs: { sameGenderOnly: true }, gender: 'nonbinary', genderConsent: consent('gender-en-v1') }))).toBe('GENDER_CONSENT');
    expect(await errorCode(update(uid, { gender: 'woman', genderConsent: consent('gender-en-v1') }))).toBe('VALIDATION');
    expect(await errorCode(update(uid, { gender: 'woman' }))).toBe('VALIDATION');
    expect(await genderEvents(uid)).toEqual([]);
    expect((await deps.db.doc(PATHS.user(uid)).get()).data()!.gender).toBeNull();

    await expect(update(uid, { prefs: { sameGenderOnly: true }, gender: 'nonbinary', genderConsent: consent('gender-nonbinary-en-v1') })).resolves.toEqual({ ok: true });
  });

  it('re-resolves the launch area and its label on an area or locale change, in both documents', async () => {
    const uid = await onboarded();
    forbidInLogs('Bodil');
    await update(uid, { firstName: 'Bodil', area: { gh5: COPENHAGEN.cells[0] }, locale: 'da', prefs: { maxKm: 5, languages: ['da', 'en'] } });
    const user = (await deps.db.doc(PATHS.user(uid)).get()).data()!;
    expect(user).toMatchObject({ firstName: 'Bodil', locale: 'da', area: { gh5: COPENHAGEN.cells[0], areaId: 'copenhagen', label: COPENHAGEN.label.da } });
    expect((await deps.db.doc(PATHS.matchProfile(uid)).get()).data()).toMatchObject({ areaId: 'copenhagen', gh5: COPENHAGEN.cells[0], maxKm: 5, languages: ['da', 'en'] });
    expect(await errorCode(update(uid, { prefs: { ageMin: 40 } }))).toBe('VALIDATION');
  });

  it('stores "about me" on the user doc only, normalised, and clears it with an empty string', async () => {
    const uid = await onboarded();
    const text = 'Ny i Aarhus,   glad for\nbrætspil og lange gåture.';
    forbidInLogs(text, 'brætspil');
    await expect(update(uid, { aboutMe: text })).resolves.toEqual({ ok: true });
    expect((await deps.db.doc(PATHS.user(uid)).get()).data()!.aboutMe).toBe('Ny i Aarhus, glad for brætspil og lange gåture.');
    expect(JSON.stringify((await deps.db.doc(PATHS.matchProfile(uid)).get()).data())).not.toContain('brætspil');

    await update(uid, { locale: 'da' });
    expect((await deps.db.doc(PATHS.user(uid)).get()).data()!.aboutMe).toBe('Ny i Aarhus, glad for brætspil og lange gåture.');
    await expect(update(uid, { aboutMe: '' })).resolves.toEqual({ ok: true });
    expect((await deps.db.doc(PATHS.user(uid)).get()).data()!).not.toHaveProperty('aboutMe');
  });

  it('refuses contact details, blocklisted text and over-long "about me" without storing anything', async () => {
    const uid = await onboarded();
    const phone = 'Skriv på 20 30 40 50';
    forbidInLogs(phone, '20 30 40 50');
    expect(await errorCode(update(uid, { aboutMe: phone }))).toBe('CONTACT_INFO');
    expect(await errorCode(update(uid, { aboutMe: 'Find mig på @bo_aarhus' }))).toBe('CONTACT_INFO');
    expect(await errorCode(update(uid, { aboutMe: 'Sugar daddy søges' }))).toBe('BLOCKLIST');
    expect(await errorCode(update(uid, { aboutMe: 'x'.repeat(141) }))).toBe('VALIDATION');
    expect((await deps.db.doc(PATHS.user(uid)).get()).data()!).not.toHaveProperty('aboutMe');
  });

  it('answers NOT_FOUND for a caller without a profile', async () => {
    expect(await errorCode(update(newUid(), { locale: 'da' }))).toBe('NOT_FOUND');
  });
});
