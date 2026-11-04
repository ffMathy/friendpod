import { isWeekId } from '../time/weekId';
import type { InterestId, PodId, Uid, UidH, WeekId } from '../types/ids';
import { utf8Encode } from '../util/utf8';
import { base32 } from './base32';
import type { HmacSha256 } from './hmac';

export const POD_ID_LENGTH = 20;
export const UID_H_LENGTH = 20;
export const INTEREST_ID_LENGTH = 16;
export const EMAIL_H_LENGTH = 32;

const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function assertUid(uid: string): void {
  if (!UID_PATTERN.test(uid)) throw new Error('invalid uid');
}

/**
 * `podId = base32(HMAC-SHA256(POD_ID_KEY, weekId|sortedUids))[0..20]` (§6.5, A18).
 * Each user is in at most one new pod per drop, so the sorted member set identifies the pod and a
 * retried release finds the same id.
 */
export async function podId(hmac: HmacSha256, weekId: WeekId, uids: readonly Uid[]): Promise<PodId> {
  if (!isWeekId(weekId)) throw new Error('podId: invalid weekId');
  if (uids.length === 0) throw new Error('podId: no members');
  uids.forEach(assertUid);
  const sorted = [...uids].sort();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new Error('podId: duplicate member');
  }
  const mac = await hmac(utf8Encode(`${weekId}|${sorted.join(',')}`));
  return base32(mac).slice(0, POD_ID_LENGTH);
}

/** `uidH = base32(HMAC-SHA256(UID_HMAC_KEY, 'uid|' + uid))[0..20]` (§8). */
export async function uidHash(hmac: HmacSha256, uid: Uid): Promise<UidH> {
  assertUid(uid);
  return base32(await hmac(utf8Encode(`uid|${uid}`))).slice(0, UID_H_LENGTH);
}

/** `interestId = base32(HMAC(UID_HMAC_KEY, 'interest|' + uid + '|' + norm))[0..16]` (§8.1). */
export async function interestId(hmac: HmacSha256, uid: Uid, norm: string): Promise<InterestId> {
  assertUid(uid);
  if (norm.length === 0) throw new Error('interestId: empty norm');
  return base32(await hmac(utf8Encode(`interest|${uid}|${norm}`))).slice(0, INTEREST_ID_LENGTH);
}

/**
 * Email hash for `underageMarkers` and `bans` (§3.1, PRIVACY.md §6). The purpose is part of the
 * message, so a ban record cannot be joined with an under-18 marker.
 */
export async function emailHash(hmac: HmacSha256, purpose: 'underage' | 'ban', email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) throw new Error('emailHash: not an email address');
  return base32(await hmac(utf8Encode(`${purpose}|${normalized}`))).slice(0, EMAIL_H_LENGTH);
}

/**
 * Hash of a sign-in provider's own user id (e.g. Apple's `sub`) for `underageMarkers`, for sign-ins without an
 * email claim (Sign in with Apple does not request the email scope, §11). Unlike the Firebase uid, the provider's
 * id survives deleting and recreating the Firebase user. `${purpose}.idp|` never prefixes an emailHash message.
 */
export async function identityHash(hmac: HmacSha256, purpose: 'underage', provider: string, providerUid: string): Promise<string> {
  if (provider.length === 0 || providerUid.length === 0) throw new Error('identityHash: empty identity');
  return base32(await hmac(utf8Encode(`${purpose}.idp|${provider}|${providerUid}`))).slice(0, EMAIL_H_LENGTH);
}
