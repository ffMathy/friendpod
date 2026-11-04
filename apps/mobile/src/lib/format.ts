import { DROP_TIME_ZONE, type Locale } from '@grouper/core';

const LOCALE_TAG: Record<Locale, string> = { da: 'da-DK', en: 'en-GB' };

/** Dates are shown in Europe/Copenhagen, the zone every drop and deadline is defined in (§4.1). */
export function formatDateTime(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DROP_TIME_ZONE,
  }).format(new Date(ms));
}

/** A chat message's time: weekday and clock time, enough within a window of about two days. */
export function formatMessageTime(ms: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: DROP_TIME_ZONE,
  }).format(new Date(ms));
}
