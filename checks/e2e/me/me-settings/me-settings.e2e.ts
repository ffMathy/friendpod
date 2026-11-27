// ail-derived-from: MeSettings@7eada3d428b047ec
// End-to-end check of MeSettings (ail/me/me-settings): each test is one of its scenarios, by name, played through the
// running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });
const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true });
const onSettings = (locale: 'en' | 'da' = 'en') => openApp({ route: '/settings', world: 'member this week', locale });

test('Settings lists what Me\'s row promises', async () => {
  await using app = await onSettings();
  const { page } = app;
  await heading(page, 'Settings').waitFor();
  expect(await page.getByText('Me', { exact: true }).first().isVisible()).toBe(true);
  await heading(page, 'General').waitFor();
  const language = page.getByRole('radiogroup', { name: 'Language' });
  for (const name of ['Dansk', 'English']) expect(await language.getByRole('radio', { name, exact: true }).count()).toBe(1);
  for (const name of ['Notifications', 'Privacy', 'Terms', 'Privacy notice', 'Licences']) expect(await link(page, name).count()).toBe(1);
  await heading(page, 'Legal').waitFor();
  expect(await page.getByRole('button', { name: 'Sign out', exact: true }).isVisible()).toBe(true);
});

test('Choosing Dansk switches the app to Danish', async () => {
  await using app = await onSettings();
  const { page } = app;
  await page.getByRole('radio', { name: 'Dansk', exact: true }).click();
  await heading(page, 'Indstillinger').waitFor();
  for (const name of ['Generelt', 'Juridisk']) await heading(page, name).waitFor();
  await page.getByText('Sprog', { exact: true }).waitFor();
  await link(page, 'Notifikationer').waitFor();
  await page.getByRole('button', { name: 'Log ud', exact: true }).waitFor();
});

test('Signing out returns to the welcome screen', async () => {
  await using app = await onSettings();
  const { page } = app;
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
  expect(await heading(page, 'Settings').count()).toBe(0);
});

test('The rows open their pages', async () => {
  await using app = await onSettings();
  const { page } = app;
  await link(page, 'Notifications').click();
  await heading(page, 'Notifications').waitFor();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await link(page, 'Privacy').click();
  await heading(page, 'Privacy').waitFor();
  await page.getByRole('button', { name: /^Back/ }).click();
  await link(page, 'Terms').click();
  await heading(page, 'Terms').waitFor();
  await page.getByText('Draft', { exact: true }).waitFor();
});

test('Settings in Danish', async () => {
  await using app = await onSettings('da');
  const { page } = app;
  await heading(page, 'Indstillinger').waitFor();
  expect(await page.getByText('Mig', { exact: true }).first().isVisible()).toBe(true);
  for (const name of ['Vilkår', 'Privatlivserklæring', 'Licenser']) expect(await link(page, name).count()).toBe(1);
  expect(await page.getByRole('button', { name: 'Log ud', exact: true }).isVisible()).toBe(true);
});
