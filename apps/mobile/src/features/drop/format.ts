import { DROP_TIME_ZONE, parseWeekId, weekIdAt, type Locale } from '@grouper/core';
import type { TFunction } from 'i18next';

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

/**
 * Weekday and clock time in Europe/Copenhagen ("Thursday 18:00", "Sat 18:00"; "torsdag 18.00"), for times within the
 * coming week: the next drop and a proposal's answer deadline (storyboards 2.1, 2.2).
 */
export function formatWeekdayTime(ms: number, locale: Locale, weekday: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { weekday, hour: '2-digit', minute: '2-digit', timeZone: DROP_TIME_ZONE }).format(new Date(ms));
}

/** First letter upper-cased, for a formatted date that starts a line ("torsdag 18.00" → "Torsdag 18.00"). */
export function capitalize(text: string): string {
  return text.length > 0 ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text;
}

/** The ISO week number shown next to the screen title ("Week 46"). */
export function weekNumber(now: number): number {
  return parseWeekId(weekIdAt(now)).week;
}

/** "in 2 days and 6 hours", "in 5 hours", "in 12 minutes": the time until `at`, rounded down. */
export function countdown(t: TFunction, at: number, now: number): string {
  const totalMinutes = Math.max(1, Math.floor((at - now) / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  let time: string;
  if (days > 0) {
    const d = t('home.countdown.days', { count: days });
    time = hours > 0 ? t('home.countdown.daysHours', { days: d, hours: t('home.countdown.hours', { count: hours }) }) : d;
  } else if (hours > 0) {
    time = t('home.countdown.hours', { count: hours });
  } else {
    time = t('home.countdown.minutes', { count: totalMinutes });
  }
  return t('home.countdown.in', { time });
}
