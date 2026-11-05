/**
 * Block and report (DESIGN.md §3.7, §10.1; F17, A38). Blocks are immediate and two-way; reports lead only to
 * automated, expiring outcomes (a pause, a sensitive-theme hold), each with a statement of reasons. Nobody reads
 * reports or their text. The reporter is never revealed: notices carry codes, never who reported or what was written.
 */
import {
  NOTICE_CODES,
  REPORT_RETENTION_MS,
  isChatOpen,
  reportOutcome,
  uidHash,
  type CallableInput,
  type CallableOutput,
  type PriorReport,
} from '@grouper/core';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '../lib/errors';
import { COLLECTIONS, DAY_MS, ERASURE_LEDGER_TTL_MS, PATHS, docs, erasureLedger, ts, type DocOf } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import { writeNotice } from '../lib/notices';
import { rateLimitKey, takeWindow } from '../lib/rateLimits';
import type { AppDeps } from '../lib/runtime';
import { applySanction } from '../lib/sanctions';
import { withPod } from '../pods/effects';
import { FORMER_MEMBER_UID, podsOf } from '../pods/exit';
import { advance, afterMemberLoss, enterPlanning, removeFromPod } from '../pods/transitions';

/** Reports per uid per day [A]; `resource-exhausted` beyond it. */
export const REPORTS_PER_DAY = 10;
export const REPORT_BUCKET = 'report';

const LIVE_STATUSES = new Set(['invited', 'accepted']);

/** `erasureLedger.ref` of a block or unblock: the other party's uidH and the pod the block names (§8.2). */
export function blockLedgerRef(otherH: string, podId: string): string {
  return `${otherH}:${podId}`;
}

export interface BlockOptions {
  readonly leave?: boolean;
  readonly replan?: boolean;
  /** Writes the ledger entry; `id` reuses a replayed entry's id (restore runbook, §13). Null: no entry. */
  readonly ledger: { readonly id?: string } | null;
}

/**
 * The block itself (§3.7): `blocks/{a}_{b}`, the owner's list (with the first name they saw in that pod's roster),
 * `blockedH` on both profiles, both photo grants deleted, then every active pod the two share loses the blocked member
 * (or the blocker with `leave`), with the "Re-plan the meetup" round for a scheduled pod when asked.
 */
