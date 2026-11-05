/**
 * updateProfile (DESIGN.md §10.1; PRIVACY.md §3.6). One transaction updates `users` and `matchProfiles`.
 * Gender is collected only for same-gender pods, with its own consent; turning the option off deletes it
 * everywhere, appends a `withdraw` consent event and an erasure-ledger entry (`gender`).
 * "About me" (D4) lives on `users` only, never on `matchProfiles`: it is not used for matching.
 */
import {
  LEGAL_TEXT_SHA256,
  checkAboutMe,
  genderConsentText,
  getLegalText,
  isValidConsentProof,
  prefsSchema,
  resolveLaunchArea,
  type CallableInput,
  type CallableOutput,
  type Gender,
  type LegalText,
  type Locale,
  type UserDoc,
} from '@grouper/core';
import type { QueryDocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import { areaStage, readAreas, writeAreaDeltas } from '../lib/areas';
import { AppError } from '../lib/errors';
import { claimMilestones, FunnelIncrements } from '../lib/funnel';
import { CONSENT_EVENT_RETENTION_MS, ERASURE_LEDGER_TTL_MS, consentEvents, docs, erasureLedger, podStates, ts, type DocOf } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import type { AppDeps } from '../lib/runtime';

type Input = CallableInput<'updateProfile'>;

/**
 * A grant takes `appVersion` from the consent payload (PRIVACY.md §3.4). A withdrawal through updateProfile carries
 * no consent payload, so its event records this instead.
 */
const UNKNOWN_APP_VERSION = 'unknown';

type GenderText = Extract<LegalText, { kind: 'genderConsent' }>;

/** The gender consent proof must name a known gender text; non-binary users must have seen the addendum (§3.6). */
function genderConsentTextFor(consent: NonNullable<Input['genderConsent']>, gender: Gender): GenderText {
  const text = getLegalText(consent.textVersion);
  if (!isValidConsentProof(consent, 'gender') || text?.kind !== 'genderConsent') throw new AppError('GENDER_CONSENT');
  if (gender === 'nonbinary' && text.content.nonbinaryAddendum === null) throw new AppError('GENDER_CONSENT');
  return text;
}

export async function updateProfile(deps: AppDeps, call: CallContext, input: Input): Promise<CallableOutput<'updateProfile'>> {
  if (input.genderConsent !== undefined && input.gender === undefined) throw new AppError('VALIDATION');
  // Contact details are refused outright: the sentence is shown to pod members before anyone has met.
  if (input.aboutMe) {
    const check = checkAboutMe(input.aboutMe);
    if (!check.ok) throw new AppError(check.code);
  }
  const refs = docs(deps.db);
  const userRef = refs.user(call.uid);
  const profileRef = refs.matchProfile(call.uid);
  const at = ts(call.now);

  await deps.db.runTransaction(async (tx) => {
    const [userSnap, profileSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef)]);
    const user = userSnap.data();
    const profile = profileSnap.data();
    if (!user || !profile) throw new AppError('NOT_FOUND');
    if (user.status === 'deleting') throw new AppError('STATE');

    const patch = Object.fromEntries(Object.entries(input.prefs ?? {}).filter(([, v]) => v !== undefined));
    const merged = prefsSchema.safeParse({ ...user.prefs, ...patch });
    if (!merged.success) throw new AppError('VALIDATION');
    const prefs = merged.data;

    let gender = user.gender;
    let grantText: GenderText | null = null;
    if (input.gender !== undefined) {
      if (!prefs.sameGenderOnly) throw new AppError('VALIDATION');
      grantText = genderConsentTextFor(input.genderConsent!, input.gender);
      gender = input.gender;
    }
    if (prefs.sameGenderOnly && gender === null) throw new AppError('GENDER_CONSENT');
    const withdrawGender = !prefs.sameGenderOnly && user.gender !== null;
    if (withdrawGender) gender = null;

    const locale = input.locale ?? user.locale;
    const gh5 = input.area?.gh5 ?? user.area.gh5;
    const area = resolveLaunchArea(gh5);
    const fromAreaId = profile.areaId;
    const toAreaId = area?.id ?? null;
    const areaChanged = fromAreaId !== toAreaId;

    // Reads must precede writes in a transaction.
    const priorGenderEvents = withdrawGender ? await tx.get(consentEvents(deps.db).where('uid', '==', call.uid).where('scope', '==', 'gender')) : null;
    const areas = areaChanged ? await readAreas(tx, deps.db, [fromAreaId, toAreaId]) : null;

    // A move between areas: the exact waitlistCount follows the user, and the new area may reach a funnel stage
    // (waitlisted, or eligible for the next drop in a live area), each once per user (§6.8).
    let milestones = profile.milestones;
    const funnel = new FunnelIncrements();
    if (areas) {
      writeAreaDeltas(tx, deps.db, areas, new Map([[fromAreaId, -1], [toAreaId, 1]]));
      const stage = areaStage(toAreaId === null ? null : (areas.get(toAreaId)?.status ?? area!.status));
      if (stage) {
        const claimed = claimMilestones(milestones, [stage], call.now);
        milestones = claimed.milestones;
        for (const s of claimed.fresh) funnel.stage(toAreaId, call.now, s);
      }
    }
    const { genderConsentAt: _withdrawn, ...legalWithoutGender } = user.legal;
    const { aboutMe: _replaced, ...userWithoutAboutMe } = user;
    // The roster copies in the user's confirmed pods follow after the commit (refreshRosters).
    const aboutMe = input.aboutMe === undefined ? user.aboutMe : input.aboutMe || undefined;
    const nextUser: UserDoc = {
      ...userWithoutAboutMe,
      ...(aboutMe !== undefined ? { aboutMe } : {}),
      firstName: input.firstName ?? user.firstName,
      locale,
      area: { gh5, label: area ? area.label[locale] : '', areaId: area?.id ?? null },
      prefs,
      gender,
      legal: grantText ? { ...user.legal, genderConsentAt: at } : withdrawGender ? legalWithoutGender : user.legal,
    };
    tx.set(userRef, nextUser);
    tx.set(profileRef, {
      ...profile,
      areaId: nextUser.area.areaId,
      gh5,
      ageMin: prefs.ageMin,
      ageMax: prefs.ageMax,
      maxKm: prefs.maxKm,
      sameGenderOnly: prefs.sameGenderOnly,
      gender,
      languages: prefs.languages,
      availability: prefs.availability,
      openToAnyone: prefs.openToAnyone,
      milestones,
      updatedAt: at,
    });
    funnel.write(deps.db, tx);

    if (grantText) {
      tx.create(consentEvents(deps.db).doc(), {
        uid: call.uid,
        scope: 'gender',
        action: 'grant',
        textVersion: grantText.id,
        textSha256: input.genderConsent!.textSha256,
        locale: grantText.locale,
        appVersion: input.genderConsent!.appVersion,
        method: 'checkbox+button',
        createdAt: at,
      });
    }
    if (withdrawGender) await recordGenderWithdrawal(tx, deps, call, user.locale, priorGenderEvents!.docs);
  });
  if (input.firstName !== undefined || input.aboutMe !== undefined) await refreshRosters(deps, call.uid);
  return { ok: true };
}

