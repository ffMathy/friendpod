// ail-derived-from: AboutYouRules@5b122d0d233e39e4
import { describe, expect, test } from 'bun:test';

import {
  ageOn,
  birthDateFrom,
  firstNameFrom,
  isAdult,
  isPlausible,
} from '../../../../../packages/core/src/gen/onboarding/about-you/about-you-rules/about-you-rules';

/** 2026-11-04 19:55:00 in local time (calendar days are read in local time). */
function today(): Date {
  return new Date(2026, 10, 4, 19, 55, 0);
}

describe('AboutYouRules', () => {
  test('example 1: firstNameFrom("Emil") => "Emil"', () => {
    expect(firstNameFrom('Emil')).toBe('Emil');
  });

  test('example 2: firstNameFrom("  Emil  ") => "Emil"', () => {
    expect(firstNameFrom('  Emil  ')).toBe('Emil');
  });

  test('example 3: firstNameFrom("Emil  Bo") => "Emil Bo"', () => {
    expect(firstNameFrom('Emil  Bo')).toBe('Emil Bo');
  });

  test('example 4: firstNameFrom("Anne-Marie O’Brien") => "Anne-Marie O’Brien"', () => {
    expect(firstNameFrom('Anne-Marie O’Brien')).toBe('Anne-Marie O’Brien');
  });

  test('example 5: firstNameFrom("D\'Angelo") => "D\'Angelo"', () => {
    expect(firstNameFrom("D'Angelo")).toBe("D'Angelo");
  });

  test('example 6: firstNameFrom("Emil2") => nothing', () => {
    expect(firstNameFrom('Emil2')).toBeNull();
  });

  test('example 7: firstNameFrom("-Emil") => nothing', () => {
    expect(firstNameFrom('-Emil')).toBeNull();
  });

  test('example 8: firstNameFrom("emil@x.dk") => nothing', () => {
    expect(firstNameFrom('emil@x.dk')).toBeNull();
  });

  test('example 9: firstNameFrom(" ") => nothing', () => {
    expect(firstNameFrom(' ')).toBeNull();
  });

  test('example 10: firstNameFrom("") => nothing', () => {
    expect(firstNameFrom('')).toBeNull();
  });

  test('example 11: firstNameFrom("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") => "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"', () => {
    expect(firstNameFrom('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  test(
    'example 12: firstNameFrom("Maria Josefine Augusta Wilhelmine Charlotte") => ' +
      '"Maria Josefine Augusta Wilhelmine Charlotte"',
    () => {
      expect(firstNameFrom('Maria Josefine Augusta Wilhelmine Charlotte')).toBe(
        'Maria Josefine Augusta Wilhelmine Charlotte',
      );
    },
  );

  test('example 13: birthDateFrom("14", "3", "1991") => "1991-03-14"', () => {
    expect(birthDateFrom('14', '3', '1991')).toBe('1991-03-14');
  });

  test('example 14: birthDateFrom("29", "2", "2000") => "2000-02-29"', () => {
    expect(birthDateFrom('29', '2', '2000')).toBe('2000-02-29');
  });

  test('example 15: birthDateFrom("29", "2", "2001") => nothing', () => {
    expect(birthDateFrom('29', '2', '2001')).toBeNull();
  });

  test('example 16: birthDateFrom("31", "2", "1991") => nothing', () => {
    expect(birthDateFrom('31', '2', '1991')).toBeNull();
  });

  test('example 17: birthDateFrom("0", "1", "1990") => nothing', () => {
    expect(birthDateFrom('0', '1', '1990')).toBeNull();
  });

  test('example 18: birthDateFrom("14", "13", "1990") => nothing', () => {
    expect(birthDateFrom('14', '13', '1990')).toBeNull();
  });

  test('example 19: birthDateFrom("14", "3", "199") => nothing', () => {
    expect(birthDateFrom('14', '3', '199')).toBeNull();
  });

  test('example 20: birthDateFrom("14", "3", "0199") => "0199-03-14"', () => {
    expect(birthDateFrom('14', '3', '0199')).toBe('0199-03-14');
  });

  test('example 21: birthDateFrom("ab", "3", "1991") => nothing', () => {
    expect(birthDateFrom('ab', '3', '1991')).toBeNull();
  });

  test('example 22: birthDateFrom("", "3", "1991") => nothing', () => {
    expect(birthDateFrom('', '3', '1991')).toBeNull();
  });

  test('example 23: ageOn("2008-11-04", 2026-11-04 19:55:00) => 18', () => {
    expect(ageOn('2008-11-04', today())).toBe(18);
  });

  test('example 24: ageOn("2008-11-05", 2026-11-04 19:55:00) => 17', () => {
    expect(ageOn('2008-11-05', today())).toBe(17);
  });

  test('example 25: ageOn("1991-03-14", 2026-11-04 19:55:00) => 35', () => {
    expect(ageOn('1991-03-14', today())).toBe(35);
  });

  test('example 26: isAdult("2008-11-04", 2026-11-04 19:55:00) => true', () => {
    expect(isAdult('2008-11-04', today())).toBe(true);
  });

  test('example 27: isAdult("2008-11-05", 2026-11-04 19:55:00) => false', () => {
    expect(isAdult('2008-11-05', today())).toBe(false);
  });

  test('example 28: isPlausible("1991-03-14", 2026-11-04 19:55:00) => true', () => {
    expect(isPlausible('1991-03-14', today())).toBe(true);
  });

  test('example 29: isPlausible("2026-11-04", 2026-11-04 19:55:00) => true', () => {
    expect(isPlausible('2026-11-04', today())).toBe(true);
  });

  test('example 30: isPlausible("2026-11-05", 2026-11-04 19:55:00) => false', () => {
    expect(isPlausible('2026-11-05', today())).toBe(false);
  });

  test('example 31: isPlausible("1906-11-04", 2026-11-04 19:55:00) => true', () => {
    expect(isPlausible('1906-11-04', today())).toBe(true);
  });

  test('example 32: isPlausible("1905-11-04", 2026-11-04 19:55:00) => false', () => {
    expect(isPlausible('1905-11-04', today())).toBe(false);
  });

  test('example 33: isPlausible("1900-01-01", 2026-11-04 19:55:00) => false', () => {
    expect(isPlausible('1900-01-01', today())).toBe(false);
  });

  test('example 34: isPlausible("0199-03-14", 2026-11-04 19:55:00) => false', () => {
    expect(isPlausible('0199-03-14', today())).toBe(false);
  });
});