export async function applyBlock(deps: AppDeps, blocker: string, blocked: string, podId: string, now: number, o: BlockOptions): Promise<void> {
  const refs = docs(deps.db);
  const hmac = deps.uidHmac();
  const [ha, hb] = await Promise.all([uidHash(hmac, blocker), uidHash(hmac, blocked)]);
  await deps.db.runTransaction(async (tx) => {
    const [pa, pb, pod, own] = await Promise.all([tx.get(refs.matchProfile(blocker)), tx.get(refs.matchProfile(blocked)), tx.get(refs.pod(podId)), tx.get(refs.userBlock(blocker, blocked))]);
    const firstName = own.data()?.firstName || pod.data()?.roster[blocked]?.firstName || '';
    tx.set(refs.block(blocker, blocked), { blocker, blocked, podId, createdAt: own.data()?.since ?? ts(now) });
    tx.set(refs.userBlock(blocker, blocked), { firstName, podId, since: own.data()?.since ?? ts(now) });
    if (pa.exists) tx.update(pa.ref.withConverter(null), { blockedH: FieldValue.arrayUnion(hb), updatedAt: ts(now) });
    if (pb.exists) tx.update(pb.ref.withConverter(null), { blockedH: FieldValue.arrayUnion(ha), updatedAt: ts(now) });
    tx.delete(refs.photoGrant(blocker, blocked));
    tx.delete(refs.photoGrant(blocked, blocker));
    if (o.ledger) {
      const ref = o.ledger.id ? erasureLedger(deps.db).doc(o.ledger.id) : erasureLedger(deps.db).doc();
      tx.set(ref, { uidH: ha, kind: 'block', ref: blockLedgerRef(hb, podId), at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    }
  });

  const victim = o.leave ? blocker : blocked;
  for (const { podId: shared, ps } of await podsOf(deps, blocker)) {
    if (!ps.memberList.includes(blocked)) continue;
    await withPod(deps, shared, now, async (ctx) => {
      await advance(ctx);
      const meetupMs = ctx.pod?.planning.meetupAt?.toMillis();
      const meetupAt = meetupMs === undefined ? undefined : new Date(meetupMs);
      const chatOpen = ctx.state === 'happened' && meetupAt !== undefined && isChatOpen(meetupAt, new Date(now));
      if (!['proposed', 'planning', 'scheduled'].includes(ctx.state) && !chatOpen) return;
      const inPod = (u: string) => ctx.pod?.memberUids.includes(u) || LIVE_STATUSES.has(ctx.ps.members[u]?.status ?? '');
      if (!inPod(blocker) || !inPod(blocked)) return;
      const wasCurrent = ctx.pod?.memberUids.includes(victim) ?? false;
      await removeFromPod(ctx, victim, 'removed');
      if (wasCurrent) {
        // Everyone else, the blocked person included, sees only the generic change (§3.7).
        const rest = ctx.currentMembers();
        for (const other of rest) ctx.notice(other, NOTICE_CODES.POD_MEMBER_LEFT);
        ctx.push('podChanged', rest);
      }
      if (o.replan && ctx.state === 'scheduled' && victim === blocked) await enterPlanning(ctx, 'replan');
      else if (wasCurrent || ctx.state === 'proposed') await afterMemberLoss(ctx);
    });
  }
}

/** Ends a block (§3.7): `blockedH` stays while the other direction is blocked or a report between them is open. */
export async function applyUnblock(deps: AppDeps, blocker: string, blocked: string, now: number, o: { readonly ledger: { readonly id?: string } | null }): Promise<boolean> {
  const refs = docs(deps.db);
  const hmac = deps.uidHmac();
  const [ha, hb] = await Promise.all([uidHash(hmac, blocker), uidHash(hmac, blocked)]);
  const reports = deps.db.collection(COLLECTIONS.reports);
  return deps.db.runTransaction(async (tx) => {
    const [block, reverse, pa, pb, r1, r2] = await Promise.all([
      tx.get(refs.block(blocker, blocked)),
      tx.get(refs.block(blocked, blocker)),
      tx.get(refs.matchProfile(blocker)),
      tx.get(refs.matchProfile(blocked)),
      tx.get(reports.where('reporterUid', '==', blocker).where('targetUid', '==', blocked)),
      tx.get(reports.where('reporterUid', '==', blocked).where('targetUid', '==', blocker)),
    ]);
    const own = await tx.get(refs.userBlock(blocker, blocked));
    if (!block.exists && !own.exists) return false;
    const podId = block.data()?.podId ?? own.data()?.podId ?? '';
    tx.delete(refs.block(blocker, blocked));
    tx.delete(refs.userBlock(blocker, blocked));
    const openReport = [...r1.docs, ...r2.docs].some((d) => d.get('status') === 'open');
    if (!reverse.exists && !openReport) {
      if (pa.exists) tx.update(pa.ref.withConverter(null), { blockedH: FieldValue.arrayRemove(hb), updatedAt: ts(now) });
      if (pb.exists) tx.update(pb.ref.withConverter(null), { blockedH: FieldValue.arrayRemove(ha), updatedAt: ts(now) });
    }
    if (o.ledger) {
      const ref = o.ledger.id ? erasureLedger(deps.db).doc(o.ledger.id) : erasureLedger(deps.db).doc();
      tx.set(ref, { uidH: ha, kind: 'unblock', ref: blockLedgerRef(hb, podId), at: ts(now), expiresAt: ts(now + ERASURE_LEDGER_TTL_MS) });
    }
    return true;
  });
}

async function requireCoMembers(deps: AppDeps, podId: string, a: string, b: string): Promise<DocOf<'podState'>> {
  const ps = (await docs(deps.db).podState(podId).get()).data();
  if (!ps || !ps.memberList.includes(a) || !ps.memberList.includes(b)) throw new AppError('NOT_CO_MEMBER');
  return ps;
}

export async function blockUser(deps: AppDeps, call: CallContext, input: CallableInput<'blockUser'>): Promise<CallableOutput<'blockUser'>> {
  if (input.uid === call.uid) throw new AppError('VALIDATION');
  await requireCoMembers(deps, input.podId, call.uid, input.uid);
  await applyBlock(deps, call.uid, input.uid, input.podId, call.now, { leave: input.leave === true, replan: input.replan === true, ledger: {} });
  return { ok: true };
}

export async function unblockUser(deps: AppDeps, call: CallContext, input: CallableInput<'unblockUser'>): Promise<CallableOutput<'unblockUser'>> {
  if (input.uid === call.uid) throw new AppError('VALIDATION');
  await applyUnblock(deps, call.uid, input.uid, call.now, { ledger: {} });
  return { ok: true };
}

/**
 * report (§3.7, §8.2 reports): the target must be in the pod; an option or message names its author on the server,
 * and a reported message is copied into the report (its author is `targetUid`) so it outlives the TTL. In one
 * transaction: the report, the pair in both `blockedH` while it is open (H4), the target's `openReportCount` (S5),
 * the automated pause or sensitive-theme hold with its statement of reasons, and the reporter's acknowledgement.
 */
export async function report(deps: AppDeps, call: CallContext, input: CallableInput<'report'>): Promise<CallableOutput<'report'>> {
  const refs = docs(deps.db);
  const { uid, now } = call;
  const t = input.target;
  const ps = (await refs.podState(t.podId).get()).data();
  if (!ps || !ps.memberList.includes(uid)) throw new AppError('NOT_CO_MEMBER');
  let targetUid: string;
  let message: { text: string } | undefined;
  if (t.type === 'user') {
    targetUid = t.uid!;
  } else if (t.type === 'option') {
    const option = (await refs.option(t.podId, t.optionId!).get()).data();
    if (!option || option.authorUid === FORMER_MEMBER_UID) throw new AppError('NOT_FOUND');
    targetUid = option.authorUid;
  } else {
    const pod = (await refs.pod(t.podId).get()).data();
    if (!pod?.memberUids.includes(uid)) throw new AppError('NOT_MEMBER');
    const m = (await refs.podMessage(t.podId, t.messageId!).get()).data();
    if (!m) throw new AppError('NOT_FOUND');
    targetUid = m.authorUid;
    message = { text: m.text };
  }
  if (targetUid === uid || !ps.memberList.includes(targetUid)) throw new AppError('NOT_CO_MEMBER');
  const sensitivePod = ps.theme.kind === 'concept' && ps.theme.sensitive;
  if (input.category === 'notGenuine' && !sensitivePod) throw new AppError('VALIDATION');

  const hmac = deps.uidHmac();
  const [hr, ht] = await Promise.all([uidHash(hmac, uid), uidHash(hmac, targetUid)]);
  const reportRef = deps.db.collection(COLLECTIONS.reports).doc();
  const bucketRef = refs.rateLimit(rateLimitKey(uid, REPORT_BUCKET));
  await deps.db.runTransaction(async (tx) => {
    const [bucket, reporterProfile, targetUser, targetProfile, sanction, prior] = await Promise.all([
      tx.get(bucketRef),
      tx.get(refs.matchProfile(uid)),
      tx.get(refs.user(targetUid)),
      tx.get(refs.matchProfile(targetUid)),
      tx.get(refs.sanction(targetUid)),
      tx.get(deps.db.collection(COLLECTIONS.reports).where('targetUid', '==', targetUid)),
    ]);
    const next = takeWindow(bucket.data(), now, { limit: REPORTS_PER_DAY, windowMs: DAY_MS });
    if (!next) throw new AppError('RATE_LIMITED');
    const priorReports: PriorReport[] = prior.docs.map((d) => ({
      reporterKey: String(d.get('reporterUid') ?? d.get('reporterH')),
      podId: String(d.get('podId')),
      category: d.get('category') as PriorReport['category'],
      createdAt: (d.get('createdAt') as { toMillis(): number }).toMillis(),
    }));
    const s = sanction.data() ?? null;
    const activeUnderage = s && s.reasonCode === 'underageReport' && s.until.toMillis() > now ? { since: (s.since ?? s.createdAt ?? s.until).toMillis() } : null;
    const outcome = reportOutcome({ reporterKey: uid, podId: t.podId, category: input.category, sensitivePod }, priorReports, now, activeUnderage);

    tx.set(bucketRef, next);
    tx.create(refs.report(reportRef.id), {
      reporterUid: uid,
      targetUid,
      podId: t.podId,
      target: { type: t.type, ...(t.optionId ? { optionId: t.optionId } : {}), ...(t.messageId ? { messageId: t.messageId } : {}) },
      ...(message ? { message } : {}),
      category: input.category,
      ...(input.text ? { text: input.text } : {}),
      status: 'open',
      decision: outcome.decision,
      createdAt: ts(now),
      expiresAt: ts(now + REPORT_RETENTION_MS),
    });
    if (reporterProfile.exists) tx.update(reporterProfile.ref.withConverter(null), { blockedH: FieldValue.arrayUnion(ht), updatedAt: ts(now) });
    const user = targetUser.data();
    let profile = targetProfile.data();
    if (profile) {
      profile = { ...profile, blockedH: [...new Set([...profile.blockedH, hr])], openReportCount: profile.openReportCount + 1, updatedAt: ts(now) };
      if (outcome.sensitiveHoldUntil !== null) {
        const until = Math.max(outcome.sensitiveHoldUntil, profile.sensitiveHold?.until.toMillis() ?? 0);
        profile = { ...profile, sensitiveHold: { reason: 'notGenuine', since: ts(now), until: ts(until) } };
        writeNotice(deps.db, tx, targetUid, 'statementOfReasons', NOTICE_CODES.SENSITIVE_HOLD_NOT_GENUINE, { until }, now);
      }
      let nextUser = user;
      if (outcome.sanction && user) {
        const applied = applySanction(deps.db, targetUid, { user, profile, existing: s }, outcome.sanction, now);
        if (applied) {
          applied.write(tx);
          nextUser = applied.user;
          profile = applied.profile;
        }
      }
      tx.set(refs.matchProfile(targetUid), profile);
      if (nextUser && nextUser !== user) tx.set(refs.user(targetUid), nextUser);
    }
    writeNotice(deps.db, tx, uid, 'system', NOTICE_CODES.REPORT_RECEIVED, { reportId: reportRef.id, category: input.category }, now);
  });
  return { reportId: reportRef.id };
}

/** `reports/{id}` path, for tests and the export. */
export const reportPath = (id: string): string => PATHS.report(id);
