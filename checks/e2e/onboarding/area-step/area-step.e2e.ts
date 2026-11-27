// ail-derived-from: AreaStep@06516c2c43eec859
// End-to-end check of AreaStep (ail/onboarding/area-step): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const texts = {
  en: { firstName: 'First name', terms: 'I accept the Terms', continue: 'Continue', title: 'Where do you live?', postcode: 'Postcode' },
  da: { firstName: 'Fornavn', terms: 'Jeg accepterer vilkårene', continue: 'Fortsæt', title: 'Hvor bor du?', postcode: 'Postnummer' },
};

/** Opens About you as a new member and goes through it with Emil, 14 03 1991 and the Terms, to Where do you live?. */
async function afterAboutYou(locale: 'en' | 'da' = 'en') {
  const t = texts[locale];
  const app = await openApp({ route: '/about', world: 'new member', locale });
  const { page } = app;
  const dob = locale === 'da' ? 'Fødselsdato' : 'Date of birth';
  const [day, month, year] = locale === 'da' ? ['Dag', 'Måned', 'År'] : ['Day', 'Month', 'Year'];
  await page.getByLabel(t.firstName, { exact: true }).fill('Emil');
  await page.getByLabel(`${dob}, ${day}`).fill('14');
  await page.getByLabel(`${dob}, ${month}`).fill('03');
  await page.getByLabel(`${dob}, ${year}`).fill('1991');
  await page.getByRole('checkbox', { name: t.terms }).click();
  await page.getByRole('button', { name: t.continue, exact: true }).click();
  await page.getByText(t.title, { exact: true }).waitFor();
  return app;
}

const continueButton = (page: Page, locale: 'en' | 'da' = 'en') =>
  page.getByRole('button', { name: texts[locale].continue, exact: true });
const postcode = (page: Page, locale: 'en' | 'da' = 'en') => page.getByLabel(texts[locale].postcode, { exact: true });

test('The step starts with no area and Continue waits', async () => {
  await using app = await afterAboutYou();
  const { page } = app;
  expect(await page.getByText('Step 2 of 6', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Back', exact: true }).isVisible()).toBe(true);
  expect(await postcode(page).inputValue()).toBe('');
  expect(await page.getByText('Your area', { exact: true }).count()).toBe(0);
  expect(await continueButton(page).isDisabled()).toBe(true);
  expect(await page.getByText('Postal code data: GeoNames (www.geonames.org)', { exact: true }).isVisible()).toBe(true);
});

test('A known postcode gives an area', async () => {
  await using app = await afterAboutYou();
  const { page } = app;
  await postcode(page).fill('8000');
  await page.getByText('Your area', { exact: true }).waitFor();
  expect(await page.getByText('Aarhus C', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Aarhus opens soon', { exact: true }).isVisible()).toBe(true);
  expect(await continueButton(page).isDisabled()).toBe(false);
});

test('An unknown postcode is refused', async () => {
  await using app = await afterAboutYou();
  const { page } = app;
  await postcode(page).fill('0000');
  await page.getByText("We don't know that postcode.", { exact: true }).waitFor();
  expect(await page.getByText('Your area', { exact: true }).count()).toBe(0);
  expect(await continueButton(page).isDisabled()).toBe(true);
});

test('No approximate location', async () => {
  await using app = await afterAboutYou();
  const { page } = app;
  await page.getByRole('button', { name: 'Use my approximate location', exact: true }).click();
  await page.getByText('We could not get your approximate location. Use your postcode instead.', { exact: true }).waitFor();
});

test('Continue sends the basics and opens step 3', async () => {
  await using app = await afterAboutYou();
  const { page } = app;
  await postcode(page).fill('8000');
  await continueButton(page).click();
  await page.getByText('Step 3 of 6', { exact: true }).waitFor();
  expect(await page.getByText('Sensitive interests', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);
});

test('Opened directly, the step cannot be finished', async () => {
  await using app = await openApp({ route: '/area', world: 'new member', locale: 'en' });
  const { page } = app;
  await page.getByText('Where do you live?', { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);
  await postcode(page).fill('8000');
  await continueButton(page).click();
  await page.waitForTimeout(1000);
  expect(await page.getByText('Where do you live?', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Step 3 of 6', { exact: true }).count()).toBe(0);
});

test('The step in Danish', async () => {
  await using app = await afterAboutYou('da');
  const { page } = app;
  await postcode(page, 'da').fill('8000');
  await page.getByText('Dit område', { exact: true }).waitFor();
  for (const text of ['Trin 2 af 6', 'Postnummer', 'Aarhus C', 'Aarhus åbner snart']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
});
