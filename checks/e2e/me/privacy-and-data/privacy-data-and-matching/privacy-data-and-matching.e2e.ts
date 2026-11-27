// ail-derived-from: PrivacyDataAndMatching@2b01918420dca0e7
// End-to-end check of PrivacyDataAndMatching (ail/me/privacy-and-data/privacy-data-and-matching): each test is one of
// its scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

test('Pausing matching says from which week', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Pause matching Skip drops until you come back', exact: true }).click();
  await page.getByRole('button', { name: 'Pause matching Applies from week 2026-W46', exact: true }).waitFor();
});

test('Blocked people counts whom the member blocked', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  await app.page.getByRole('link', { name: 'Blocked people 1 person', exact: true }).waitFor();
});

test('Nobody blocked', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member without private-interest consent', locale: 'en' });
  await app.page.getByRole('link', { name: 'Blocked people Nobody', exact: true }).waitFor();
});

test('Blocked people opens the list', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Blocked people 1 person', exact: true }).click();
  await page.getByText('Rasmus', { exact: true }).waitFor();
  expect(await page.getByText('Blocked people', { exact: true }).filter({ visible: true }).count()).toBeGreaterThan(0);
});

test('How matching works opens its page', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'How matching works', exact: true }).click();
  await page.getByText('What we use', { exact: true }).waitFor();
  expect(await page.getByText('How matching works', { exact: true }).filter({ visible: true }).count()).toBeGreaterThan(0);
});

test('Your data and matching in Danish', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'da' });
  const { page } = app;
  const pause = page.getByRole('button', { name: 'Sæt matchning på pause Spring drops over, indtil du vender tilbage', exact: true });
  await pause.waitFor();
  await page.getByRole('link', { name: 'Blokerede personer 1 person', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Sådan matcher vi', exact: true }).waitFor();
  await pause.click();
  await page.getByRole('button', { name: 'Sæt matchning på pause Gælder fra uge 2026-W46', exact: true }).waitFor();
});
