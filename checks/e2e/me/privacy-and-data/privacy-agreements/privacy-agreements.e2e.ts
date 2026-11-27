// ail-derived-from: PrivacyAgreements@2f8768d951180689
// End-to-end check of PrivacyAgreements (ail/me/privacy-and-data/privacy-agreements): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

/** A row of the card, by its label and the state under it, as a screen reader reads it. */
const row = (page: Page, label: string, state: string) => page.getByRole('link', { name: `${label} ${state}`, exact: true });

test('The agreements of a member with private-interest consent', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: "What you've agreed to", exact: true }).waitFor();
  await row(page, 'Private interests', '1 interest, consent given').waitFor();
  expect(await row(page, 'Same-gender pods', 'Off, no gender stored').isVisible()).toBe(true);
  expect(await row(page, 'Photo', 'Shown to confirmed pods').isVisible()).toBe(true);
});

test('Without private-interest consent nothing sensitive is saved', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member without private-interest consent', locale: 'en' });
  const { page } = app;
  await row(page, 'Private interests', 'Not given, so nothing sensitive is saved').waitFor();
});

test('Private interests opens the private-interest consent', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await row(page, 'Private interests', '1 interest, consent given').click();
  await page.getByRole('heading', { name: 'Sensitive interests', exact: true }).waitFor();
  await page.getByText('You agreed on 4 Nov 2026.', { exact: true }).waitFor();
});

test('Same-gender pods opens the pod preferences', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await row(page, 'Same-gender pods', 'Off, no gender stored').click();
  await page.getByText('Pod preferences', { exact: true }).first().waitFor();
  await page.getByText('Same-gender pods only', { exact: true }).waitFor();
});

test('Photo opens Me', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await row(page, 'Photo', 'Shown to confirmed pods').click();
  await page.getByRole('button', { name: 'Change photo' }).waitFor();
  expect(await page.getByRole('heading', { name: 'Privacy', exact: true }).count()).toBe(0);
});

test('The agreements in Danish', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'da' });
  const { page } = app;
  await row(page, 'Private interesser', '1 interesse, samtykke givet').waitFor();
  expect(await row(page, 'Pods med samme køn', 'Fra – vi gemmer ikke dit køn').isVisible()).toBe(true);
  expect(await row(page, 'Billede', 'Vises for bekræftede pods').isVisible()).toBe(true);
});
