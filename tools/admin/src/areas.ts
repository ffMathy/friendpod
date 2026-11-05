/**
 * Launch areas (DESIGN.md §6.4, Q11, §10.3 openArea). `packages/core/src/geo/areas.json` is the versioned config;
 * `areas/{areaId}` is its mirror, whose `status` the server trusts over the file (functions/src/lib/areas.ts
 * readAreas), so "Aarhus live, Copenhagen waitlist" is this CLI's change, not a deploy. Going live enqueues the
 * idempotent `openArea` task, which marks everyone in the area eligible for the next drop and sends "<city> is open".
 */
import { areaDocFromConfig, getLaunchArea, LAUNCH_AREA_STATUSES, LAUNCH_AREAS, waitlistDisplay, type LaunchAreaStatus } from '@grouper/core';
import type { Firestore } from 'firebase-admin/firestore';
import { UsageError } from './args';
import { recorded } from './audit';
import type { AdminContext, EnqueueOutcome } from './context';
import { table } from './format';

export const AREAS = 'areas';

export function parseAreaStatus(value: string | undefined): LaunchAreaStatus {
  if (!value || !(LAUNCH_AREA_STATUSES as readonly string[]).includes(value)) {
    throw new UsageError(`status must be one of ${LAUNCH_AREA_STATUSES.join(', ')}`);
  }
  return value as LaunchAreaStatus;
}

export function requireLaunchArea(areaId: string | undefined) {
  const area = areaId ? getLaunchArea(areaId) : null;
  if (!area) throw new UsageError(`unknown launch area ${areaId ?? ''}: one of ${LAUNCH_AREAS.map((a) => a.id).join(', ')}`);
  return area;
}

export interface AreaRow {
  readonly areaId: string;
  readonly label: string;
  /** The doc's status (what the server uses), or null when the area has no doc yet. */
  readonly status: LaunchAreaStatus | null;
  /** The status in areas.json, or null for a doc whose area is no longer in the file. */
  readonly configStatus: LaunchAreaStatus | null;
  readonly waitlistCount: number;
  readonly goal: number | null;
  readonly profile: string;
  readonly configVersion: number | null;
}

export async function listAreas(db: Firestore): Promise<AreaRow[]> {
  const snap = await db.collection(AREAS).select('label', 'status', 'waitlistCount', 'goal', 'profile', 'configVersion').get();
  const byId = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const ids = [...new Set([...LAUNCH_AREAS.map((a) => a.id), ...byId.keys()])].sort();
  return ids.map((areaId) => {
    const config = getLaunchArea(areaId);
    const doc = byId.get(areaId) as Record<string, unknown> | undefined;
    const status = typeof doc?.status === 'string' && (LAUNCH_AREA_STATUSES as readonly string[]).includes(doc.status) ? (doc.status as LaunchAreaStatus) : null;
    const goal = (doc?.goal as { waitlist?: unknown } | undefined)?.waitlist;
    return {
      areaId,
      label: config?.label.en ?? ((doc?.label as { en?: string } | undefined)?.en ?? areaId),
      status,
      configStatus: config?.status ?? null,
      waitlistCount: typeof doc?.waitlistCount === 'number' ? doc.waitlistCount : 0,
      goal: typeof goal === 'number' ? goal : (config?.goal.waitlist ?? null),
      profile: typeof doc?.profile === 'string' ? doc.profile : (config?.profile ?? '-'),
      configVersion: typeof doc?.configVersion === 'number' ? doc.configVersion : null,
    };
  });
}

export function formatAreas(rows: readonly AreaRow[]): string {
  const body = table(
    ['area', 'label', 'status', 'areas.json', 'waitlist', 'goal', 'profile', 'config v'],
    rows.map((r) => [
      r.areaId,
      r.label,
      r.status ?? '(no doc)',
      r.configStatus ?? '(not in file)',
      waitlistDisplay(r.waitlistCount),
      r.goal ?? '-',
      r.profile,
      r.configVersion ?? '-',
    ]),
    4,
  );
  const drift = rows.filter((r) => r.status !== null && r.configStatus !== null && r.status !== r.configStatus);
  const notes = drift.map((r) => `note: ${r.areaId} is "${r.status}" in Firestore but "${r.configStatus}" in areas.json; the server uses Firestore.`);
  return [body, '', 'Waitlist counts under 10 are shown as "<10".', ...notes].join('\n');
}

export interface SetStatusResult {
  readonly areaId: string;
  readonly previous: LaunchAreaStatus | null;
  readonly status: LaunchAreaStatus;
  readonly created: boolean;
  readonly openArea: EnqueueOutcome | null;
  readonly configStatus: LaunchAreaStatus;
}

