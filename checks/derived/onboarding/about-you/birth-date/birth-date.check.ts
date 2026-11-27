// ail-derived-from: BirthDate@4cf4112410de83ce
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { isTicked, openApp } from '../../../../harness/preview.ts';

const TIMEOUT = 180_000;

const INVALID = 'That is not a valid date.';
const UNDERAGE = 'Friendpod is only for people aged 18 and over.';

function continueButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Continue' });
}

async function enterFirstName(page: Page, name: string): Promise<void> {
  await page.getByLabel('First name', { exact: true }).fill(name);
}

async function tickTerms(page: Page): Promise<void> {
  const box = page.getByRole('checkbox', { name: 'I accept the Terms' });
  if (!(await isTicked(box))) {
    await box.click();
  }
  expect(await isTicked(box)).toBe(true);
}

async function enterBirthDate(page: Page, day: string, month: string, year: string): Promise<void> {
  await page.getByLabel('Date of birth, Day', { exact: true }).fill(day);
  await page.getByLabel('Date of birth, Month', { exact: true }).fill(month);
  await page.getByLabel('Date of birth, Year', { exact: true }).fill(year);
  expect(await page.getByLabel('Date of birth, Year', { exact: true }).inputValue()).toBe(year);
}

async function expectMessage(page: Page, text: string): Promise<void> {
  const message = page.getByText(text, { exact: true });
  await message.waitFor({ state: 'visible', timeout: 10_000 });
  expect(await message.isVisible()).toBe(true);
}

describe('BirthDate', () => {
  test(
    'A date that does not exist is refused',
    async () => {
      await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
      const page = app.page;
      await enterFirstName(page, 'Emil');
      await tickTerms(page);

      await enterBirthDate(page, '31', '02', '1991');

      await expectMessage(page, INVALID);
      expect(await continueButton(page).isDisabled()).toBe(true);

      await app.saveScreen('a-date-that-does-not-exist-is-refused.png');
    },
    TIMEOUT,
  );

  test(
    'Someone under 18 cannot continue',
    async () => {
      await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
      const page = app.page;
      await enterFirstName(page, 'Emil');
      await tickTerms(page);

      await enterBirthDate(page, '05', '11', '2008');

      await expectMessage(page, UNDERAGE);
      expect(await continueButton(page).isDisabled()).toBe(true);

      await app.saveScreen('someone-under-18-cannot-continue.png');
    },
    TIMEOUT,
  );

  test(
    'A birth date in the future is refused',
    async () => {
      await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
      const page = app.page;
      await enterFirstName(page, 'Emil');
      await tickTerms(page);

      await enterBirthDate(page, '01', '01', '2027');

      await expectMessage(page, INVALID);
      expect(await continueButton(page).isDisabled()).toBe(true);

      await app.saveScreen('a-birth-date-in-the-future-is-refused.png');
    },
    TIMEOUT,
  );

  test(
    'A birth date more than 120 years ago is refused',
    async () => {
      await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
      const page = app.page;
      await enterFirstName(page, 'Emil');
      await tickTerms(page);

      await enterBirthDate(page, '14', '03', '0199');

      await expectMessage(page, INVALID);
      expect(await continueButton(page).isDisabled()).toBe(true);

      await app.saveScreen('a-birth-date-more-than-120-years-ago-is-refused.png');
    },
    TIMEOUT,
  );

  test(
    'Turning 18 today is old enough',
    async () => {
      await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
      const page = app.page;

      await enterBirthDate(page, '04', '11', '2008');
      await page.waitForTimeout(300);

      expect(await page.getByText(INVALID, { exact: true }).count()).toBe(0);
      expect(await page.getByText(UNDERAGE, { exact: true }).count()).toBe(0);

      await app.saveScreen('turning-18-today-is-old-enough.png');
    },
    TIMEOUT,
  );
});
