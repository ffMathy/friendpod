// End-to-end check of SensitiveInterestsStep (ail/onboarding/sensitive-interests-step): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees: labels, roles and the
// copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const TICK =
  'I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, for the purposes above.';
const onStep = (locale: 'en' | 'da' = 'en') =>
  openApp({ route: '/sensitive-consent', world: 'member choosing about private interests', locale });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('The consent starts unticked and I agree waits', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByText('Step 3 of 6', { exact: true }).waitFor();
  expect(await page.getByText('Private interests', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Sensitive interests', { exact: true }).isVisible()).toBe(true);
  expect(await button(page, 'Back').count()).toBe(0);
  expect(await isTicked(page.getByRole('checkbox', { name: TICK }))).toBe(false);
  expect(await button(page, 'I agree').isDisabled()).toBe(true);
  expect(await button(page, 'Not now').isDisabled()).toBe(false);
});

test('I agree gives the consent and opens the interests', async () => {
  await using app = await onStep();
  const { page } = app;
  await page.getByRole('checkbox', { name: TICK }).click();
  expect(await button(page, 'I agree').isDisabled()).toBe(false);
  await button(page, 'I agree').click();
  await page.getByText('What are you into?', { exact: true }).waitFor();
  expect(await page.getByText('Step 4 of 6', { exact: true }).isVisible()).toBe(true);
});

test('Not now carries on without the consent', async () => {
  await using app = await onStep();
  const { page } = app;
  await button(page, 'Not now').click();
  await page.getByText('What are you into?', { exact: true }).waitFor();
});

test('Asked for from the interests, it returns there', async () => {
  await using app = await openApp({ route: '/add-interests', world: 'member choosing about private interests', locale: 'en' });
  const { page } = app;
  await page.getByRole('textbox', { name: 'Add an interest in your own words' }).fill('diabetes');
  await button(page, 'Add').click();
  const refusal = page.getByText(/^This interest may be sensitive, so we only save it if you've agreed/);
  await refusal.waitFor();
  await button(page, 'Sensitive interests: give consent').click();
  await page.getByText('Step 3 of 6', { exact: true }).waitFor();
  expect(await button(page, 'Back').isVisible()).toBe(true);
  await button(page, 'Not now').click();
  await page.getByText('What are you into?', { exact: true }).waitFor();
  expect(await refusal.isVisible()).toBe(true);
});

test('The step in Danish', async () => {
  await using app = await onStep('da');
  const { page } = app;
  await page.getByText('Trin 3 af 6', { exact: true }).waitFor();
  expect(await page.getByText('Følsomme interesser', { exact: true }).isVisible()).toBe(true);
  expect(await button(page, 'Jeg siger ja').isDisabled()).toBe(true);
  expect(await button(page, 'Ikke nu').isDisabled()).toBe(false);
});
