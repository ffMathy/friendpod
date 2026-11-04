import { CALLABLES, type CallableName } from '@grouper/core';
import { describe, expect, it } from 'vitest';
import * as index from '../../src/index';
import { HOT_CALLABLES, callableOptions } from '../../src/lib/options';
import { SCHEDULE_OPTIONS } from '../../src/scheduled';
import { TASK_OPTIONS } from '../../src/tasks';

interface Endpoint {
  region?: string[];
  cpu?: number | string;
  availableMemoryMb?: number;
  concurrency?: number;
  maxInstances?: number;
  timeoutSeconds?: number | null;
  serviceAccountEmail?: string;
  secretEnvironmentVariables?: { key: string }[];
  callableTrigger?: object;
  scheduleTrigger?: { schedule: string; timeZone: string; retryConfig: { retryCount: number } };
  taskQueueTrigger?: { retryConfig: { maxAttempts: number }; rateLimits: { maxConcurrentDispatches: number } };
  eventTrigger?: { eventType: string; eventFilters: Record<string, string>; retry: boolean };
}
const endpoint = (name: string): Endpoint => (index as unknown as Record<string, { __endpoint: Endpoint }>)[name]!.__endpoint;

const DEFAULT_CALLABLES = (Object.keys(CALLABLES) as CallableName[]).filter((n) => CALLABLES[n].codebase === 'default');
const BACKGROUND = ['dropOrchestrator', 'hourlySweeper', 'dailyMaintenance', 'matchComponent', 'releaseDrop', 'backfillPod', 'buildExport', 'deleteExport', 'interestsBatch', 'purgeUser', 'onPhotoUploaded', 'onBudgetAlert'];

describe('codebase "default" exports', () => {
  it('exports exactly the §10.1 callables and the §10.3 functions, and nothing else', () => {
    expect(Object.keys(index).sort()).toEqual([...DEFAULT_CALLABLES, ...BACKGROUND].sort());
    // Every callable lives here since the app embeds tags itself (D1).
    expect(DEFAULT_CALLABLES).toEqual(Object.keys(CALLABLES));
    expect(DEFAULT_CALLABLES).toContain('addInterests');
  });

  it('deploys every function to europe-west1 as sa-api@', () => {
    for (const name of Object.keys(index)) {
      expect(endpoint(name).region, name).toEqual(['europe-west1']);
      expect(endpoint(name).serviceAccountEmail, name).toBe('sa-api@');
    }
  });

  it('enforces App Check on every callable and consumes tokens only where replay-protected (§9)', () => {
    for (const name of DEFAULT_CALLABLES) {
      const o = callableOptions(name);
      expect(o.enforceAppCheck, name).toBe(true);
      expect(o.consumeAppCheckToken === true, name).toBe(CALLABLES[name].replayProtected);
      expect(endpoint(name).callableTrigger, name).toBeDefined();
      expect(endpoint(name).secretEnvironmentVariables, name).toEqual([{ key: 'UID_HMAC_KEY' }]);
    }
    expect(DEFAULT_CALLABLES.filter((n) => CALLABLES[n].replayProtected).sort()).toEqual(['deleteAccount', 'exportData', 'report']);
  });

  it('uses the gcf_gen1 defaults, and the hot profile for the four burst callables (§7)', () => {
    for (const name of DEFAULT_CALLABLES) {
      const e = endpoint(name);
      if (HOT_CALLABLES.has(name)) expect(e, name).toMatchObject({ cpu: 1, availableMemoryMb: 512, concurrency: 40, maxInstances: 20 });
      else expect(e, name).toMatchObject({ cpu: 'gcf_gen1', availableMemoryMb: 256, concurrency: 1, maxInstances: 10 });
    }
    expect([...HOT_CALLABLES].sort()).toEqual(['confirmAttendance', 'registerPushToken', 'respondToPod', 'voteOption']);
  });

  it('schedules the three jobs in Europe/Copenhagen (§10.3)', () => {
    expect(endpoint('dropOrchestrator')).toMatchObject({
      cpu: 1,
      availableMemoryMb: 1024,
      timeoutSeconds: 1800,
      scheduleTrigger: { schedule: '0 16 * * 4', timeZone: 'Europe/Copenhagen', retryConfig: { retryCount: 1 } },
    });
    expect(endpoint('hourlySweeper').scheduleTrigger).toMatchObject({ schedule: '5 * * * *', timeZone: 'Europe/Copenhagen' });
    expect(endpoint('dailyMaintenance').scheduleTrigger).toMatchObject({ schedule: '17 3 * * *', timeZone: 'Europe/Copenhagen' });
    expect(Object.keys(SCHEDULE_OPTIONS).sort()).toEqual(['dailyMaintenance', 'dropOrchestrator', 'hourlySweeper']);
  });

  it('gives every task queue an explicit retryConfig and rateLimits', () => {
    for (const name of Object.keys(TASK_OPTIONS)) {
      const t = endpoint(name).taskQueueTrigger;
      expect(t?.retryConfig.maxAttempts, name).toBeGreaterThan(0);
      expect(t?.rateLimits.maxConcurrentDispatches, name).toBeGreaterThan(0);
    }
    expect(endpoint('matchComponent')).toMatchObject({ cpu: 1, availableMemoryMb: 1024, timeoutSeconds: 1800, taskQueueTrigger: { retryConfig: { maxAttempts: 2 } } });
    expect(endpoint('releaseDrop')).toMatchObject({ cpu: 1, availableMemoryMb: 1024, timeoutSeconds: 1800 });
    expect(endpoint('releaseDrop').secretEnvironmentVariables?.map((s) => s.key).sort()).toEqual(['POD_ID_KEY', 'UID_HMAC_KEY']);
    expect(endpoint('purgeUser').taskQueueTrigger?.retryConfig.maxAttempts).toBe(6);
    expect(endpoint('interestsBatch')).toMatchObject({ timeoutSeconds: 1800, taskQueueTrigger: { rateLimits: { maxConcurrentDispatches: 1 } } });
  });

  it('wires the Storage and Pub/Sub triggers without retries', () => {
    expect(endpoint('onPhotoUploaded').eventTrigger).toMatchObject({ eventType: 'google.cloud.storage.object.v1.finalized', retry: false });
    expect(endpoint('onBudgetAlert').eventTrigger).toMatchObject({ eventType: 'google.cloud.pubsub.topic.v1.messagePublished', eventFilters: { topic: 'budget-alerts' }, retry: false });
  });
});
