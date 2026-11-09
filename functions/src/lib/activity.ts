/**
 * `users.lastActiveAt` (DESIGN.md §8.1; PRIVACY.md §5 inactivity): the one place that records activity. Every
 * onboarded callable goes through `withActivity` (callables/index.ts), so any use of the app that reaches the server
 * (appOpened at every app start and foreground, the pod callables, …) keeps the account out of the 12-month inactivity deletion.
 * Throttled to one write per account per day [A]: a plain read, and an update only when the stored value is older.
 * A failure is logged and never fails the call.
 */
import { CALLABLES, type CallableInput, type CallableName, type CallableOutput } from '@friendpod/core';
import { DAY_MS, PATHS, ts } from './firestore';
import type { CallContext } from './handler';
import { errorFields } from './log';
import type { AppDeps } from './runtime';

export const ACTIVITY_THROTTLE_MS = DAY_MS;

/** Moves `lastActiveAt` to `now` if it is at least a day old; nothing for a missing or deleting account. */
export async function touchActivity(deps: Pick<AppDeps, 'db' | 'log'>, uid: string, now: number): Promise<boolean> {
  try {
    const ref = deps.db.doc(PATHS.user(uid));
    const snap = await ref.get();
    if (!snap.exists || snap.get('status') === 'deleting') return false;
    const last = (snap.get('lastActiveAt') as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
    if (now - last < ACTIVITY_THROTTLE_MS) return false;
    // The precondition keeps a concurrent deletion (status: deleting) from being overwritten by a stale read.
    await ref.update({ lastActiveAt: ts(now) }, { lastUpdateTime: snap.updateTime! });
    return true;
  } catch (err) {
    deps.log.warn('activity.touchFailed', errorFields(err));
    return false;
  }
}

type Impl<N extends CallableName> = (deps: AppDeps, call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

/** The onboarded-callable wrapper: records activity (throttled) before the implementation runs. */
export function withActivity<N extends CallableName>(name: N, impl: Impl<N>): Impl<N> {
  if (!CALLABLES[name].requiresOnboarding) return impl;
  return async (deps, call, input) => {
    await touchActivity(deps, call.uid, call.now);
    return impl(deps, call, input);
  };
}
