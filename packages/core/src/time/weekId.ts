import type { WeekId } from '../types/ids';
import { DROP_TIME_ZONE, toLocal } from './zone';

const DAY_MS = 86_400_000;
export const WEEK_ID_PATTERN = /^(\d{4})-W(\d{2})$/;

export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const epochDay = (d: CivilDate): number => Math.floor(Date.UTC(d.year, d.month - 1, d.day) / DAY_MS);

function civilFromEpochDay(days: number): CivilDate {
  const d = new Date(days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** ISO weekday, Monday = 1 … Sunday = 7. */
export function isoWeekday(d: CivilDate): number {
  return ((((epochDay(d) + 3) % 7) + 7) % 7) + 1;
}

export function isoWeeksInYear(year: number): 52 | 53 {
  // A year has 53 ISO weeks exactly when 28 December falls in week 53.
  const dec28 = { year, month: 12, day: 28 };
  const thursday = epochDay(dec28) - isoWeekday(dec28) + 4;
  const jan1 = epochDay({ year: civilFromEpochDay(thursday).year, month: 1, day: 1 });
  return Math.floor((thursday - jan1) / 7) + 1 === 53 ? 53 : 52;
}

export function formatWeekId(year: number, week: number): WeekId {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new RangeError('weekId: year out of range');
  if (!Number.isInteger(week) || week < 1 || week > isoWeeksInYear(year)) throw new RangeError('weekId: week out of range');
  return `${year}-W${String(week).padStart(2, '0')}` as WeekId;
}

export function isWeekId(value: string): value is WeekId {
  const m = WEEK_ID_PATTERN.exec(value);
  if (!m) return false;
  const week = Number(m[2]);
  return week >= 1 && week <= isoWeeksInYear(Number(m[1]));
}

export function parseWeekId(weekId: string): { readonly year: number; readonly week: number } {
  if (!isWeekId(weekId)) throw new RangeError(`invalid weekId: ${weekId}`);
  const m = WEEK_ID_PATTERN.exec(weekId)!;
  return { year: Number(m[1]), week: Number(m[2]) };
}

export function isoWeekOfDate(d: CivilDate): WeekId {
  const thursday = epochDay(d) - isoWeekday(d) + 4;
  const isoYear = civilFromEpochDay(thursday).year;
  const week = Math.floor((thursday - epochDay({ year: isoYear, month: 1, day: 1 })) / 7) + 1;
  return formatWeekId(isoYear, week);
}

/** ISO week of an instant, using the calendar date in Europe/Copenhagen. */
export function weekIdAt(instantMs: number, timeZone: string = DROP_TIME_ZONE): WeekId {
  const l = toLocal(instantMs, timeZone);
  return isoWeekOfDate({ year: l.year, month: l.month, day: l.day });
}

/** Calendar date of a weekday (1 = Monday) in an ISO week. */
export function dateInWeek(weekId: WeekId, isoDay: number): CivilDate {
  const { year, week } = parseWeekId(weekId);
  const jan4 = { year, month: 1, day: 4 };
  const mondayW1 = epochDay(jan4) - isoWeekday(jan4) + 1;
  return civilFromEpochDay(mondayW1 + (week - 1) * 7 + (isoDay - 1));
}

export function addWeeks(weekId: WeekId, n: number): WeekId {
  const monday = dateInWeek(weekId, 1);
  return isoWeekOfDate(civilFromEpochDay(epochDay(monday) + n * 7));
}

/** Whole weeks from `from` to `to` (negative if `to` is earlier). */
export function weeksBetween(from: WeekId, to: WeekId): number {
  return Math.round((epochDay(dateInWeek(to, 1)) - epochDay(dateInWeek(from, 1))) / 7);
}

/** Week ids sort lexicographically because the format is zero-padded. */
export function compareWeekIds(a: WeekId, b: WeekId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
