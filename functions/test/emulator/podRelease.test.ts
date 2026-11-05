/**
 * Drop orchestration, release revalidation and backfill (DESIGN.md §6.5, §10.3, §4.2) against the Firestore emulator.
 * This file owns drop weeks 2027-W06 and 2027-W07 (release touches every unreleased component of its week).
 */
import { gunzipSync } from 'node:zlib';
import { dropSchedule, uidHash, type WeekId } from '@grouper/core';
import { expect, it } from 'vitest';
import { respondToPod } from '../../src/callables/pods';
import { docs, ts } from '../../src/lib/firestore';
import { backfillPod } from '../../src/pods/backfill';
import { orchestrateDrop } from '../../src/pods/orchestrator';
import { releaseDrop } from '../../src/pods/release';
import { firestoreComponentStore, runMatchComponentTask } from '../../src/tasks/matchComponent';
import { describeEmulator, emulatorDeps, errorCode, invoke } from '../helpers/emulator';
import { forbidInLogs } from '../helpers/logCapture';
import { testUidHmac } from '../helpers/keys';
import { AARHUS_CELL, computedComponent, makeConcept, makeUser, makeUsers, MemoryObjects, newConcept, threeThemes, read, releaseDeps, releasedPod, pushedUids, sharedDrops } from '../helpers/pods';

const W46 = '2027-W06' as WeekId;
const W47 = '2027-W07' as WeekId;
const S46 = dropSchedule(W46);

