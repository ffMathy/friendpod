/**
 * The blanket Art. 9 consent (D3; PRIVACY.md §3.3–§3.5). Given once, on its own onboarding screen or later in
 * Settings → Privacy, for every interest of the user's that may be sensitive or that they mark private. Refusing it
 * keeps the app usable (addInterests then refuses such tags with ART9_CONSENT_REQUIRED), so it stays freely given.
 *
 * Every grant and withdrawal is a `consentEvents` entry without any interest reference; sensitive holdings point at
 * the grant event (`consentEventId`), which addInterests finds through `users.legal.art9.at`.
 */
import { getLegalText, isValidArt9ConsentProof, type CallableInput, type CallableOutput } from '@grouper/core';
import { AppError, notImplemented } from '../lib/errors';
import { CONSENT_EVENT_RETENTION_MS, ERASURE_LEDGER_TTL_MS, consentEvents, docs, erasureLedger, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import type { AppDeps } from '../lib/runtime';

/** A withdrawal carries no consent payload, so its event records this instead of an app version. */
const UNKNOWN_APP_VERSION = 'unknown';

/**
 * Whether withdrawArt9Consent can remove sensitive holdings yet (PRIVACY.md §3.5 steps 1–8). Until it can, it
 * withdraws only when the user holds none, which is always the case while ART9_HOLDINGS_ENABLED is off.
 */
export const WITHDRAWAL_REMOVES_HOLDINGS = false;

export async function setArt9Consent(deps: AppDeps, call: CallContext, input: CallableInput<'setArt9Consent'>): Promise<CallableOutput<'setArt9Consent'>> {
  const { consent } = input;
  const text = getLegalText(consent.textVersion);
  if (!isValidArt9ConsentProof(consent) || !text) throw new AppError('ART9_CONSENT');
  const userRef = docs(deps.db).user(call.uid);
  const at = ts(call.now);

  await deps.db.runTransaction(async (tx) => {
    const user = (await tx.get(userRef)).data();
    if (!user) throw new AppError('NOT_FOUND');
    if (user.status === 'deleting') throw new AppError('STATE');
    // The same text again changes nothing: the existing grant event stays the one every holding points at.
    if (user.legal.art9?.textVersion === consent.textVersion) return;
    tx.create(consentEvents(deps.db).doc(), {
      uid: call.uid,
      scope: 'art9',
      action: 'grant',
      textVersion: text.id,
      textSha256: consent.textSha256,
      locale: text.locale,
      appVersion: consent.appVersion,
      method: 'checkbox+button',
      createdAt: at,
    });
    tx.update(userRef, { 'legal.art9': { textVersion: text.id, textSha256: consent.textSha256, at }, lastActiveAt: at });
  });
  return { ok: true };
}

/**
 * PRIVACY.md §3.5 for the blanket consent: every sensitive holding goes, then a `withdraw` event, a 3-year expiry on
 * every art9 event of the user, an erasure-ledger entry (so a backup restore cannot bring the consent back) and
 * `users.legal.art9` removed. Idempotent: without a consent there is nothing to withdraw.
 *
 * TODO(M1): the holding steps (delete each holding, decrement tag counts, pod cards, pods through podState.memberList
 * in the §3.5 step 4 order, open invitations, matchProfiles themes) in removeInterest's code path. Until then a user
 * who holds any sensitive interest gets NOT_IMPLEMENTED and nothing changes.
 */
export async function withdrawArt9Consent(deps: AppDeps, call: CallContext): Promise<CallableOutput<'withdrawArt9Consent'>> {
  const refs = docs(deps.db);
  const userRef = refs.user(call.uid);
  const now = call.now;
  const uidH = await call.uidH();

  await deps.db.runTransaction(async (tx) => {
    const [userSnap, holdings, events] = await Promise.all([
      tx.get(userRef),
      tx.get(deps.db.collection(`users/${call.uid}/sensitiveInterests`).limit(1)),
      tx.get(consentEvents(deps.db).where('uid', '==', call.uid).where('scope', '==', 'art9')),
    ]);
    const user = userSnap.data();
    if (!user) throw new AppError('NOT_FOUND');
    const grant = user.legal.art9;
    if (!grant) return;
    if (!holdings.empty && !WITHDRAWAL_REMOVES_HOLDINGS) throw notImplemented('§3.5');

    const expiresAt = ts(now + CONSENT_EVENT_RETENTION_MS);
    for (const e of events.docs) if (e.data().expiresAt === undefined) tx.update(e.ref, { expiresAt });
    const text = getLegalText(grant.textVersion);
    tx.create(consentEvents(deps.db).doc(), {
      uid: call.uid,
      scope: 'art9',
      action: 'withdraw',
      textVersion: grant.textVersion,
      textSha256: grant.textSha256,
      locale: text?.locale ?? user.locale,
      appVersion: UNKNOWN_APP_VERSION,
      method: 'checkbox+button',
      createdAt: ts(now),
      expiresAt,
    });
    tx.create(erasureLedger(deps.db).doc(), { uidH, kind: 'consentWithdrawal', ref: 'art9', at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    const { art9: _withdrawn, ...legal } = user.legal;
    tx.update(userRef, { legal, lastActiveAt: ts(now) });
  });
  return { removed: 0 };
}
