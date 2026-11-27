// ail-derived-from: BirthDate@d755b0534ac76ed0
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { isTicked, openApp } from '../../../../harness/preview.ts';

const TIMEOUT = 180_000;

const DOB_INVALID = 'That is not a valid date.';
const UNDERAGE = 'Friendpod is only for people aged 18 and over.';

async function enterFirstName(page: Page, name: string): Promise<void> {
  const field = page.getByLabel('First name', { exact: true });
  await field.fill(name);
  expect(await field.inputValue()).toBe(name);
}

async function tickTerms(page: Page): Promise<void> {
  const box = page.getByRole('checkbox', { name: 'I accept the Terms' });
  await box.click();
  expect(await isTicked(box)).toBe(true);
}

async function enterBirthDate(page: Page, day: string, month: string, year: string): Promise<void> {
  const dayField = page.getByLabel('Date of birth, Day', { exact: true });
  const monthField = page.getByLabel('Date of birth, Month', { exact: true });
  const yearField = page.getByLabel('Date of birth, Year', { exact: true });
  await dayField.fill(day);
  await monthField.fill(month);
  await yearField.fill(year);
  // The fields are controlled, so once they show the typed values the step has rendered that state.
  expect(await dayField.inputValue()).toBe(day);
  expect(await monthField.inputValue()).toBe(month);
  expect(await yearField.inputValue()).toBe(year);
}

async function visibleCount(page: Page, text: string): Promise<number> {
  const matches = page.getByText(text, { exact: true });
  const n = await matches.count();
  let visible = 0;
  for (let i = 0; i < n; i += 1) {
    if (await matches.nth(i).isVisible()) visible += 1;
  }
  return visible;
}

test(
  'A date that does not exist is refused',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await enterFirstName(page, 'Emil');
    await tickTerms(page);

    await enterBirthDate(page, '31', '02', '1991');

    await page.getByText(DOB_INVALID, { exact: true }).waitFor({ state: 'visible' });
    expect(await visibleCount(page, DOB_INVALID)).toBe(1);

    const continueButton = page.getByRole('button', { name: 'Continue' });
    expect(await continueButton.isDisabled()).toBe(true);

    await app.saveScreen('a-date-that-does-not-exist-is-refused.png');
  },
  TIMEOUT,
);

test(
  'Someone under 18 is told, and may still continue',
  async () => {
    // The "new member" world's today is 4 November 2026 in Copenhagen.
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await enterFirstName(page, 'Emil');
    await tickTerms(page);

    await enterBirthDate(page, '05', '11', '2008');

    await page.getByText(UNDERAGE, { exact: true }).waitFor({ state: 'visible' });
    expect(await visibleCount(page, UNDERAGE)).toBe(1);

    const continueButton = page.getByRole('button', { name: 'Continue' });
    expect(await continueButton.isDisabled()).toBe(false);

    await app.saveScreen('someone-under-18-is-told-and-may-still-continue.png');
  },
  TIMEOUT,
);

test(
  'Turning 18 today is old enough',
  async () => {
    // The "new member" world's today is 4 November 2026 in Copenhagen.
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await enterBirthDate(page, '04', '11', '2008');

    expect(await visibleCount(page, DOB_INVALID)).toBe(0);
    expect(await visibleCount(page, UNDERAGE)).toBe(0);

    await app.saveScreen('turning-18-today-is-old-enough.png');
  },
  TIMEOUT,
);