describeEmulator('releaseDrop (emulator)', () => {
  const deps = emulatorDeps(S46.computeAt);

  it('proposes each pod once: podState and cards with create(), profiles claimed, generic pushes, objects deleted', async () => {
    const theme = newConcept();
    const members = await makeUsers(deps, 5, { themes: [{ c: theme }] });
    forbidInLogs(...members);
    const { drops, componentId } = await computedComponent(deps, [members], { weekId: W46, theme });
    deps.clock.now = S46.releaseAt;
    const pushesBefore = deps.pushes.length;
    const frozen = new Map(drops.objects);
    const out = await releaseDrop(releaseDeps(deps, drops), W46);
    expect(out).toMatchObject({ outcome: 'released', pods: 1, invited: 5 });

    const podId = (await deps.db.collection('podState').where('memberList', 'array-contains', members[0]).get()).docs[0]!.id;
    const ps = (await read.podState(deps, podId))!;
    expect(ps).toMatchObject({ state: 'proposed', weekId: W46, componentId, version: 0, backfill: { used: false } });
    expect(ps.timers.acceptBy.toMillis()).toBe(S46.acceptBy);
    expect(ps.dueAt!.toMillis()).toBe(S46.acceptBy);
    for (const uid of members) {
      const card = (await read.card(deps, uid, podId))!;
      // The viewer's own wording only, never a concept label (§6.7).
      expect(card).toMatchObject({ state: 'proposed', myStatus: 'invited', themeLabel: `my ${theme.slice(-4)}`, themeSensitive: false, sizeTarget: 5, acceptedCount: 0 });
      expect(card.reasons[0]).toEqual({ code: 'THEME', yourWording: `my ${theme.slice(-4)}` });
      const p = await read.profile(deps, uid);
      expect(p.weekClaim).toBe(W46);
      expect(p.lastDrop).toEqual({ weekId: W46, outcome: 'proposed', podId });
      expect(Object.keys(p.recentH)).toHaveLength(4);
      expect(p.milestones.firstProposalAt?.toMillis()).toBe(S46.releaseAt);
      expect((await read.user(deps, uid))!.lastDrop).toEqual({ weekId: W46, outcome: 'proposed' });
    }
    // No shared pod doc before confirmation.
    expect(await read.pod(deps, podId)).toBeUndefined();
    expect(pushedUids(deps, 'dropReady', pushesBefore)).toEqual([...members].sort());
    expect(drops.objects.size).toBe(0);
    expect((await docs(deps.db).dropComponent(W46, componentId).get()).data()!.status).toBe('released');
    expect((await read.funnel(deps, null, W46))?.counts?.firstProposal).toBeGreaterThanOrEqual(5);

    // A release retried after a crash before the status flip finds the same pod id and changes nothing.
    await docs(deps.db).dropComponent(W46, componentId).update({ status: 'computed' });
    for (const [k, v] of frozen) if (k.includes(componentId)) drops.objects.set(k, v);
    const again = await releaseDrop(releaseDeps(deps, drops), W46);
    expect(again).toMatchObject({ pods: 0, invited: 0 });
    expect((await read.podState(deps, podId))!.version).toBe(0);
    expect(deps.pushes.length).toBe(pushesBefore + 1);
  });

  it('revalidates: deleted, paused and newly blocked members get no card and no recreated subtree; a pod below 4 is not proposed', async () => {
    const theme = newConcept();
    const [a, b, c, d, e] = await makeUsers(deps, 5, { themes: [{ c: theme }] });
    const [f, g, h, i] = await makeUsers(deps, 4, { themes: [{ c: theme }] });
    // Between 16:00 and 18:00: e deletes the account, d pauses, and a blocks b.
    await docs(deps.db).user(e!).delete();
    await docs(deps.db).matchProfile(e!).delete();
    await docs(deps.db).user(d!).update({ status: 'paused', 'participation.pauseReason': 'user' });
    await docs(deps.db).matchProfile(d!).update({ status: 'paused' });
    await docs(deps.db).matchProfile(a!).update({ blockedH: [await uidHash(testUidHmac, b!)] });
    // In the second pod, i withdrew the theme (no holding any more): 3 remain, so no proposal.
    const holdings = await deps.db.collection(`users/${i}/interests`).get();
    await Promise.all(holdings.docs.map((x) => x.ref.delete()));

    const { drops } = await computedComponent(deps, [[a!, b!, c!, d!, e!], [f!, g!, h!, i!]], { weekId: W46, theme });
    deps.clock.now = S46.releaseAt;
    const out = await releaseDrop(releaseDeps(deps, drops), W46);
    expect(out).toMatchObject({ pods: 0, invited: 0 });
    for (const uid of [a, b, c, d, e, f, g, h, i]) expect((await deps.db.collection(`users/${uid}/pods`).get()).size, uid).toBe(0);
    expect((await docs(deps.db).user(e!).get()).exists).toBe(false);
    expect((await deps.db.collection(`users/${e}/pods`).get()).size).toBe(0);
    // Everyone still eligible joins the backfill pool; the paused member is excluded.
    expect((await read.profile(deps, c!)).lastDrop).toEqual({ weekId: W46, outcome: 'unmatched' });
    expect((await read.user(deps, c!))!.lastDrop).toEqual({ weekId: W46, outcome: 'unmatched', reason: 'NO_FIT_THIS_WEEK' });
    expect((await read.profile(deps, d!)).lastDrop).toEqual({ weekId: W46, outcome: 'excluded' });
    expect((await read.profile(deps, f!)).lastDrop).toEqual({ weekId: W46, outcome: 'unmatched' });
    expect((await read.profile(deps, c!)).weekClaim).toBeNull();
  });

  it('releases nothing from a beta (dry-run) component, and retries while a component is still computing', async () => {
    const theme = newConcept();
    const members = await makeUsers(deps, 4, { themes: [{ c: theme }] });
    const drops = sharedDrops;
    const dry = await computedComponent(deps, [members], { weekId: W46, theme, dryRun: true });
    await docs(deps.db).dropComponent(W46, 'pendingc1').set({ status: 'snapshotted', dryRun: false, inputHash: 'a'.repeat(64), inputPath: 'x' });
    deps.clock.now = S46.releaseAt;
    await expect(releaseDrop(releaseDeps(deps, drops), W46)).rejects.toThrow('not computed');
    expect((await deps.db.collection(`users/${members[0]}/pods`).get()).size).toBe(0);
    expect((await docs(deps.db).dropComponent(W46, dry.componentId).get()).data()!.status).toBe('released');
    await docs(deps.db).dropComponent(W46, 'pendingc1').delete();
  });
});

