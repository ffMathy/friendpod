// ail-derived-from: InterestsStep@efa72b9190842dc0
// End-to-end check of InterestsStep (ail/onboarding/interests-step): each test is one of its scenarios, by name,
// played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onStep = (locale: 'en' | 'da' = 'en') => openApp({ route: '/add-interests', world: 'member adding interests', locale });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('Three or more interests let the member continue', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByText('Your interests · 4 added', { exact: true }).waitFor();
  expect(await page.getByText('Step 4 of 6', { exact: true }).isVisible()).toBe(true);
  for (const chip of ['brætspil', 'sourdough', 'far på barsel', 'gravid, private']) {
    expect(await button(page, chip).isVisible()).toBe(true);
  }
  expect(await button(page, 'Continue').isDisabled()).toBe(false);
});

test('Below three interests Continue waits', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByText('Your interests · 4 added', { exact: true }).waitFor();
  await button(page, 'Remove brætspil').click();
  await button(page, 'Remove sourdough').click();
  await page.getByText('Your interests · 2 added', { exact: true }).waitFor();
  expect(await button(page, 'Continue').isDisabled()).toBe(true);
});

test('An added interest joins the chips', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByRole('textbox', { name: 'Add an interest in your own words' }).fill('kayak');
  await button(page, 'Add').click();
  await page.getByText('Added.', { exact: true }).waitFor();
  expect(await button(page, 'kayak').isVisible()).toBe(true);
  expect(await page.getByText('Your interests · 5 added', { exact: true }).isVisible()).toBe(true);
});

test('No interests yet', async () => {
  await using app = await openApp({ route: '/add-interests', world: 'member choosing about private interests', locale: 'en' });
  const { page } = app;
  await page.getByText('No interests yet.', { exact: true }).waitFor();
  expect(await page.getByText('Your interests', { exact: true }).isVisible()).toBe(true);
  expect(await button(page, 'Continue').isDisabled()).toBe(true);
});

test('Continue opens step 5', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByText('Your interests · 4 added', { exact: true }).waitFor();
  await button(page, 'Continue').click();
  await page.getByText('Who would you like to meet?', { exact: true }).waitFor();
  expect(await page.getByText('Step 5 of 6', { exact: true }).isVisible()).toBe(true);
});

test('The step in Danish', async () => {
  await using app = await onStep('da');
  const { page } = app;
  await page.getByText('Dine interesser · 4 tilføjet', { exact: true }).waitFor();
  expect(await page.getByText('Trin 4 af 6', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Hvad går du op i?', { exact: true }).isVisible()).toBe(true);
});
