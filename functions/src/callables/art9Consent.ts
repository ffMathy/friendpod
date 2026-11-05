/**
 * The blanket Art. 9 consent (D3; PRIVACY.md §3.3–§3.5). Given once, on its own onboarding screen or later in
 * Settings → Privacy, for every interest of the user's that may be sensitive or that they mark private. Refusing it
 * keeps the app usable (addInterests then refuses such tags with ART9_CONSENT_REQUIRED), so it stays freely given.
 *
 * Every grant and withdrawal is a `consentEvents` entry without any interest reference; sensitive holdings point at
 * the grant event (`consentEventId`), which addInterests finds through `users.legal.art9.at`.
 */
import { getLegalText, isValidArt9ConsentProof, type CallableInput, type CallableOutput } from '@grouper/core';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { CONSENT_EVENT_RETENTION_MS, ERASURE_LEDGER_TTL_MS, consentEvents, docs, erasureLedger, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import type { AppDeps } from '../lib/runtime';
import { removeHoldings } from '../interests/remove';
import { exitPod, podsOf } from '../pods/exit';

/** A withdrawal carries no consent payload, so its event records this instead of an app version. */
const UNKNOWN_APP_VERSION = 'unknown';

/** withdrawArt9Consent removes sensitive holdings with the PRIVACY.md §3.5 effects (the ART9 gate test reads this). */
export const WITHDRAWAL_REMOVES_HOLDINGS = true;

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
 * PRIVACY.md §3.5 for the blanket consent, in its order: (4) every sensitive-themed pod the user was ever in, found
 * through `podState.memberList` (sensitive themes exist only for holders of a sensitive holding, S3), archived ones
 * included, open invitations too (exitPod: memberUids and roster first, then options, votes, messages, feedback and
 * grants, podState membership last), with the pod cards; then one transaction for (1), (2), (6) and (7): every
 * sensitive holding and its tag counts, `matchProfiles.themes`/`themeIds`, a `withdraw` event, a 3-year expiry and
 * `redactedAt` on every art9 event, an erasure-ledger entry (`consentWithdrawal`) and, last, `users.legal.art9`.
 * Idempotent: a retry finds the pods again, and without consent or holdings there is nothing left to do.
 */
export async function withdrawArt9Consent(deps: AppDeps, call: CallContext): Promise<CallableOutput<'withdrawArt9Consent'>> {
  return { removed: await withdrawBlanketConsent(deps, call.uid, call.now, { ledger: { uidH: await call.uidH() } }) };
}

export interface WithdrawOptions {
  /** Writes the erasure-ledger entry; `id` reuses a replayed entry's id (restore runbook, §13). */
  readonly ledger: { readonly uidH: string; readonly id?: string } | null;
}

export async function withdrawBlanketConsent(deps: AppDeps, uid: string, now: number, o: WithdrawOptions): Promise<number> {
  const refs = docs(deps.db);
  const user = (await refs.user(uid).get()).data();
  if (!user) throw new AppError('NOT_FOUND');
  const held = await deps.db.collection(`users/${uid}/sensitiveInterests`).limit(1).get();
  if (!user.legal.art9 && held.empty) return 0;

  for (const { podId, ps } of await podsOf(deps, uid)) {
    if (ps.theme.kind === 'concept' && ps.theme.sensitive) await exitPod(deps, podId, uid, 'withdrawal');
  }

  const removed = await removeHoldings(deps, uid, (h) => ({ ordinary: [], sensitive: [...h.sensitive.keys()] }), now, {
    read: (tx) => tx.get(consentEvents(deps.db).where('uid', '==', uid).where('scope', '==', 'art9')),
    finish: ({ tx, user: raw }, events) => {
      const grant = (raw?.legal as { art9?: { textVersion: string; textSha256: string } } | undefined)?.art9;
      const expiresAt = ts(now + CONSENT_EVENT_RETENTION_MS);
      for (const e of events.docs) {
        const d = e.data();
        if (d.expiresAt === undefined || d.redactedAt === undefined) tx.update(e.ref, { ...(d.expiresAt === undefined ? { expiresAt } : {}), ...(d.redactedAt === undefined ? { redactedAt: ts(now) } : {}) });
      }
      if (grant) {
        const text = getLegalText(grant.textVersion);
        tx.create(consentEvents(deps.db).doc(), {
          uid,
          scope: 'art9',
          action: 'withdraw',
          textVersion: grant.textVersion,
          textSha256: grant.textSha256,
          locale: text?.locale ?? (raw?.locale === 'da' ? 'da' : 'en'),
          appVersion: UNKNOWN_APP_VERSION,
          method: 'checkbox+button',
          createdAt: ts(now),
          expiresAt,
          redactedAt: ts(now),
        });
        // Last, so a retry still runs every step.
        tx.update(refs.user(uid), { 'legal.art9': FieldValue.delete(), lastActiveAt: ts(now) });
      }
      if (o.ledger) {
        const ref = o.ledger.id ? erasureLedger(deps.db).doc(o.ledger.id) : erasureLedger(deps.db).doc();
        tx.set(ref, { uidH: o.ledger.uidH, kind: 'consentWithdrawal', ref: 'art9', at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
      }
    },
  });
  return removed.length;
}
