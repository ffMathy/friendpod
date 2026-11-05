/**
 * A member leaves a pod for good: sensitive withdrawal (PRIVACY.md §3.5 step 4) and erasure (§6 step 3). The order is
 * the documented one, so a retry after a failure still finds the pod through `podState.memberList`:
 *   (b) one pod transaction: out of `memberUids` and the roster (after which sendMessage refuses them), the normal
 *       below-minimum rules (§4.6), the pod removed from photo grants in both directions, the member's options and
 *       votes, their own feedback, other members' attendance and meet-again entries about them, and their pair
 *       signals with the pod's members;
 *   (c) their meetup-chat messages;
 *   (d) last, a pod transaction that removes them from `podState.members` and `memberList`, and deletes their card.
 * Other members see only "A member left" (a generic notice and push).
 */
import { NOTICE_CODES, pairKey } from '@grouper/core';
import { docs, PATHS, podStates } from '../lib/firestore';
import type { AppDeps } from '../lib/runtime';
import type { PodTx } from './context';
import { withPod } from './effects';
import { advance, afterMemberLoss, podInterests, removeFromPod } from './transitions';

export type ExitKind = 'withdrawal' | 'erasure';

/**
 * Erasure keeps a scheduled pod's winning option (the plan the others still meet at) but reattributes it to this
 * placeholder, "former member" (PRIVACY.md §6 step 3). It matches `uidSchema` and is never a Firebase uid.
 */
export const FORMER_MEMBER_UID = '_formerMember';

const MESSAGE_PAGE = 400;

function without<T>(record: Readonly<Record<string, T>>, key: string): Record<string, T> {
  const { [key]: _gone, ...rest } = record;
  return rest;
}

/** Step (b) inside one pod transaction. */
async function leaveMembership(ctx: PodTx, uid: string, kind: ExitKind): Promise<void> {
  const refs = docs(ctx.deps.db);
  await advance(ctx);
  const m = ctx.ps.members[uid]!;
  const wasCurrent = ctx.pod?.memberUids.includes(uid) ?? false;
  if (wasCurrent || m.status === 'invited' || m.status === 'accepted') {
    await removeFromPod(ctx, uid, 'removed');
    if (wasCurrent && ctx.pod) {
      const rest = ctx.currentMembers();
      await ctx.loadProfiles(rest);
      const shared = await podInterests(ctx, rest);
      ctx.updatePod((p) => ({ ...p, podInterests: shared }));
      for (const other of rest) ctx.notice(other, NOTICE_CODES.POD_MEMBER_LEFT);
      ctx.push('podChanged', rest);
    }
    if (wasCurrent || ctx.state === 'proposed') await afterMemberLoss(ctx);
  }
  for (const other of ctx.ps.memberList) {
    ctx.revoke(uid, other);
    ctx.revoke(other, uid);
  }

  await ctx.loadOptions();
  const winning = ctx.pod?.planning.winningOptionId;
  for (const [id, o] of ctx.currentOptions()) {
    const votes = without(o.votes, uid);
    if (o.authorUid === uid) {
      if (kind === 'erasure' && id === winning) ctx.setOption(id, { ...o, authorUid: FORMER_MEMBER_UID, votes });
      else ctx.deleteOption(id);
    } else if (o.votes[uid] !== undefined) {
      ctx.setOption(id, { ...o, votes });
    }
  }

  const everyone = ctx.ps.memberList;
  const feedback = await ctx.tx.getAll(...everyone.map((x) => refs.podFeedback(ctx.podId, x)));
  feedback.forEach((snap, i) => {
    const d = snap.data();
    if (!d) return;
    if (everyone[i] === uid) ctx.write((tx) => tx.delete(snap.ref));
    else if (uid in d.attendance || uid in d.meetAgain) ctx.write((tx) => tx.set(snap.ref, { ...d, attendance: without(d.attendance, uid), meetAgain: without(d.meetAgain, uid) }));
  });

  const others = everyone.filter((x) => x !== uid);
  if (others.length > 0) {
    const hmac = ctx.deps.uidHmac();
    const keys = await Promise.all(others.map((o) => pairKey(hmac, uid, o)));
    const signals = await ctx.tx.getAll(...keys.map((k) => refs.pairSignal(k)));
    for (const s of signals) if (s.exists) ctx.write((tx) => tx.delete(s.ref));
  }
}

/** Steps (b)–(d) for one pod; false when the user is not (or no longer) in it. Idempotent. */
export async function exitPod(deps: AppDeps, podId: string, uid: string, kind: ExitKind): Promise<boolean> {
  const listed = await withPod(deps, podId, deps.now(), async (ctx) => {
    if (!ctx.ps.members[uid]) return false;
    await leaveMembership(ctx, uid, kind);
    return true;
  }).catch((err: unknown) => {
    if ((err as { code?: unknown }).code === 'NOT_FOUND') return false;
    throw err;
  });
  if (!listed) return false;

  const messages = deps.db.collection(`${PATHS.pod(podId)}/messages`).where('authorUid', '==', uid);
  for (;;) {
    const page = await messages.select().limit(MESSAGE_PAGE).get();
    if (page.empty) break;
    const batch = deps.db.batch();
    for (const d of page.docs) batch.delete(d.ref);
    await batch.commit();
  }

  await withPod(deps, podId, deps.now(), async (ctx) => {
    if (!ctx.ps.members[uid] && !ctx.ps.memberList.includes(uid)) return;
    delete ctx.ps.members[uid];
    ctx.ps.memberList = ctx.ps.memberList.filter((x) => x !== uid);
    ctx.write((tx) => tx.delete(docs(deps.db).podCard(uid, podId)));
  });
  return true;
}

/** Every pod the user was ever in (`podState.memberList`, archived ones included), with its podState. */
export async function podsOf(deps: Pick<AppDeps, 'db'>, uid: string) {
  return (await podStates(deps.db).where('memberList', 'array-contains', uid).get()).docs.map((d) => ({ podId: d.id, ps: d.data() }));
}
