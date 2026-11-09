/**
 * Captures every console line (firebase-functions' logger writes through console) so tests can assert that no
 * request data, tag text, name, email, token or raw uid reaches the logs (DESIGN.md §13 "logs" test layer).
 * State lives on globalThis because firebase-functions keeps the console functions it saw at load time.
 */
interface Capture {
  readonly lines: string[];
  forbidden: string[];
}

const KEY = Symbol.for('friendpod.functions.logCapture');
const g = globalThis as unknown as Record<symbol, Capture | undefined>;

export function capture(): Capture {
  g[KEY] ??= { lines: [], forbidden: [] };
  return g[KEY];
}

export function capturedLogs(): readonly string[] {
  return capture().lines;
}

/** Parsed JSON log entries (the structured logger writes one JSON object per line). */
export function capturedEntries(): Record<string, unknown>[] {
  return capture().lines.flatMap((line) => {
    try {
      const v: unknown = JSON.parse(line);
      return typeof v === 'object' && v !== null ? [v as Record<string, unknown>] : [];
    } catch {
      return [];
    }
  });
}

/** Values that must not appear in any log line written during the current test (checked in afterEach). */
export function forbidInLogs(...values: string[]): void {
  capture().forbidden.push(...values.filter((v) => v.length > 0));
}

export function leakedValues(): string[] {
  const all = capture().lines.join('\n').toLowerCase();
  return capture().forbidden.filter((v) => all.includes(v.toLowerCase()));
}