/**
 * Sets `areas/{areaId}.status` (creating the doc from areas.json if no one has onboarded there yet) and, for `live`,
 * enqueues `openArea` with id `open-{areaId}`. Setting `live` again re-enqueues, which is safe: openArea marks and
 * notifies nobody twice (F34).
 */
export async function setAreaStatus(ctx: AdminContext, areaId: string, status: LaunchAreaStatus, reason: string): Promise<SetStatusResult> {
  const area = requireLaunchArea(areaId);
  const db = ctx.db();
  return recorded(ctx, db, { command: 'areas set-status', target: areaId, reason }, async () => {
    const ref = db.collection(AREAS).doc(areaId);
    const { previous, created } = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        tx.create(ref, areaDocFromConfig(area, 0, status));
        return { previous: null, created: true };
      }
      const prev = snap.get('status') as LaunchAreaStatus | undefined;
      if (prev !== status) tx.update(ref, { status });
      return { previous: prev ?? null, created: false };
    });
    const openArea = status === 'live' ? await ctx.tasks.openArea(areaId) : null;
    const value: SetStatusResult = { areaId, previous, status, created, openArea, configStatus: area.status };
    return { value, outcome: previous === status ? 'unchanged' : 'changed', details: { previous: previous ?? 'none', status, openArea: openArea ?? 'none' } };
  });
}

export function formatSetStatus(r: SetStatusResult): string {
  const lines = [
    r.created
      ? `areas/${r.areaId}: created from areas.json with status "${r.status}"`
      : r.previous === r.status
        ? `areas/${r.areaId}: status already "${r.status}"`
        : `areas/${r.areaId}: status "${r.previous ?? 'unset'}" -> "${r.status}"`,
  ];
  if (r.openArea === 'enqueued') lines.push(`openArea enqueued (task open-${r.areaId}): everyone in ${r.areaId} becomes eligible for the next drop and gets the "is open" push.`);
  if (r.openArea === 'alreadyQueued') lines.push(`openArea task open-${r.areaId} already exists (queued or recently run); openArea is idempotent, nothing was enqueued.`);
  if (r.configStatus !== r.status) {
    lines.push(
      `note: packages/core/src/geo/areas.json still lists ${r.areaId} as "${r.configStatus}". Set it to "${r.status}" in git too, so the repository stays the record of the launch-area config (§13) and new environments start from it.`,
    );
  }
  return lines.join('\n');
}

export interface SyncResult {
  readonly created: readonly string[];
  readonly updated: readonly string[];
  readonly statusDrift: readonly { areaId: string; doc: LaunchAreaStatus; file: LaunchAreaStatus }[];
}

/**
 * Mirrors areas.json to `areas/{areaId}`: label, profile, goal and config version. A missing doc is created with the
 * file's status. An existing doc keeps its status (a go-live is `areas set-status`), its exact `waitlistCount` (kept
 * by the server in the onboarding transactions) and its chips (written by dropOrchestrator).
 */
export async function syncAreas(ctx: AdminContext, reason: string): Promise<SyncResult> {
  const db = ctx.db();
  return recorded(ctx, db, { command: 'areas sync', reason }, async () => {
    const created: string[] = [];
    const updated: string[] = [];
    const statusDrift: { areaId: string; doc: LaunchAreaStatus; file: LaunchAreaStatus }[] = [];
    for (const area of LAUNCH_AREAS) {
      const ref = db.collection(AREAS).doc(area.id);
      // Transactions may retry: collect results from the returned value, not inside the callback.
      const r = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const doc = areaDocFromConfig(area, 0);
        if (!snap.exists) {
          tx.create(ref, doc);
          return { created: true, current: undefined };
        }
        tx.update(ref, { label: doc.label, profile: doc.profile, goal: doc.goal, configVersion: doc.configVersion });
        return { created: false, current: snap.get('status') as LaunchAreaStatus | undefined };
      });
      (r.created ? created : updated).push(area.id);
      if (r.current && r.current !== area.status) statusDrift.push({ areaId: area.id, doc: r.current, file: area.status });
    }
    return { value: { created, updated, statusDrift }, outcome: 'synced', details: { created: created.length, updated: updated.length } };
  });
}

export function formatSync(r: SyncResult): string {
  return [
    `created: ${r.created.length === 0 ? '-' : r.created.join(', ')}`,
    `updated: ${r.updated.length === 0 ? '-' : r.updated.join(', ')}`,
    ...r.statusDrift.map((d) => `note: ${d.areaId} kept status "${d.doc}" (areas.json says "${d.file}"); use areas set-status to change it.`),
  ].join('\n');
}
