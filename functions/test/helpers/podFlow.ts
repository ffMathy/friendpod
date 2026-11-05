/** Pod set-ups through the real callables (respondToPod, proposeOption, voteOption), shared by the newer suites. */
import { CALLABLES, dropSchedule, type CallableInput, type CallableName, type CallableOutput, type WeekId } from '@grouper/core';
import { expect } from 'vitest';
import * as pods from '../../src/callables/pods';
import type { CallContext } from '../../src/lib/handler';
import type { AppDeps } from '../../src/lib/runtime';
import { withPod } from '../../src/pods/effects';
import { advance } from '../../src/pods/transitions';
import { invoke, type TestDeps } from './emulator';
import { appCheck } from './requests';
import { makeUsers, newConcept, place, read, releasedPod, type UserOptions } from './pods';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

type Impl<N extends CallableName> = (deps: AppDeps, call: CallContext, input: CallableInput<N>) => Promise<CallableOutput<N>>;

export function podFlow(deps: TestDeps) {
  function call<N extends CallableName>(name: N, impl: Impl<N>, uid: string, data: unknown, at?: number): Promise<CallableOutput<N>> {
    if (at !== undefined) deps.clock.now = at;
    // Replay-protected callables need a limited-use App Check token that was not consumed before (§9).
    return invoke(name, impl, deps, data, { uid, ...(CALLABLES[name].replayProtected ? { app: appCheck(deps.clock.now, false) } : {}) });
  }
  const accept = (podId: string, uid: string, at?: number) => call('respondToPod', pods.respondToPod, uid, { podId, accept: true }, at);
  const state = async (podId: string) => (await read.podState(deps, podId))!;
  const sweepPod = (podId: string, t: number) => {
    deps.clock.now = t;
    return withPod(deps, podId, t, (ctx) => advance(ctx));
  };

  async function proposedPod(n: number, weekId: WeekId, o: { sensitive?: boolean; theme?: string; user?: UserOptions; members?: string[] } = {}) {
    const theme = o.theme ?? newConcept();
    const members = o.members ?? (await makeUsers(deps, n, { themes: [{ c: theme, sens: o.sensitive ?? false }], ...o.user }));
    const podId = await releasedPod(deps, members, { weekId, theme, sensitive: o.sensitive ?? false });
    return { podId, members, theme };
  }

  async function planningPod(n: number, weekId: WeekId, o: Parameters<typeof proposedPod>[2] = {}) {
    const p = await proposedPod(n, weekId, o);
    const t = dropSchedule(weekId).releaseAt + HOUR;
    for (const uid of p.members) await accept(p.podId, uid, t);
    expect((await state(p.podId)).state).toBe('planning');
    return p;
  }

  const option = async (podId: string, uid: string, startsAt: number, at?: number) => (await call('proposeOption', pods.proposeOption, uid, { podId, startsAt, place: place() }, at)).optionId;
  const vote = (podId: string, uid: string, optionId: string, v: 'yes' | 'no' | null, at?: number) => call('voteOption', pods.voteOption, uid, { podId, optionId, vote: v }, at);

  /** Locked on one option by a unanimous yes at release + 2 h; the meetup 5 days after release, 18:00 local. */
  async function scheduledPod(n: number, weekId: WeekId, o: Parameters<typeof proposedPod>[2] = {}) {
    const p = await planningPod(n, weekId, o);
    const lockAt = dropSchedule(weekId).releaseAt + 2 * HOUR;
    const meetupAt = dropSchedule(weekId).releaseAt + 5 * DAY;
    const optionId = await option(p.podId, p.members[0]!, meetupAt, lockAt);
    for (const uid of p.members) await vote(p.podId, uid, optionId, 'yes', lockAt);
    expect((await state(p.podId)).state).toBe('scheduled');
    return { ...p, optionId, meetupAt, lockAt };
  }

  return { call, accept, state, sweepPod, proposedPod, planningPod, scheduledPod, option, vote };
}
