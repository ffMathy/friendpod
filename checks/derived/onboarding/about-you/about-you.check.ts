// ail-derived-from: AboutYou@26c05d9381ba4e34
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { isTicked, openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

async function shown(page: Page, text: string): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible' });
}

async function enterBirthDate(page: Page, day: string, month: string, year: string): Promise<void> {
  await page.getByLabel('Date of birth, Day').fill(day);
  await page.getByLabel('Date of birth, Month').fill(month);
  await page.getByLabel('Date of birth, Year').fill(year);
}

test(
  'The step starts empty and Continue waits',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await shown(page, 'Step 1 of 6');
    await shown(page, 'About you');

    expect(await page.getByLabel('First name').inputValue()).toBe('');
    expect(await page.getByLabel('Date of birth, Day').inputValue()).toBe('');
    expect(await page.getByLabel('Date of birth, Month').inputValue()).toBe('');
    expect(await page.getByLabel('Date of birth, Year').inputValue()).toBe('');

    const terms = page.getByRole('checkbox', { name: 'I accept the Terms' });
    expect(await isTicked(terms)).toBe(false);

    expect(await page.getByRole('button', { name: 'Continue' }).isDisabled()).toBe(true);

    await app.saveScreen('the-step-starts-empty-and-continue-waits.png');
  },
  TIMEOUT,
);

test(
  'The basics lead to step 2',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shown(page, 'About you');

    await page.getByLabel('First name').fill('Emil');
    await enterBirthDate(page, '14', '03', '1991');
    const terms = page.getByRole('checkbox', { name: 'I accept the Terms' });
    await terms.click();
    expect(await isTicked(terms)).toBe(true);

    const continueButton = page.getByRole('button', { name: 'Continue' });
    expect(await continueButton.isDisabled()).toBe(false);

    await continueButton.click();
    await shown(page, 'Where do you live?');

    await app.saveScreen('the-basics-lead-to-step-2.png');
  },
  TIMEOUT,
);

test(
  'A first name with a digit is refused',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shown(page, 'About you');

    await enterBirthDate(page, '14', '03', '1991');
    const terms = page.getByRole('checkbox', { name: 'I accept the Terms' });
    await terms.click();
    expect(await isTicked(terms)).toBe(true);

    await page.getByLabel('First name').fill('Emil2');

    await shown(page, 'Use 1–30 letters. No contact details.');
    expect(await page.getByRole('button', { name: 'Continue' }).isDisabled()).toBe(true);

    await app.saveScreen('a-first-name-with-a-digit-is-refused.png');
  },
  TIMEOUT,
);

test(
  'A first name with a hyphen and an apostrophe is accepted',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shown(page, 'About you');

    const firstName = page.getByLabel('First name');
    await firstName.fill('Anne-Marie O’Brien');
    expect(await firstName.inputValue()).toBe('Anne-Marie O’Brien');

    expect(await page.getByText('Use 1–30 letters. No contact details.', { exact: true }).count()).toBe(0);

    await app.saveScreen('a-first-name-with-a-hyphen-and-an-apostrophe-is-accepted.png');
  },
  TIMEOUT,
);

test(
  'Going back from the first step signs out',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shown(page, 'About you');

    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByRole('button', { name: 'Continue with email' }).waitFor({ state: 'visible' });

    await app.saveScreen('going-back-from-the-first-step-signs-out.png');
  },
  TIMEOUT,
);

test(
  'The step in Danish',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
    const page = app.page;

    await shown(page, 'Trin 1 af 6');
    await shown(page, 'Om dig');
    await shown(page, 'Fornavn');

    await page.getByLabel('Fornavn').fill('Emil2');

    await shown(page, 'Brug 1–30 bogstaver. Ingen kontaktoplysninger.');

    await app.saveScreen('the-step-in-danish.png');
  },
  TIMEOUT,
);
