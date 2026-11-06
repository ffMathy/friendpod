import { DAY_MS, fromLocal, toLocal, ymdDateSchema, type Place } from '@grouper/core';

/** Planner limits (§3.5, §4.3): within 14 days, 08:00–22:00 local time. */
export const OPTION_WINDOW_DAYS = 14;

export type OptionFormError = 'DATE' | 'WINDOW' | 'PLACE';

export interface OptionFormValues {
  readonly date: string;
  readonly time: string;
  /** Picked from Google Places (D8); there is no free-text place. */
  readonly place: Place | null;
}

export type OptionFormResult =
  | { readonly ok: true; readonly startsAt: number; readonly place: Place }
  | { readonly ok: false; readonly error: OptionFormError };

/** Mirrors the server's checks so most mistakes are caught before sending; the server decides. */
export function validateOptionForm(v: OptionFormValues, now: number): OptionFormResult {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(v.time.trim());
  if (!d || !tm || !ymdDateSchema.safeParse(v.date.trim()).success) return { ok: false, error: 'DATE' };
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) return { ok: false, error: 'DATE' };
  const startsAt = fromLocal({ year: Number(d[1]), month: Number(d[2]), day: Number(d[3]), hour, minute });
  if (!Number.isFinite(startsAt)) return { ok: false, error: 'DATE' };
  const inHours = hour >= 8 && (hour < 22 || (hour === 22 && minute === 0));
  if (startsAt <= now || startsAt > now + OPTION_WINDOW_DAYS * DAY_MS || !inHours) return { ok: false, error: 'WINDOW' };
  if (!v.place) return { ok: false, error: 'PLACE' };
  return { ok: true, startsAt, place: v.place };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The times "Suggest a time" offers: every half hour from 08:00 to 22:00 ("HH:MM", Copenhagen time). */
export const OPTION_TIME_SLOTS: readonly string[] = Array.from({ length: 29 }, (_, i) => `${pad(8 + Math.floor(i / 2))}:${i % 2 === 1 ? '30' : '00'}`);

/** "2026-11-15" and "15:00" as a moment, in Copenhagen time. */
export function slotStartsAt(date: string, time: string): number {
  const [year = 0, month = 0, day = 0] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  return fromLocal({ year, month, day, hour, minute });
}

/** Whether a day and time can still be suggested: later than now and within the 14-day window. */
export function slotOpen(date: string, time: string, now: number): boolean {
  const at = slotStartsAt(date, time);
  return at > now && at <= now + OPTION_WINDOW_DAYS * DAY_MS;
}

/** The days with at least one open time, from today (if it still has one) to 14 days ahead, as "YYYY-MM-DD". */
export function optionDays(now: number): string[] {
  const today = toLocal(now);
  const days: string[] = [];
  for (let i = 0; i <= OPTION_WINDOW_DAYS; i += 1) {
    const d = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    if (OPTION_TIME_SLOTS.some((time) => slotOpen(ymd, time, now))) days.push(ymd);
  }
  return days;
}
