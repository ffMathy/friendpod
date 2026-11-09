import type { WeekId } from '@friendpod/core';
import { expect, it } from 'vitest';
import { PATHS } from '../../src/lib/firestore';
import { firestoreComponentStore } from '../../src/tasks/matchComponent';
import { handleBudgetAlert } from '../../src/triggers/budget';
import { describeEmulator, emulatorDeps } from '../helpers/emulator';

describeEmulator('background functions (emulator)', () => {
  const deps = emulatorDeps(Date.UTC(2026, 10, 5, 15, 0, 0));

  it('flips the computed pointer once, create-if-absent (§6.5)', async () => {
    const weekId = '2026-W45' as WeekId;
    const componentId = `u1z${Math.random().toString(36).slice(2, 7)}`.slice(0, 8);
    const hash = 'a'.repeat(64);
    await deps.db.doc(PATHS.dropComponent(weekId, componentId)).set({ status: 'snapshotted', dryRun: false, inputHash: hash, inputPath: `${weekId}/${componentId}.input.json.gz` });

    const store = firestoreComponentStore(deps.db);
    const pointer = { inputHash: hash, path: `${weekId}/${componentId}.result.${hash}.json` };
    const results = await Promise.all([store.setComputedIfAbsent(weekId, componentId, pointer, { users: '<10' }), store.setComputedIfAbsent(weekId, componentId, pointer, { users: '<10' })]);
    expect(results.sort()).toEqual([false, true]);
    await expect(store.get(weekId, componentId)).resolves.toMatchObject({ status: 'computed', computed: pointer, stats: { users: '<10' } });
    await expect(store.setComputedIfAbsent(weekId, componentId, { ...pointer, path: 'other' }, {})).resolves.toBe(false);
    expect((await store.get(weekId, componentId))!.computed).toEqual(pointer);
  });

  it('switches off addInterests and uploads when actual spend reaches the budget, keeping other config', async () => {
    const config = deps.db.doc(PATHS.configApp());
    await config.set({ minAppVersion: '1.0.0', legalVersions: {}, skipWeeks: [], features: { interests: true, uploads: true, chips: true } });
    await expect(handleBudgetAlert(deps.db, { alertThresholdExceeded: 0.5 })).resolves.toEqual({ tripped: false });
    expect((await config.get()).data()!.features).toEqual({ interests: true, uploads: true, chips: true });
    await expect(handleBudgetAlert(deps.db, { alertThresholdExceeded: 1, costAmount: 120, budgetAmount: 100 })).resolves.toEqual({ tripped: true });
    expect((await config.get()).data()).toEqual({ minAppVersion: '1.0.0', legalVersions: {}, skipWeeks: [], features: { interests: false, uploads: false, chips: true } });
  });
});
