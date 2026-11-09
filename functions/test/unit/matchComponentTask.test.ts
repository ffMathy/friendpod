import { matchResultFileSchema, type WeekId } from '@friendpod/core';
import type * as Core from '@friendpod/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { log } from '../../src/lib/log';
import type { ObjectStore } from '../../src/lib/storage';
import {
  dropStats,
  resultPath,
  runMatchComponentTask,
  type ComponentStore,
  type ComputedPointer,
  type DropComponent,
  type DropStats,
} from '../../src/tasks/matchComponent';
import { capturedEntries, forbidInLogs } from '../helpers/logCapture';
import { COMPONENT_ID, WEEK, snapshotFile } from '../helpers/snapshot';

const matcher = vi.hoisted(() => ({ failNext: false }));
vi.mock('@friendpod/core', async (importOriginal) => {
  const actual = await importOriginal<typeof Core>();
  return {
    ...actual,
    matchComponent: (input: Parameters<typeof actual.matchComponent>[0]) => {
      if (matcher.failNext) {
        matcher.failNext = false;
        throw new actual.MatchConstraintError('H4', 0);
      }
      return actual.matchComponent(input);
    },
  };
});

class FakeObjects implements ObjectStore {
  readonly objects = new Map<string, Uint8Array>();
  writes = 0;
  async read(path: string): Promise<Uint8Array> {
    const o = this.objects.get(path);
    if (!o) throw new Error('No such object');
    return o;
  }
  async write(path: string, data: Uint8Array): Promise<void> {
    this.writes++;
    this.objects.set(path, data);
  }
}

class FakeComponents implements ComponentStore {
  readonly docs = new Map<string, DropComponent>();
  /** Simulates another attempt flipping the pointer between this attempt's read and its flip. */
  raceOnFlip = false;
  async get(weekId: WeekId, componentId: string): Promise<DropComponent | null> {
    return this.docs.get(`${weekId}/${componentId}`) ?? null;
  }
  async setComputedIfAbsent(weekId: WeekId, componentId: string, pointer: ComputedPointer, stats: DropStats): Promise<boolean> {
    const key = `${weekId}/${componentId}`;
    const doc = this.docs.get(key)!;
    if (this.raceOnFlip || doc.computed) return false;
    this.docs.set(key, { ...doc, status: 'computed', computed: pointer, stats });
    return true;
  }
}

const INPUT_PATH = `${WEEK}/${COMPONENT_ID}.input.json.gz`;
let objects: FakeObjects;
let components: FakeComponents;
let snapshot: Awaited<ReturnType<typeof snapshotFile>>;

async function setup(o: { gzip?: boolean; users?: number } = {}): Promise<void> {
  snapshot = await snapshotFile(o.users ?? 12, { gzip: o.gzip ?? true });
  objects = new FakeObjects();
  components = new FakeComponents();
  objects.objects.set(INPUT_PATH, snapshot.bytes);
  components.docs.set(`${WEEK}/${COMPONENT_ID}`, { status: 'snapshotted', dryRun: false, inputHash: snapshot.inputHash, inputPath: INPUT_PATH });
}

const deps = () => ({ components, drops: objects, now: () => 1_000, log });
const task = { weekId: WEEK, componentId: COMPONENT_ID };

beforeEach(() => setup());

