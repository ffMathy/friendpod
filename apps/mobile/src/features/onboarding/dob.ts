import { MIN_AGE, ymdDateSchema } from '@grouper/core';

/** `YYYY-MM-DD` from three fields, or null if it is not a real date. */
export function composeDob(year: string, month: string, day: string): string | null {
  const value = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  return ymdDateSchema.safeParse(value).success ? value : null;
}

/** Age on `today`; the server repeats this check and is authoritative (§3.1 step 6). */
export function ageOn(dob: string, today: Date): number {
  const [y, m, d] = dob.split('-').map(Number) as [number, number, number];
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

export const isAdult = (dob: string, today: Date): boolean => ageOn(dob, today) >= MIN_AGE;