/**
 * The roster copy of the first name and "about me" (§8.1, D4) in every confirmed pod the user is still on the roster
 * of, archived and dissolved ones included (founder decision: an edit or a cleared "about me" must not linger in old
 * pods until their deletion). Each pod gets its own transaction, reading the user doc again, so a later edit wins.
 */
async function refreshRosters(deps: AppDeps, uid: string): Promise<void> {
  const refs = docs(deps.db);
  const states = await podStates(deps.db).where('memberList', 'array-contains', uid).get();
  for (const s of states.docs) {
    await deps.db.runTransaction(async (tx) => {
      const [podSnap, userSnap] = await Promise.all([tx.get(refs.pod(s.id)), tx.get(refs.user(uid))]);
      const pod = podSnap.data();
      const user = userSnap.data();
      const entry = pod?.roster[uid];
      if (!pod || !user || !entry) return;
      const { aboutMe: _old, ...rest } = entry;
      tx.set(podSnap.ref, { ...pod, roster: { ...pod.roster, [uid]: { ...rest, firstName: user.firstName, ...(user.aboutMe ? { aboutMe: user.aboutMe } : {}) } } });
    });
  }
}

/**
 * PRIVACY.md §3.6 withdrawal: a `withdraw` event naming the text of the latest grant, a 3-year expiry on every
 * gender event of this user (TTL, §8.2), and an erasure-ledger entry so a backup restore replays the deletion.
 */
