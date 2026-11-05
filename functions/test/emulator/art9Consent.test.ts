import { consentProofFor, getLaunchArea, uidHash } from '@grouper/core';
import { expect, it } from 'vitest';
import { setArt9Consent, withdrawArt9Consent } from '../../src/callables/art9Consent';
import { completeOnboarding } from '../../src/callables/completeOnboarding';
import { CONSENT_EVENT_RETENTION_MS, ERASURE_LEDGER_TTL_MS, PATHS } from '../../src/lib/firestore';
import { describeEmulator, emulatorDeps, errorCode, invoke, newUid } from '../helpers/emulator';
import { testUidHmac } from '../helpers/keys';

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);
const proof = (id: Parameters<typeof consentProofFor>[0]) => ({ ...consentProofFor(id), appVersion: '1.2.3', checked: true as const });

describeEmulator('blanket Art. 9 consent (emulator)', () => {
  const deps = emulatorDeps(NOW);

  async function onboarded(): Promise<string> {
    const uid = newUid();
    await deps.auth.createUser({ uid });
    const data = { firstName: 'Bo', dob: '1992-02-02', locale: 'da', area: { gh5: getLaunchArea('aarhus')!.cells[0] }, legal: { terms: 't1', privacy: 'p1' } };
    await invoke('completeOnboarding', completeOnboarding, deps, data, { uid, claims: { onb: undefined } });
    return uid;
  }
  const grant = (uid: string, data: unknown) => invoke('setArt9Consent', setArt9Consent, deps, data, { uid });
  const withdraw = (uid: string) => invoke('withdrawArt9Consent', (d, c) => withdrawArt9Consent(d, c), deps, {}, { uid });
  const events = async (uid: string) =>
    (await deps.db.collection('consentEvents').where('uid', '==', uid).get()).docs.map((d) => d.data()).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
  const user = async (uid: string) => (await deps.db.doc(PATHS.user(uid)).get()).data()!;

  it('records the grant once, with the text version and hash, and sets users.legal.art9', async () => {
    const uid = await onboarded();
    await expect(grant(uid, { consent: proof('art9-blanket-en-v1') })).resolves.toEqual({ ok: true });
    const legal = (await user(uid)).legal;
    expect(legal.art9).toMatchObject({ textVersion: 'art9-blanket-en-v1', textSha256: consentProofFor('art9-blanket-en-v1').textSha256 });
    expect(legal.art9.at.toMillis()).toBe(NOW);
    expect(await events(uid)).toEqual([
      expect.objectContaining({ scope: 'art9', action: 'grant', textVersion: 'art9-blanket-en-v1', locale: 'en', appVersion: '1.2.3', method: 'checkbox+button' }),
    ]);
    expect(Object.keys((await events(uid))[0]!).sort()).toEqual(['action', 'appVersion', 'createdAt', 'locale', 'method', 'scope', 'textSha256', 'textVersion', 'uid']);

    // The same text again is a no-op; the Danish text is a new grant.
    await grant(uid, { consent: proof('art9-blanket-en-v1') });
    expect(await events(uid)).toHaveLength(1);
    deps.clock.now = NOW + 1000;
    try {
      await grant(uid, { consent: proof('art9-blanket-da-v1') });
    } finally {
      deps.clock.now = NOW;
    }
    expect((await user(uid)).legal.art9.textVersion).toBe('art9-blanket-da-v1');
    expect(await events(uid)).toHaveLength(2);
  });

  it('refuses a proof that names no blanket Art. 9 text', async () => {
    const uid = await onboarded();
    expect(await errorCode(grant(uid, { consent: { ...proof('art9-blanket-en-v1'), textSha256: '0'.repeat(64) } }))).toBe('ART9_CONSENT');
    expect(await errorCode(grant(uid, { consent: proof('gender-en-v1') }))).toBe('ART9_CONSENT');
    expect(await errorCode(grant(uid, { consent: proof('interest-notice-en-v2') }))).toBe('ART9_CONSENT');
    expect(await errorCode(grant(uid, { consent: { ...proof('art9-blanket-en-v1'), checked: false } }))).toBe('VALIDATION');
    expect(await events(uid)).toEqual([]);
    expect((await user(uid)).legal.art9).toBeUndefined();
  });

  it('withdraws a consent without holdings: withdraw event, 3-year expiry, ledger entry, legal.art9 removed', async () => {
    const uid = await onboarded();
    await grant(uid, { consent: proof('art9-blanket-da-v1') });
    const later = NOW + 3_600_000;
    deps.clock.now = later;
    try {
      await expect(withdraw(uid)).resolves.toEqual({ removed: 0 });
      await expect(withdraw(uid)).resolves.toEqual({ removed: 0 });
    } finally {
      deps.clock.now = NOW;
    }
    expect((await user(uid)).legal).toEqual({ terms: 't1', privacy: 'p1' });
    const all = await events(uid);
    expect(all.map((e) => e.action)).toEqual(['grant', 'withdraw']);
    expect(all[1]).toMatchObject({ textVersion: 'art9-blanket-da-v1', locale: 'da' });
    for (const e of all) expect(e.expiresAt.toMillis()).toBe(later + CONSENT_EVENT_RETENTION_MS);
    const ledger = (await deps.db.collection('erasureLedger').where('uidH', '==', await uidHash(testUidHmac, uid)).get()).docs.map((d) => d.data());
    expect(ledger).toEqual([expect.objectContaining({ kind: 'consentWithdrawal', ref: 'art9' })]);
    expect(ledger[0]!.expiresAt.toMillis()).toBe(later + ERASURE_LEDGER_TTL_MS);
  });
});
