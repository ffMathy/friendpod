// End-to-end check of FinalStep (ail/onboarding/final-step): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, isTicked, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const PLEDGE = "I'll meet in public places, treat people with respect, and use Report if something feels wrong.";
const onStep = async (locale: 'en' | 'da' = 'en') => {
  const app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale });
  await app.page.getByText(locale === 'da' ? 'Næsten færdig' : 'Almost done', { exact: true }).waitFor();
  return app;
};

test('Finish waits for the safety pledge', async () => {
  await using app = await onStep();
  const { page } = app;
  expect(await page.getByText('Step 6 of 6', { exact: true }).isVisible()).toBe(true);
  const pledge = page.getByRole('checkbox', { name: PLEDGE });
  expect(await isTicked(pledge)).toBe(false);
  const finish = page.getByRole('button', { name: 'Finish', exact: true });
  expect(await finish.isDisabled()).toBe(true);
  await pledge.click();
  expect(await isTicked(pledge)).toBe(true);
  expect(await finish.isDisabled()).toBe(false);
});

test('Finishing opens Home', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByRole('checkbox', { name: PLEDGE }).click();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByText('This week', { exact: true }).first().waitFor();
  expect(await page.getByText('Almost done', { exact: true }).count()).toBe(0);
});

test('The step in Danish', async () => {
  await using app = await onStep('da');
  const { page } = app;
  expect(await page.getByText('Trin 6 af 6', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Færdig', exact: true }).isDisabled()).toBe(true);
});
