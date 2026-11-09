/**
 * Times on the home tab and the drop cards, in Europe/Copenhagen like every drop and deadline (§4.1): the week
 * number, "Thursday 18:00", "Sat 18:00" and the countdown "in 2 days and 6 hours".
 */
import { DROP_TIME_ZONE, parseWeekId, toLocal, weekIdAt, type Locale } from '@friendpod/core';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

/** The ISO week number of `ms` ("Week 46"). */
export function weekNumber(ms: number): number {
  return parseWeekId(weekIdAt(ms)).week;
}

/** Clock time: "18:00" in English, "18.00" in Danish. */
export function clock(ms: number, locale: Locale): string {
  const { hour, minute } = toLocal(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hour)}${locale === 'da' ? '.' : ':'}${pad(minute)}`;
}

/** The weekday ("Thursday" / "torsdag", or "Thu" / "tor."). */
export function weekday(ms: number, locale: Locale, style: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday: style, timeZone: DROP_TIME_ZONE }).format(new Date(ms));
}

/** "Sat 21 Nov" / "lør. 21. nov.": a day further out than the coming week. */
export function shortDate(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday: 'short', day: 'numeric', month: 'short', timeZone: DROP_TIME_ZONE }).format(new Date(ms));
}

/**
 * A deadline's parameters: the short weekday without its abbreviation dot ("Sat", "lør") and the clock time. The
 * wording adds the dot where the language wants one: "Answer by Sat 18:00", "Svar senest lør. kl. 18.00".
 */
export function dayTime(ms: number, locale: Locale): { dayShort: string; time: string } {
  return { dayShort: weekday(ms, locale, 'short').replace(/\.$/, ''), time: clock(ms, locale) };
}

/** First letter upper case ("torsdag" → "Torsdag") for a weekday that starts a line. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

/** "in 2 days and 6 hours", "in 5 hours and 20 minutes", "in 12 minutes"; "any minute now" once it is due. */
export function countdown(t: TFunction, from: number, to: number): string {
  // Rounded up to the minute, so Tuesday 12:00:20 still reads "in 2 days and 6 hours" to Thursday 18:00.
  const minutes = Math.ceil((to - from) / 60_000);
  if (minutes < 1) return t('home.countdown.soon');
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const part = (unit: 'days' | 'hours' | 'minutes', count: number) => t(`home.countdown.${unit}`, { count });
  if (days > 0) {
    return t('home.countdown.in', { span: hours > 0 ? t('home.countdown.and', { a: part('days', days), b: part('hours', hours) }) : part('days', days) });
  }
  if (hours > 0) {
    return t('home.countdown.in', { span: mins > 0 ? t('home.countdown.and', { a: part('hours', hours), b: part('minutes', mins) }) : part('hours', hours) });
  }
  return t('home.countdown.in', { span: part('minutes', mins) });
}

/** The current time, updated every 30 seconds while mounted (for the countdown and "this week"). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
