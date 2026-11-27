// ail-derived-from: WithdrawPrivateInterestConsent@adfd0bde65a645c6
// End-to-end check of WithdrawPrivateInterestConsent (ail/me/privacy-and-data/withdraw-private-interest-consent): each
// test is one of its scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onConsent = (locale: 'en' | 'da' = 'en') => openApp({ route: '/settings/sensitive-consent', world: 'member this week', locale });

test('The consent shows when it was given and what it covers', async () => {
  await using app = await onConsent();
  const { page } = app;
  await page.getByText('You agreed on 4 Nov 2026.', { exact: true }).waitFor();
  expect(await page.getByText('1 of your interests is private.', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'See them under Interests', exact: true }).isVisible()).toBe(true);
  await page.getByText(/^Some interests can reveal your health, religion or beliefs/).waitFor();
  expect(await page.getByRole('button', { name: 'Withdraw consent', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('checkbox').count()).toBe(0);
  expect(await page.getByRole('button', { name: 'I agree', exact: true }).count()).toBe(0);
});

test('See them under Interests opens Interests', async () => {
  await using app = await onConsent();
  const { page } = app;
  await page.getByRole('link', { name: 'See them under Interests', exact: true }).click();
  await page.getByText('gravid', { exact: true }).waitFor();
  expect(await page.getByRole('tab', { name: 'Interests' }).isVisible()).toBe(true);
});

test('Withdrawing waits for a confirmation', async () => {
  await using app = await onConsent();
  const { page } = app;
  await page.getByRole('button', { name: 'Withdraw consent', exact: true }).click();
  await page.waitForTimeout(800);
  expect(await page.getByText('You agreed on 4 Nov 2026.', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Withdraw consent', exact: true }).isVisible()).toBe(true);
});

test('The given consent in Danish', async () => {
  await using app = await onConsent('da');
  const { page } = app;
  await page.getByText('Du sagde ja den 4. nov. 2026.', { exact: true }).waitFor();
  expect(await page.getByText('1 af dine interesser er privat.', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Se dem under Interesser', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Træk samtykket tilbage', exact: true }).isVisible()).toBe(true);
});
