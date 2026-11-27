/** "MIN_AGE: integer = 18" */
export const MIN_AGE = 18;

/** "MAX_PLAUSIBLE_AGE: integer = 120" */
export const MAX_PLAUSIBLE_AGE = 120;

const NAME_START = /^[\p{L}\p{M}]/u;
const NAME_CHARS = /^[\p{L}\p{M} '’.-]+$/u;
const DIGITS = /^[0-9]+$/;

/**
 * "The first name as it is kept: Unicode NFC, each run of white space made one space, trimmed at both ends.
 * It is something only when that has at least 1 character, starts with a letter or a combining mark, and
 * holds only letters, combining marks, spaces, apostrophes (' and ’), full stops and hyphens. There is no
 * upper limit on its length."
 */
export function firstNameFrom(typed: string): string | null {
  const kept = typed.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (kept.length < 1) {
    return null;
  }
  if (!NAME_START.test(kept) || !NAME_CHARS.test(kept)) {
    return null;
  }
  return kept;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * "The birth date as "YYYY-MM-DD", or nothing. Nothing until all three are typed and the year has exactly four
 * characters. Then day and month are padded with zeros to two characters, and the result is a birth date only
 * when it is a real calendar date."
 */
export function birthDateFrom(day: string, month: string, year: string): string | null {
  if (day.length === 0 || month.length === 0 || year.length !== 4) {
    return null;
  }
  const dd = day.padStart(2, '0');
  const mm = month.padStart(2, '0');
  if (dd.length !== 2 || mm.length !== 2 || !DIGITS.test(dd) || !DIGITS.test(mm) || !DIGITS.test(year)) {
    return null;
  }
  const y = Number(year);
  const m = Number(mm);
  const d = Number(dd);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    return null;
  }
  return `${year}-${mm}-${dd}`;
}

function partsOf(birthDate: string): { year: number; month: number; day: number } {
  const parts = birthDate.split('-');
  return {
    year: Number(parts[0] ?? Number.NaN),
    month: Number(parts[1] ?? Number.NaN),
    day: Number(parts[2] ?? Number.NaN),
  };
}

/**
 * "Whole years from birthDate to today, in today's own calendar day: one less when today's month and day
 * come before the birthday's."
 */
export function ageOn(birthDate: string, today: Date): number {
  const birth = partsOf(birthDate);
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const beforeBirthday = todayMonth < birth.month || (todayMonth === birth.month && todayDay < birth.day);
  return today.getFullYear() - birth.year - (beforeBirthday ? 1 : 0);
}

/** "isAdult(birthDate: text, today: time) -> boolean — ageOn(birthDate, today) ≥ MIN_AGE" */
export function isAdult(birthDate: string, today: Date): boolean {
  return ageOn(birthDate, today) >= MIN_AGE;
}

/**
 * "True when birthDate is not after today's calendar day and ageOn(birthDate, today) ≤ MAX_PLAUSIBLE_AGE."
 */
export function isPlausible(birthDate: string, today: Date): boolean {
  const birth = partsOf(birthDate);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const afterToday =
    birth.year > todayYear ||
    (birth.year === todayYear && (birth.month > todayMonth || (birth.month === todayMonth && birth.day > todayDay)));
  return !afterToday && ageOn(birthDate, today) <= MAX_PLAUSIBLE_AGE;
}
