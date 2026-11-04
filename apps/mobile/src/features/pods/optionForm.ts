import { DAY_MS, containsPii, fromLocal, httpsUrlSchema, MAP_URL_HOSTS, urlHost, ymdDateSchema } from '@grouper/core';

/** Planner limits (§3.5, §4.3): within 14 days, 08:00–22:00 local time, place ≤ 120 characters. */
export const OPTION_WINDOW_DAYS = 14;
export const PLACE_MAX = 120;

export type OptionFormError = 'DATE' | 'WINDOW' | 'PLACE' | 'CONTACT_INFO' | 'URL' | 'PUBLIC_PLACE';

export interface OptionFormValues {
  readonly date: string;
  readonly time: string;
  readonly placeText: string;
  readonly mapUrl: string;
  readonly publicPlace: boolean;
}

export type OptionFormResult =
  | { readonly ok: true; readonly startsAt: number; readonly placeText: string; readonly mapUrl: string | null }
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
  const placeText = v.placeText.trim();
  if (placeText.length === 0 || placeText.length > PLACE_MAX) return { ok: false, error: 'PLACE' };
  if (containsPii(placeText)) return { ok: false, error: 'CONTACT_INFO' };
  const mapUrl = v.mapUrl.trim();
  if (mapUrl.length > 0) {
    const host = httpsUrlSchema.safeParse(mapUrl).success ? urlHost(mapUrl) : null;
    if (!host || !(MAP_URL_HOSTS as readonly string[]).includes(host)) return { ok: false, error: 'URL' };
  }
  if (!v.publicPlace) return { ok: false, error: 'PUBLIC_PLACE' };
  return { ok: true, startsAt, placeText, mapUrl: mapUrl.length > 0 ? mapUrl : null };
}
