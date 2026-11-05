/** All product times are wall-clock times in this zone (§4.1). */
export const DROP_TIME_ZONE = 'Europe/Copenhagen';

export interface LocalDateTime {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields of an instant in `timeZone` (tzdata via Intl, so a future EU DST change is picked up). */
export function toLocal(instantMs: number, timeZone: string = DROP_TIME_ZONE): LocalDateTime & { readonly second: number } {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
  };
}

function offsetMs(instantMs: number, timeZone: string): number {
  const l = toLocal(instantMs, timeZone);
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, l.hour, l.minute, l.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The instant at which `timeZone` shows `local`. A wall time inside a spring-forward gap is shifted
 * forward by the gap; an ambiguous autumn time resolves to one of its two instants. Drop-schedule
 * times (10:00–18:00) never hit either case.
 */
export function fromLocal(local: LocalDateTime, timeZone: string = DROP_TIME_ZONE): number {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const o1 = offsetMs(naive, timeZone);
  const guess = naive - o1;
  const o2 = offsetMs(guess, timeZone);
  if (o1 === o2) return guess;
  const o3 = offsetMs(naive - o2, timeZone);
  return o2 === o3 ? naive - o2 : naive - Math.min(o2, o3);
}
