/** "MIN_AGE: integer = 18" */
export const MIN_AGE = 18;

/** "MAX_PLAUSIBLE_AGE: integer = 120" */
export const MAX_PLAUSIBLE_AGE = 120;

const FIRST_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]*$/u;

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function dateParts(birthDate: string): { year: number; month: number; day: number } {
  return {
    year: Number(birthDate.slice(0, 4)),
    month: Number(birthDate.slice(5, 7)),
    day: Number(birthDate.slice(8, 10)),
  };
}

/**
 * "The first name as it is kept: Unicode NFC, each run of white space made one space, trimmed at both ends.
 * It is something only when that has at least 1 character, starts with a letter or a combining mark, and
 * holds only letters, combining marks, spaces, apostrophes (' and ’), full stops and hyphens. There is no
 * upper limit on its length."
 */
export function firstNameFrom(typed: string): string | null {
  const name = typed.normalize('NFC').replace(/\s+/gu, ' ').trim();
  if (name.length < 1 || !FIRST_NAME_PATTERN.test(name)) {
    return null;
  }
  return name;
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
  const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (!BIRTH_DATE_PATTERN.test(birthDate)) {
    return null;
  }
  const parts = dateParts(birthDate);
  if (parts.month < 1 || parts.month > 12) {
    return null;
  }
  if (parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) {
    return null;
  }
  return birthDate;
}

/**
 * "Whole years from birthDate to today, in today's own calendar day: one less when today's month and day
 * come before the birthday's."
 */
export function ageOn(birthDate: string, today: Date): number {
  const birth = dateParts(birthDate);
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const age = today.getFullYear() - birth.year;
  if (todayMonth < birth.month || (todayMonth === birth.month && todayDay < birth.day)) {
    return age - 1;
  }
  return age;
}

/** "isAdult(birthDate: text, today: time) -> boolean — ageOn(birthDate, today) ≥ MIN_AGE" */
export function isAdult(birthDate: string, today: Date): boolean {
  return ageOn(birthDate, today) >= MIN_AGE;
}

/** "True when birthDate is not after today's calendar day and ageOn(birthDate, today) ≤ MAX_PLAUSIBLE_AGE." */
export function isPlausible(birthDate: string, today: Date): boolean {
  const birth = dateParts(birthDate);
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const isAfterToday =
    birth.year > todayYear ||
    (birth.year === todayYear && birth.month > todayMonth) ||
    (birth.year === todayYear && birth.month === todayMonth && birth.day > todayDay);
  return !isAfterToday && ageOn(birthDate, today) <= MAX_PLAUSIBLE_AGE;
}