describeEmulator('dropOrchestrator → matchComponent → releaseDrop (emulator)', () => {
  const deps = emulatorDeps(dropSchedule(W47).computeAt);

  it('freezes one snapshot per component of the live areas, enqueues matching and release, and a retry reuses them', async () => {
    const theme = newConcept();
    await deps.db.doc('areas/aarhus').set({ status: 'live' }, { merge: true });
    try {
      const [c2, c3] = [await makeConcept(deps), await makeConcept(deps)];
      await makeConcept(deps, theme);
      const members = await makeUsers(deps, 5, { themes: [{ c: theme }, { c: c2 }, { c: c3 }], gh5: AARHUS_CELL, areaId: 'aarhus' });
      const paused = await makeUser(deps, { themes: [{ c: theme }], gh5: AARHUS_CELL, areaId: 'aarhus', status: 'paused' });
      const drops = new MemoryObjects();
      const now = dropSchedule(W47).computeAt;
      const out = await orchestrateDrop(releaseDeps(deps, drops), now);
      expect(out.outcome).toBe('orchestrated');
      const comp = (await docs(deps.db).dropComponent(W47, AARHUS_CELL).get()).data()!;
      expect(comp).toMatchObject({ status: 'snapshotted', dryRun: false, inputPath: `${W47}/${AARHUS_CELL}.input.json.gz` });
      const snap = JSON.parse(gunzipSync(drops.objects.get(comp.inputPath)!).toString()) as { users: { uid: string }[]; profile: string };
      const uids = snap.users.map((u) => u.uid);
      for (const m of members) expect(uids).toContain(m);
      expect(uids).not.toContain(paused);
      expect(snap.profile).toBe('alpha');
      expect(deps.enqueued.filter((t) => t.queue === 'matchComponent').map((t) => t.options.id)).toContain(`${W47}-${AARHUS_CELL}`);
      expect(deps.enqueued.find((t) => t.queue === 'releaseDrop')).toMatchObject({ data: { weekId: W47 }, options: { scheduleTime: dropSchedule(W47).releaseAt } });

      const enqueuedBefore = deps.enqueued.length;
      await orchestrateDrop(releaseDeps(deps, drops), now);
      expect((await docs(deps.db).dropComponent(W47, AARHUS_CELL).get()).data()!.inputHash).toBe(comp.inputHash);
      expect(deps.enqueued.length).toBe(enqueuedBefore);

      // The matcher runs on the frozen file; release proposes from its result.
      const matched = await runMatchComponentTask({ components: firestoreComponentStore(deps.db), drops, now: () => now, log: deps.log }, { weekId: W47, componentId: AARHUS_CELL });
      expect(matched.outcome).toBe('computed');
      deps.clock.now = dropSchedule(W47).releaseAt;
      const released = await releaseDrop(releaseDeps(deps, drops), W47);
      expect(released.invited).toBeGreaterThanOrEqual(4);
      expect(drops.objects.size).toBe(0);
    } finally {
      await deps.db.doc('areas/aarhus').set({ status: 'waitlist' }, { merge: true });
    }
  });

  it('skips listed weeks', async () => {
    await deps.db.doc('config/app').set({ skipWeeks: [W47] }, { merge: true });
    try {
      expect((await orchestrateDrop(releaseDeps(deps), dropSchedule(W47).computeAt)).outcome).toBe('skipped');
    } finally {
      await deps.db.doc('config/app').set({ skipWeeks: [] }, { merge: true });
    }
  });
});

