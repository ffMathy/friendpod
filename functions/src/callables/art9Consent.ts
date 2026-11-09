/**
 * The blanket Art. 9 consent (D3; PRIVACY.md §3.3–§3.5). Given once, on its own onboarding screen or later in
 * Settings → Privacy, for every interest of the user's that may be sensitive or that they mark private. Refusing it
 * keeps the app usable (addInterests then refuses such tags with ART9_CONSENT_REQUIRED), so it stays freely given.
 *
 * Every grant and withdrawal is a `consentEvents` entry without any interest reference; sensitive holdings point at
 * the grant event (`consentEventId`), which addInterests finds through `users.legal.art9.at`.
 */
import { getLegalText, isValidArt9ConsentProof, type CallableInput, type CallableOutput } from '@friendpod/core';
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
    tx.update(userRef, { 'legal.art9': { textVersion: text.id, textSha256: consent.textSha256, at } });
  });
  return { ok: true };
}

/**
 * PRIVACY.md §3.5 for the blanket consent, in this order:
 *   (0) one transaction ends the consent before anything else: a `withdraw` event, `users.legal.art9` removed, the
 *       erasure-ledger entry (`consentWithdrawal`), and the sensitive themes stripped from `matchProfiles.themes`/
 *       `themeIds` (step 6). From its commit on no new sensitive invitation can reach the user: release revalidation
 *       needs `consentRef` and `users.legal.art9` and its batch fails on the matchProfiles write (precondition), and
 *       backfillPod reads both inside its claim transaction;
 *   (4) every sensitive-themed pod the user was ever in, found through `podState.memberList` (sensitive themes exist
 *       only for holders of a sensitive holding, S3), archived ones included, open invitations too (exitPod:
 *       memberUids and roster first, then options, votes, messages, feedback and grants, podState membership last),
 *       with the pod cards;
 *   (1), (2), (7) one transaction for every sensitive holding and its tag counts, the matchProfiles rebuild, and a
 *       3-year expiry and `redactedAt` on every art9 event;
 *   then (4) once more, idempotently, so a pod reached in the meantime is left too.
 * Idempotent: a retry finds the pods and holdings again; without consent, holdings or sensitive themes it only checks
 * the pods.
 */
export async function withdrawArt9Consent(deps: AppDeps, call: CallContext): Promise<CallableOutput<'withdrawArt9Consent'>> {
  return { removed: await withdrawBlanketConsent(deps, call.uid, call.now, { ledger: { uidH: await call.uidH() } }) };
}

export interface WithdrawOptions {
  /** Writes the erasure-ledger entry; `id` reuses a replayed entry's id (restore runbook, §13). */
  readonly ledger: { readonly uidH: string; readonly id?: string } | null;
}

/** Step (0): ends the consent and strips sensitive themes; false when there was nothing left to end. */
export async function markArt9Withdrawal(deps: AppDeps, uid: string, now: number, o: WithdrawOptions): Promise<boolean> {
  const refs = docs(deps.db);
  return deps.db.runTransaction(async (tx) => {
    const [u, p, held] = await Promise.all([tx.get(refs.user(uid)), tx.get(refs.matchProfile(uid)), tx.get(deps.db.collection(`users/${uid}/sensitiveInterests`).limit(1))]);
    const user = u.data();
    if (!user) throw new AppError('NOT_FOUND');
    const profile = p.data();
    const grant = user.legal.art9;
    const sensThemes = profile?.themes.some((t) => t.sens) ?? false;
    if (!grant && held.empty && !sensThemes) return false;
    if (grant) {
      const text = getLegalText(grant.textVersion);
      tx.create(consentEvents(deps.db).doc(), {
        uid,
        scope: 'art9',
        action: 'withdraw',
        textVersion: grant.textVersion,
        textSha256: grant.textSha256,
        locale: text?.locale ?? (user.locale === 'da' ? 'da' : 'en'),
        appVersion: UNKNOWN_APP_VERSION,
        method: 'checkbox+button',
        createdAt: ts(now),
        expiresAt: ts(now + CONSENT_EVENT_RETENTION_MS),
        redactedAt: ts(now),
      });
      tx.update(refs.user(uid), { 'legal.art9': FieldValue.delete() });
    }
    if (profile) {
      // Always written: it also fails a concurrent release batch's matchProfiles precondition (§10.3).
      const themes = profile.themes.filter((t) => !t.sens);
      tx.update(p.ref.withConverter(null), { themes, themeIds: themes.map((t) => t.c), updatedAt: ts(now) });
    }
    if (o.ledger) {
      const ref = o.ledger.id ? erasureLedger(deps.db).doc(o.ledger.id) : erasureLedger(deps.db).doc();
      tx.set(ref, { uidH: o.ledger.uidH, kind: 'consentWithdrawal', ref: 'art9', at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    }
    return true;
  });
}

async function exitSensitivePods(deps: AppDeps, uid: string): Promise<void> {
  for (const { podId, ps } of await podsOf(deps, uid)) {
    if (ps.theme.kind === 'concept' && ps.theme.sensitive) await exitPod(deps, podId, uid, 'withdrawal');
  }
}

export async function withdrawBlanketConsent(deps: AppDeps, uid: string, now: number, o: WithdrawOptions): Promise<number> {
  const marked = await markArt9Withdrawal(deps, uid, now, o);
  await exitSensitivePods(deps, uid);
  if (!marked) return 0;

  const removed = await removeHoldings(deps, uid, (h) => ({ ordinary: [], sensitive: [...h.sensitive.keys()] }), now, {
    read: (tx) => tx.get(consentEvents(deps.db).where('uid', '==', uid).where('scope', '==', 'art9')),
    finish: ({ tx }, events) => {
      const expiresAt = ts(now + CONSENT_EVENT_RETENTION_MS);
      for (const e of events.docs) {
        const d = e.data();
        if (d.expiresAt === undefined || d.redactedAt === undefined) tx.update(e.ref, { ...(d.expiresAt === undefined ? { expiresAt } : {}), ...(d.redactedAt === undefined ? { redactedAt: ts(now) } : {}) });
      }
    },
  });
  // Idempotent: catches a sensitive pod that an invitation computed before step (0) still reached.
  await exitSensitivePods(deps, uid);
  return removed.length;
}
