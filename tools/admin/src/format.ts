/** Plain-text tables for the admin CLI. The first `leftColumns` columns are left-aligned, the rest right-aligned. */
export function table(header: readonly string[], rows: readonly (readonly (string | number)[])[], leftColumns = 2): string {
  const cells = [header, ...rows.map((r) => r.map(String))];
  const widths = header.map((_, c) => Math.max(...cells.map((r) => (r[c] ?? '').length)));
  const line = (r: readonly string[]) =>
    r
      .map((v, c) => (c < leftColumns ? v.padEnd(widths[c]!) : v.padStart(widths[c]!)))
      .join('  ')
      .trimEnd();
  return [line(cells[0]!), widths.map((w) => '-'.repeat(w)).join('  '), ...cells.slice(1).map(line)].join('\n');
}

/** A Firestore Timestamp (or anything with toMillis) as an ISO instant, or "-". */
export function isoOf(value: unknown): string {
  if (typeof value === 'object' && value !== null && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return new Date((value as { toMillis(): number }).toMillis()).toISOString();
  }
  return '-';
}

export function millisOf(value: unknown): number | null {
  if (typeof value === 'object' && value !== null && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis(): number }).toMillis();
  }
  return null;
}
