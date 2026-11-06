/**
 * A fixed "now" for the preview: `Date.now()` and `new Date()` start at the scenario's instant and then advance in
 * real time, so countdowns and "Thursday 18:00" read the same on every run while timers still work. Preview only.
 */
const RealDate = Date;

export function installClock(startMs: number): void {
  const offset = startMs - RealDate.now();
  const now = () => RealDate.now() + offset;

  function PreviewDate(this: unknown, ...args: unknown[]): Date | string {
    // `Date()` called without `new` returns a string.
    if (!new.target) return new RealDate(now()).toString();
    return Reflect.construct(RealDate, args.length === 0 ? [now()] : args, new.target) as Date;
  }
  PreviewDate.prototype = RealDate.prototype;
  Object.setPrototypeOf(PreviewDate, RealDate);
  Object.defineProperty(PreviewDate, 'now', { value: now, writable: true, configurable: true });
  Object.defineProperty(PreviewDate, 'parse', { value: RealDate.parse, writable: true, configurable: true });
  Object.defineProperty(PreviewDate, 'UTC', { value: RealDate.UTC, writable: true, configurable: true });

  (globalThis as { Date: DateConstructor }).Date = PreviewDate as unknown as DateConstructor;
}

/** Parses a scenario's `now` (ISO string with offset, or epoch ms). */
export function parseNow(value: string | number): number {
  const ms = typeof value === 'number' ? value : RealDate.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`preview: invalid scenario now "${String(value)}"`);
  return ms;
}