async function recordGenderWithdrawal(tx: Transaction, deps: AppDeps, call: CallContext, locale: Locale, prior: readonly QueryDocumentSnapshot<DocOf<'consentEvent'>>[]): Promise<void> {
  const expiresAt = ts(call.now + CONSENT_EVENT_RETENTION_MS);
  const latestGrant = prior
    .map((d) => d.data())
    .filter((e) => e.action === 'grant')
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
  const fallback = genderConsentText(locale, false)!;
  const textVersion = latestGrant?.textVersion ?? fallback.id;
  for (const doc of prior) {
    if (doc.data().expiresAt === undefined) tx.update(doc.ref, { expiresAt });
  }
  tx.create(consentEvents(deps.db).doc(), {
    uid: call.uid,
    scope: 'gender',
    action: 'withdraw',
    textVersion,
    textSha256: latestGrant?.textSha256 ?? LEGAL_TEXT_SHA256[fallback.id as keyof typeof LEGAL_TEXT_SHA256],
    locale: latestGrant?.locale ?? fallback.locale,
    appVersion: UNKNOWN_APP_VERSION,
    method: 'checkbox+button',
    createdAt: ts(call.now),
    expiresAt,
  });
  tx.create(erasureLedger(deps.db).doc(), {
    uidH: await call.uidH(),
    kind: 'gender',
    at: ts(call.now),
    expiresAt: ts(call.now + ERASURE_LEDGER_TTL_MS),
  });
}

/**
 * The data effect of a gender opt-out (PRIVACY.md §3.6), for the restore runbook (§13): gender deleted on `users` and
 * `matchProfiles`, same-gender pods off, the consent timestamp gone. The consent events of the original withdrawal
 * live in the ledger's source database; the replayed ledger entry is written under its own id. False when there was
 * nothing to erase.
 */
export async function eraseGender(deps: Pick<AppDeps, 'db'>, uid: string, now: number, ledger: { readonly uidH: string; readonly id: string }): Promise<boolean> {
  const refs = docs(deps.db);
  return deps.db.runTransaction(async (tx) => {
    const [u, p] = await Promise.all([tx.get(refs.user(uid)), tx.get(refs.matchProfile(uid))]);
    const user = u.data();
    const profile = p.data();
    const has = (user && (user.gender !== null || user.prefs.sameGenderOnly || user.legal.genderConsentAt)) || (profile && (profile.gender !== null || profile.sameGenderOnly));
    if (!has) return false;
    if (user) {
      const { genderConsentAt: _g, ...legal } = user.legal;
      tx.set(refs.user(uid), { ...user, gender: null, prefs: { ...user.prefs, sameGenderOnly: false }, legal });
    }
    if (profile) tx.set(refs.matchProfile(uid), { ...profile, gender: null, sameGenderOnly: false, updatedAt: ts(now) });
    tx.set(erasureLedger(deps.db).doc(ledger.id), { uidH: ledger.uidH, kind: 'gender', at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    return true;
  });
}
