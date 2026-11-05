/**
 * `funnel show` (DESIGN.md §6.8, PRIVACY.md P18): prints the day-1 funnel per launch area and ISO week as a table.
 * The counters in `funnel/{areaId}_{weekId}` are exact and uid-free; every cell under 10 is printed as "<10" here, so
 * the CLI never shows a small count. Until the CLI gets its Firebase dependency (M1) it reads an export of the
 * collection (`--from <file.json>`: an array of funnel docs, or an object of them keyed by doc id).
 */
import { FUNNEL_STAGES, HEARD_FROM_SOURCES, suppressFunnelCounts, suppressSourceCounts, type FunnelStage, type HeardFromSource } from '@grouper/core';

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

function table(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const cells = [header, ...rows.map((r) => r.map(String))];
  const widths = header.map((_, c) => Math.max(...cells.map((r) => r[c]!.length)));
  const line = (r: readonly string[]) => r.map((v, c) => (c < 2 ? v.padEnd(widths[c]!) : v.padStart(widths[c]!))).join('  ');
  return [line(cells[0]!), widths.map((w) => '-'.repeat(w)).join('  '), ...cells.slice(1).map(line)].join('\n');
}

/** The funnel table and the "where did you hear" table, every cell under 10 suppressed. */
export function formatFunnel(rows: readonly FunnelRow[], filter: { areaId?: string } = {}): string {
  const selected = rows
    .filter((r) => filter.areaId === undefined || r.areaId === filter.areaId)
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
  return `${stages}\n\nWhere did you hear about Grouper?\n${sources}\n\nCells under 10 are shown as "<10" (DESIGN.md §6.6).`;
}
