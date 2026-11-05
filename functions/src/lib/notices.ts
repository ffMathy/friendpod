/**
 * `users/{uid}/notices` (DESIGN.md §8.1): a reason code and non-textual params only (ids, dates as epoch ms, counts),
 * never tag, option, message or report text. Statements of reasons (DSA Arts. 16–17) are `statementOfReasons`.
 */
import type { NoticeCode } from '@grouper/core';
import type { Firestore, Transaction, WriteBatch } from 'firebase-admin/firestore';
import { DAY_MS, ts, userNotices } from './firestore';

/** Notices live 12 months (TTL, §8.1). */
export const NOTICE_TTL_MS = 365 * DAY_MS;

export type NoticeType = 'statementOfReasons' | 'system';
export type NoticeParams = Readonly<Record<string, string | number | boolean>>;

/** Creates one notice inside `writer`; returns its id (a sanction records it as `noticeId`). */
export function writeNotice(db: Firestore, writer: Transaction | WriteBatch, uid: string, type: NoticeType, code: NoticeCode, params: NoticeParams, now: number): string {
  const ref = userNotices(db, uid).doc();
  (writer as WriteBatch).create(ref, { type, code, params: { ...params }, createdAt: ts(now), expiresAt: ts(now + NOTICE_TTL_MS) });
  return ref.id;
}
