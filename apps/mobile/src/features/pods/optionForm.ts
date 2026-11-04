import { DAY_MS, fromLocal, ymdDateSchema, type Place } from '@grouper/core';

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
