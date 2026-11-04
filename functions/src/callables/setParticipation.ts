/**
 * setParticipation (DESIGN.md §10.1). Writes `users` (what the app shows) and the `matchProfiles` mirror that
 * dropOrchestrator and release revalidation read, in one transaction. Writing matchProfiles also makes a
 * concurrent release batch fail its `lastUpdateTime` precondition, so a pause after 16:00 still applies (§10.3).
 */
import type { CallableInput, CallableOutput, UserDoc } from '@grouper/core';
import { AppError } from '../lib/errors';
import { docs, ts } from '../lib/firestore';
import type { CallContext } from '../lib/handler';
import { applyParticipation, type ParticipationState } from '../lib/participation';
import type { AppDeps } from '../lib/runtime';

function stateOf(user: UserDoc): ParticipationState {
  const p = user.participation;
  return {
    status: user.status,
    mode: p.mode,
    skipWeekId: p.skipWeekId ?? null,
    optInWeekId: p.optInWeekId ?? null,
    pausedUntil: p.pausedUntil?.toMillis() ?? null,
    pauseReason: p.pauseReason ?? null,
  };
}

function userParticipation(s: ParticipationState): UserDoc['participation'] {
  return {
    mode: s.mode,
    ...(s.pausedUntil !== null ? { pausedUntil: ts(s.pausedUntil) } : {}),
    ...(s.pauseReason !== null ? { pauseReason: s.pauseReason } : {}),
    ...(s.skipWeekId !== null ? { skipWeekId: s.skipWeekId } : {}),
    ...(s.optInWeekId !== null ? { optInWeekId: s.optInWeekId } : {}),
  };
}

export async function setParticipation(
  deps: AppDeps,
  call: CallContext,
  input: CallableInput<'setParticipation'>,
): Promise<CallableOutput<'setParticipation'>> {
  const refs = docs(deps.db);
  const userRef = refs.user(call.uid);
  const profileRef = refs.matchProfile(call.uid);
  const at = ts(call.now);

  return deps.db.runTransaction(async (tx) => {
    const [userSnap, profileSnap] = await Promise.all([tx.get(userRef), tx.get(profileRef)]);
    const user = userSnap.data();
    const profile = profileSnap.data();
    if (!user || !profile) throw new AppError('NOT_FOUND');

    const { next, effectiveWeekId } = applyParticipation(stateOf(user), input.mode, input.until, call.now);
    tx.set(userRef, { ...user, status: next.status, participation: userParticipation(next), lastActiveAt: at });
    tx.set(profileRef, {
      ...profile,
      status: next.status,
      participation: {
        mode: next.mode,
        skipWeekId: next.skipWeekId,
        optInWeekId: next.optInWeekId,
        pausedUntil: next.pausedUntil === null ? null : ts(next.pausedUntil),
      },
      updatedAt: at,
    });
    return { effectiveWeekId };
  });
}