describeEmulator('backfillPod (emulator)', () => {
  const deps = emulatorDeps(S46.releaseAt);

  it('invites a compatible pool member after a decline leaves too few, claiming them in the same transaction', async () => {
    const theme = newConcept();
    const members = await makeUsers(deps, 4, { themes: [{ c: theme }] });
    const pool = await makeUser(deps, { themes: threeThemes(theme), lastDrop: { weekId: W46, outcome: 'unmatched' } });
    const blocked = await makeUser(deps, { themes: threeThemes(theme), lastDrop: { weekId: W46, outcome: 'unmatched' } });
    // Too few interests to be matched at all (§4.3): never a backfill candidate either.
    const thin = await makeUser(deps, { themes: [{ c: theme }], lastDrop: { weekId: W46, outcome: 'unmatched' } });
    await docs(deps.db).matchProfile(blocked).update({ blockedH: [await uidHash(testUidHmac, members[0]!)] });
    const podId = await releasedPod(deps, members, { weekId: W46, theme });

    deps.clock.now = S46.releaseAt + 3_600_000;
    await invoke('respondToPod', respondToPod, deps, { podId, accept: false, reason: 'theme' }, { uid: members[3]! });
    const ps = (await read.podState(deps, podId))!;
    expect(ps.backfill.used).toBe(true);
    expect(ps.timers.backfillUntil!.toMillis()).toBe(S46.releaseAt + 3_600_000 + 86_400_000);
    const task = deps.enqueued.find((t) => t.queue === 'backfillPod' && t.data.podId === podId)!;
    expect(task).toMatchObject({ data: { weekId: W46, podId }, options: { id: `backfill-${podId}` } });

    const out = await backfillPod(deps, { weekId: W46, podId });
    expect(out).toEqual({ outcome: 'invited', invited: 1 });
    const after = (await read.podState(deps, podId))!;
    expect(after.members[pool]).toMatchObject({ status: 'invited', viaBackfill: true });
    expect(after.members[blocked]).toBeUndefined();
    expect(after.members[thin]).toBeUndefined();
    expect((await read.profile(deps, pool)).weekClaim).toBe(W46);
    expect((await read.card(deps, pool, podId))!.acceptBy.toMillis()).toBe(after.timers.backfillUntil!.toMillis());
    expect((await read.profile(deps, pool)).milestones.firstProposalAt).toBeDefined();
    // Once per pod.
    expect(await backfillPod(deps, { weekId: W46, podId })).toEqual({ outcome: 'alreadyInvited', invited: 0 });

    // The backfilled invitee accepts and the pod confirms with 4.
    for (const uid of members.slice(0, 3)) await invoke('respondToPod', respondToPod, deps, { podId, accept: true }, { uid });
    const res = await invoke('respondToPod', respondToPod, deps, { podId, accept: true }, { uid: pool });
    expect(res).toEqual({ state: 'planning', acceptedCount: 4 });
    // After its deadline a backfill invitation cannot be accepted.
    expect(await errorCode(invoke('respondToPod', respondToPod, deps, { podId, accept: true }, { uid: members[3]! }))).toBe('NOT_INVITED');
  });

  it('recomputes the round when podState changes between the pool read and the claim (version compare-and-set)', async () => {
    const theme = newConcept();
    const members = await makeUsers(deps, 4, { themes: [{ c: theme }] });
    const pool = await makeUser(deps, { themes: threeThemes(theme), lastDrop: { weekId: W46, outcome: 'unmatched' } });
    const podId = await releasedPod(deps, members, { weekId: W46, theme });
    deps.clock.now = S46.releaseAt + 3_600_000;
    await invoke('respondToPod', respondToPod, deps, { podId, accept: false }, { uid: members[3]! });
    await invoke('respondToPod', respondToPod, deps, { podId, accept: false }, { uid: members[2]! });
    const before = (await read.podState(deps, podId))!.version;
    // The first HMAC use happens while the candidates are computed: another transaction bumps podState right then.
    let bumped = false;
    const racing = Object.assign(Object.create(deps) as typeof deps, {
      uidHmac: () => async (m: Uint8Array) => {
        if (!bumped) {
          bumped = true;
          await invoke('respondToPod', respondToPod, deps, { podId, accept: true }, { uid: members[0]! });
        }
        return testUidHmac(m);
      },
    });
    expect(await backfillPod(racing, { weekId: W46, podId })).toEqual({ outcome: 'invited', invited: 1 });
    const after = (await read.podState(deps, podId))!;
    expect(bumped).toBe(true);
    expect(after.version).toBe(before + 2);
    expect(after.members[members[0]!]!.status).toBe('accepted');
    expect(after.members[pool]!.status).toBe('invited');
  });

  it('does nothing once the plan has locked (D6)', async () => {
    const theme = newConcept();
    const members = await makeUsers(deps, 4, { themes: [{ c: theme }] });
    const podId = await releasedPod(deps, members, { weekId: W46, theme });
    await docs(deps.db).podState(podId).update({ state: 'planning', planLockedAt: ts(S46.releaseAt), backfill: { used: true, until: ts(S46.releaseAt + 86_400_000) } });
    deps.clock.now = S46.releaseAt + 1000;
    expect(await backfillPod(deps, { weekId: W46, podId })).toEqual({ outcome: 'notApplicable', invited: 0 });
  });
});
