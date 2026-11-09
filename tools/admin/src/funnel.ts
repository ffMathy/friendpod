/**
 * `funnel show` (DESIGN.md §6.8, PRIVACY.md P18): prints the day-1 funnel per launch area and ISO week as a table.
 * The counters in `funnel/{areaId}_{weekId}` are exact and uid-free; every cell under 10 is printed as "<10" here, so
 * the CLI never shows a small count. It reads the collection live (`--project`), or an export of it
 * (`--from <file.json>`: an array of funnel docs, or an object of them keyed by doc id).
 */
import {
  addWeeks,
  compareWeekIds,
  FUNNEL_STAGES,
  HEARD_FROM_SOURCES,
  suppressFunnelCounts,
  suppressSourceCounts,
  weekIdAt,
  type FunnelStage,
  type HeardFromSource,
  type WeekId,
} from '@grouper/core';
import type { Firestore } from 'firebase-admin/firestore';
import { table } from './format';

export const FUNNEL = 'funnel';

export interface FunnelRow {
  readonly areaId: string;
  readonly weekId: string;
  readonly counts: Partial<Record<FunnelStage, number>>;
  readonly sources: Partial<Record<HeardFromSource, number>>;
}

const WEEK = /^\d{4}-W\d{2}$/;
const AREA = /^[a-z][a-z0-9-]{1,31}$/;

function counters<K extends string>(value: unknown, keys: readonly K[]): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const k of keys) {
    const n = (value as Record<string, unknown>)[k];
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) out[k] = n;
  }
  return out;
}

/** Parses an export; rows with an invalid area or week are refused rather than guessed. */
export function parseFunnelExport(json: unknown): FunnelRow[] {
  const items = Array.isArray(json) ? json : typeof json === 'object' && json !== null ? Object.values(json) : [];
  return items.map((item, i) => {
    const d = item as Record<string, unknown>;
    if (typeof d.areaId !== 'string' || !AREA.test(d.areaId) || typeof d.weekId !== 'string' || !WEEK.test(d.weekId)) {
      throw new Error(`funnel export: entry ${i} is not a funnel doc`);
    }
    return { areaId: d.areaId, weekId: d.weekId, counts: counters(d.counts, FUNNEL_STAGES), sources: counters(d.sources, HEARD_FROM_SOURCES) };
  });
}

/** Reads `funnel/*` (counters only; the docs hold nothing else but the TTL field). */
export async function loadFunnel(db: Firestore): Promise<FunnelRow[]> {
  const snap = await db.collection(FUNNEL).select('areaId', 'weekId', 'counts', 'sources').get();
  return parseFunnelExport(snap.docs.map((d) => d.data()));
}

/** The first week of the last `weeks` ISO weeks (Europe/Copenhagen), the current one included. */
export function firstWeekOf(weeks: number, nowMs: number): WeekId {
  return addWeeks(weekIdAt(nowMs), -(weeks - 1));
}

export interface FunnelFilter {
  readonly areaId?: string;
  /** Only weeks from this one on. */
  readonly sinceWeek?: WeekId;
}

/** The funnel table and the "where did you hear" table, every cell under 10 suppressed. */
export function formatFunnel(rows: readonly FunnelRow[], filter: FunnelFilter = {}): string {
  const selected = rows
    .filter((r) => filter.areaId === undefined || r.areaId === filter.areaId)
    .filter((r) => filter.sinceWeek === undefined || compareWeekIds(r.weekId as WeekId, filter.sinceWeek) >= 0)
    .sort((a, b) => (a.areaId < b.areaId ? -1 : a.areaId > b.areaId ? 1 : a.weekId < b.weekId ? -1 : a.weekId > b.weekId ? 1 : 0));
  if (selected.length === 0) return 'no funnel rows';
  const stages = table(
    ['area', 'week', ...FUNNEL_STAGES],
    selected.map((r) => {
      const s = suppressFunnelCounts(r.counts);
      return [r.areaId, r.weekId, ...FUNNEL_STAGES.map((k) => s[k])];
    }),
  );
  const sources = table(
    ['area', 'week', ...HEARD_FROM_SOURCES],
    selected.map((r) => {
      const s = suppressSourceCounts(r.sources);
      return [r.areaId, r.weekId, ...HEARD_FROM_SOURCES.map((k) => s[k])];
    }),
  );
  return `${stages}\n\nWhere did you hear about Friendpod?\n${sources}\n\nCells under 10 are shown as "<10" (DESIGN.md §6.6).`;
}
