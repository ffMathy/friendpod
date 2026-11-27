// ail-derived-from: AboutYou@c17554c57564a1ee
// End-to-end check of AboutYou (ail/onboarding/about-you): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onAboutYou = (locale: 'en' | 'da' = 'en') => openApp({ route: '/about', world: 'new member', locale });
const continueButton = (page: Page) => page.getByRole('button', { name: 'Continue', exact: true });
const terms = (page: Page) => page.getByRole('checkbox', { name: 'I accept the Terms' });

async function enterBirthDate(page: Page, day: string, month: string, year: string) {
  await page.getByLabel('Date of birth, Day').fill(day);
  await page.getByLabel('Date of birth, Month').fill(month);
  await page.getByLabel('Date of birth, Year').fill(year);
}

test('The step starts empty and Continue waits', async () => {
  await using app = await onAboutYou();
  const { page } = app;
  await expect(page.getByText('Step 1 of 6', { exact: true }).isVisible()).resolves.toBe(true);
  await expect(page.getByText('About you', { exact: true }).isVisible()).resolves.toBe(true);
  for (const label of ['First name', 'Date of birth, Day', 'Date of birth, Month', 'Date of birth, Year']) {
    expect(await page.getByLabel(label, { exact: true }).inputValue()).toBe('');
  }
  expect(await isTicked(terms(page))).toBe(false);
  expect(await continueButton(page).isDisabled()).toBe(true);
});

test('The basics lead to step 2', async () => {
  await using app = await onAboutYou();
  const { page } = app;
  await page.getByLabel('First name', { exact: true }).fill('Emil');
  await enterBirthDate(page, '14', '03', '1991');
  await terms(page).click();
  expect(await isTicked(terms(page))).toBe(true);
  expect(await continueButton(page).isDisabled()).toBe(false);
  await continueButton(page).click();
  await page.getByText('Where do you live?', { exact: true }).waitFor();
  expect(await page.getByText('Step 2 of 6', { exact: true }).isVisible()).toBe(true);
});

test('A first name with a digit is refused', async () => {
  await using app = await onAboutYou();
  const { page } = app;
  await enterBirthDate(page, '14', '03', '1991');
  await terms(page).click();
  await page.getByLabel('First name', { exact: true }).fill('Emil2');
  await page.getByText('Use letters only. No contact details.', { exact: true }).waitFor();
  expect(await continueButton(page).isDisabled()).toBe(true);
});

test('A long first name is accepted', async () => {
  await using app = await onAboutYou();
  const { page } = app;
  const name = 'Maria Josefine Augusta Wilhelmine Charlotte';
  await page.getByLabel('First name', { exact: true }).fill(name);
  await page.waitForTimeout(200);
  expect(await page.getByLabel('First name', { exact: true }).inputValue()).toBe(name);
  expect(await page.getByText('Use letters only. No contact details.').count()).toBe(0);
});

test('Going back from the first step signs out', async () => {
  await using app = await onAboutYou();
  const { page } = app;
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
  expect(await page.getByText('About you', { exact: true }).count()).toBe(0);
});

test('The step in Danish', async () => {
  await using app = await onAboutYou('da');
  const { page } = app;
  for (const text of ['Trin 1 af 6', 'Om dig', 'Fornavn']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
  await page.getByLabel('Fornavn', { exact: true }).fill('Emil2');
  await page.getByText('Brug kun bogstaver. Ingen kontaktoplysninger.', { exact: true }).waitFor();
});
