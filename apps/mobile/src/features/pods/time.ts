/**
 * Meetup and deadline times on the pod screens, in Europe/Copenhagen like every drop, deadline and meetup (§4.1):
 * "Saturday 14 Nov, 14:00" / "Lørdag 14. nov. kl. 14.00", "Tuesday 18:00" / "tirsdag kl. 18.00", and "tomorrow at
 * 14:00" / "i morgen kl. 14.00". The words around the parts come from the language files (`plan.when` and friends),
 * so each language orders them its own way.
 */
import { DAY_MS, DROP_TIME_ZONE, toLocal, type Locale } from '@grouper/core';
import type { TFunction } from 'i18next';

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

const pad = (n: number) => String(n).padStart(2, '0');

/** Clock time: "14:00" in English, "14.00" in Danish. */
export function clock(ms: number, locale: Locale): string {
  const { hour, minute } = toLocal(ms);
  return `${pad(hour)}${locale === 'da' ? '.' : ':'}${pad(minute)}`;
}

/** "Saturday" / "lørdag" (or "Sat" / "lør."). */
export function weekday(ms: number, locale: Locale, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday: style, timeZone: DROP_TIME_ZONE }).format(new Date(ms));
}

/** First letter upper case ("lørdag" → "Lørdag") for a date that starts a line. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/** "Saturday 14 Nov" / "lørdag 14. nov.". */
export function dayDate(ms: number, locale: Locale): string {
  const month = new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: 'short', timeZone: DROP_TIME_ZONE }).format(new Date(ms));
  const { day } = toLocal(ms);
  return locale === 'da' ? `${weekday(ms, locale)} ${day}. ${month}` : `${weekday(ms, locale)} ${day} ${month}`;
}

/** Whole calendar days from `now` to `ms` in Copenhagen: 0 today, 1 tomorrow, -1 yesterday. */
export function daysFromToday(ms: number, now: number): number {
  const a = toLocal(now);
  const b = toLocal(ms);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS);
}

/** A meetup or option time as a card title: "Saturday 14 Nov, 14:00" / "Lørdag 14. nov. kl. 14.00". */
export function meetupWhen(t: TFunction, ms: number, locale: Locale): string {
  return t('plan.when', { date: capitalize(dayDate(ms, locale)), time: clock(ms, locale) });
}

/** A deadline or window edge within the coming week: "Tuesday 18:00" / "tirsdag kl. 18.00". */
export function weekdayAt(t: TFunction, ms: number, locale: Locale): string {
  return t('plan.weekdayAt', { day: weekday(ms, locale), time: clock(ms, locale) });
}

/**
 * The meetup relative to today, for "Still coming …?": "today at 14:00", "tomorrow at 14:00", "on Saturday at 14:00"
 * (and "i dag kl. 14.00", "i morgen kl. 14.00", "lørdag kl. 14.00"). The ask comes at most 3 days ahead, so a weekday
 * is never ambiguous; anything further out gets the date.
 */
export function relativeMeetup(t: TFunction, ms: number, now: number, locale: Locale): string {
  const days = daysFromToday(ms, now);
  const time = clock(ms, locale);
  if (days === 0) return t('attendance.relative.today', { time });
  if (days === 1) return t('attendance.relative.tomorrow', { time });
  if (days > 1 && days < 7) return t('attendance.relative.weekday', { day: weekday(ms, locale), time });
  return t('attendance.relative.date', { date: dayDate(ms, locale), time });
}

/** A chat message's time: "13:41" today, "Fri 15:02" / "fre. 15.02" on another day (the window spans about two days). */
export function messageTime(ms: number, now: number, locale: Locale): string {
  const time = clock(ms, locale);
  return daysFromToday(ms, now) === 0 ? time : `${weekday(ms, locale, 'short')} ${time}`;
}

/** A day on a picker: "Sun 15 Nov" / "søn. 15. nov.". */
export function shortDayDate(ms: number, locale: Locale): string {
  const month = new Intl.DateTimeFormat(LOCALE_TAG[locale], { month: 'short', timeZone: DROP_TIME_ZONE }).format(new Date(ms));
  const { day } = toLocal(ms);
  return locale === 'da' ? `${weekday(ms, locale, 'short')} ${day}. ${month}` : `${weekday(ms, locale, 'short')} ${day} ${month}`;
}

/** A picker time "HH:MM" as people read it: "15:00" in English, "15.00" in Danish. */
export function slotClock(time: string, locale: Locale): string {
  return locale === 'da' ? time.replace(':', '.') : time;
}
