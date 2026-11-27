// End-to-end check of PreferencesStep (ail/onboarding/preferences-step): each test is one of its scenarios, by name,
// played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onStep = async (locale: 'en' | 'da' = 'en') => {
  const app = await openApp({ route: '/pod-preferences', world: 'member adding interests', locale });
  await app.page.getByText(locale === 'da' ? 'Hvem vil du gerne møde?' : 'Who would you like to meet?', { exact: true }).waitFor();
  return app;
};
const box = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true });
const TIMES = ['Weekdays, evening', 'Saturday, daytime', 'Sunday, daytime'];

test("The step starts from the profile's preferences", async () => {
  await using app = await onStep();
  const { page } = app;
  expect(await page.getByText('Step 5 of 6', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByLabel('Ages 28 to 42').isVisible()).toBe(true);
  expect(await page.getByText('28–42', { exact: true }).isVisible()).toBe(true);
  expect(await isTicked(page.getByRole('radio', { name: 'about 10 km', exact: true }))).toBe(true);
  for (const km of [5, 15, 25]) expect(await isTicked(page.getByRole('radio', { name: `about ${km} km`, exact: true }))).toBe(false);
  for (const name of ['Danish', 'English', ...TIMES]) expect(await isTicked(box(page, name))).toBe(true);
  for (const name of ['Weekdays, daytime', 'Saturday, evening', 'Sunday, evening']) expect(await isTicked(box(page, name))).toBe(false);
  expect(await page.getByRole('switch', { name: 'Same-gender pods only' }).isVisible()).toBe(true);
  expect(await page.getByText('Open to meeting anyone').count()).toBe(0);
});

test('Continue saves and opens step 6', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Almost done', { exact: true }).waitFor();
  expect(await page.getByText('Step 6 of 6', { exact: true }).isVisible()).toBe(true);
});

test('A language is needed', async () => {
  await using app = await onStep();
  const { page } = app;
  await box(page, 'Danish').click();
  await box(page, 'English').click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Pick at least one language.', { exact: true }).waitFor();
  await page.waitForTimeout(500);
  expect(await page.getByText('Who would you like to meet?', { exact: true }).isVisible()).toBe(true);
});

test('A free time is needed', async () => {
  await using app = await onStep();
  const { page } = app;
  for (const name of TIMES) await box(page, name).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Pick at least one time.', { exact: true }).waitFor();
  await page.waitForTimeout(500);
  expect(await page.getByText('Who would you like to meet?', { exact: true }).isVisible()).toBe(true);
});

test('The step in Danish', async () => {
  await using app = await onStep('da');
  const { page } = app;
  for (const text of ['Trin 5 af 6', 'Alder', 'Hvor langt vil du rejse for at mødes?', 'Sprog til møderne', 'Hvornår har du typisk tid?']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
});