describe('matchComponent task', () => {
  it('writes the whole result to one object, then flips the computed pointer', async () => {
    const { outcome } = await runMatchComponentTask(deps(), task);
    expect(outcome).toBe('computed');

    const path = resultPath(WEEK, COMPONENT_ID, snapshot.inputHash);
    expect(path).toBe(`${WEEK}/${COMPONENT_ID}.result.${snapshot.inputHash}.json`);
    const result = matchResultFileSchema.parse(JSON.parse(new TextDecoder().decode(objects.objects.get(path))));
    expect(result).toMatchObject({ weekId: WEEK, componentId: COMPONENT_ID, inputHash: snapshot.inputHash });
    expect(result.pods.length).toBeGreaterThan(0);
    const placed = result.pods.flatMap((p) => p.members);
    expect(new Set(placed).size).toBe(placed.length);

    const doc = components.docs.get(`${WEEK}/${COMPONENT_ID}`)!;
    expect(doc.status).toBe('computed');
    expect(doc.computed).toEqual({ inputHash: snapshot.inputHash, path });
  });

  it('is deterministic: a second run of the same snapshot produces the same bytes', async () => {
    await runMatchComponentTask(deps(), task);
    const path = resultPath(WEEK, COMPONENT_ID, snapshot.inputHash);
    const first = objects.objects.get(path)!;
    components.docs.set(`${WEEK}/${COMPONENT_ID}`, { ...components.docs.get(`${WEEK}/${COMPONENT_ID}`)!, computed: undefined });
    await runMatchComponentTask(deps(), task);
    expect(objects.objects.get(path)).toEqual(first);
  });

  it('stops on retry when the pointer already exists, and loses a flip race gracefully', async () => {
    await runMatchComponentTask(deps(), task);
    const writes = objects.writes;
    await expect(runMatchComponentTask(deps(), task)).resolves.toMatchObject({ outcome: 'alreadyComputed' });
    expect(objects.writes).toBe(writes);

    await setup();
    components.raceOnFlip = true;
    await expect(runMatchComponentTask(deps(), task)).resolves.toMatchObject({ outcome: 'alreadyComputed' });
    expect(components.docs.get(`${WEEK}/${COMPONENT_ID}`)!.computed).toBeUndefined();
  });

  it('accepts an uncompressed snapshot too', async () => {
    await setup({ gzip: false });
    await expect(runMatchComponentTask(deps(), task)).resolves.toMatchObject({ outcome: 'computed' });
  });

  it('refuses a snapshot whose bytes do not match inputHash, writing nothing', async () => {
    components.docs.set(`${WEEK}/${COMPONENT_ID}`, { ...components.docs.get(`${WEEK}/${COMPONENT_ID}`)!, inputHash: 'f'.repeat(64) });
    await expect(runMatchComponentTask(deps(), task)).rejects.toThrow(/inputHash/);
    expect(objects.writes).toBe(0);
  });

  it('refuses a snapshot of another component', async () => {
    await expect(runMatchComponentTask(deps(), { weekId: WEEK, componentId: 'u1zzz' })).rejects.toThrow(/not found/);
    components.docs.set(`${WEEK}/u1zzz`, { ...components.docs.get(`${WEEK}/${COMPONENT_ID}`)! });
    await expect(runMatchComponentTask(deps(), { weekId: WEEK, componentId: 'u1zzz' })).rejects.toThrow(/another component/);
    expect(objects.writes).toBe(0);
  });

  it('fails closed on a constraint assertion: no result object, no pointer, an alert without uids', async () => {
    forbidInLogs(...snapshot.uids);
    matcher.failNext = true;
    await expect(runMatchComponentTask(deps(), task)).resolves.toMatchObject({ outcome: 'assertionFailed' });
    expect(objects.writes).toBe(0);
    expect(components.docs.get(`${WEEK}/${COMPONENT_ID}`)!.computed).toBeUndefined();
    expect(capturedEntries().find((e) => e.event === 'match.assertionFailed')).toMatchObject({ constraint: 'H4', podIndex: 0, severity: 'ERROR' });
  });

  it('stores drop stats with small counts suppressed and nothing about sensitive themes', async () => {
    await setup({ users: 5 });
    await runMatchComponentTask(deps(), task);
    const stats = components.docs.get(`${WEEK}/${COMPONENT_ID}`)!.stats!;
    expect(stats.users).toBe('<10');
    expect(Object.keys(stats).some((k) => /sensitive|dropped/i.test(k))).toBe(false);
    expect(
      dropStats(
        {
          users: 40, eligible: 30, matched: 25, pods: 5, podsBySize: { 5: 5 }, sensitivePods: 1, openToAnyonePods: 0, phase1Pods: 5, phase3Pods: 0,
          movesEvaluated: 1234, inserts: 0, swaps: 0, objective: 1, droppedThemes: { noConsent: 0, partition: 0, unknownConcept: 0 }, unmatchedByReason: { RADIUS: 3, AGE: 12 },
        },
        42,
      ),
    ).toEqual({ users: 40, eligible: 30, matched: 25, pods: '<10', openToAnyonePods: 0, movesEvaluated: 1234, runtimeMs: 42, podsBySize_5: '<10', unmatched_RADIUS: '<10', unmatched_AGE: 12 });
  });

  it('folds the sensitive unmatched reasons into NO_FIT_THIS_WEEK, so no count of sensitive holders is stored', () => {
    const stats = dropStats(
      {
        users: 60, eligible: 50, matched: 20, pods: 4, podsBySize: { 5: 4 }, sensitivePods: 0, openToAnyonePods: 0, phase1Pods: 4, phase3Pods: 0,
        movesEvaluated: 10, inserts: 0, swaps: 0, objective: 1, droppedThemes: { noConsent: 0, partition: 0, unknownConcept: 0 },
        unmatchedByReason: { SENSITIVE_ELIGIBILITY: 10, SENSITIVE_DENSITY: 10, NO_FIT_THIS_WEEK: 5, AGE: 5 },
      },
      1,
    );
    expect(Object.keys(stats).filter((k) => /SENSITIVE/.test(k))).toEqual([]);
    expect(stats).toMatchObject({ unmatched_NO_FIT_THIS_WEEK: 25, unmatched_AGE: '<10' });
  });
});
