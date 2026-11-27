// End-to-end check of PrivacyAndData (ail/me/privacy-and-data): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

test('Privacy opens on what you have agreed to and your data', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  const title = page.getByRole('heading', { name: 'Privacy', exact: true });
  await title.waitFor();
  expect(await page.getByText('Me', { exact: true }).first().isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Back: Me' }).count()).toBe(0);
  const agreed = await page.getByRole('heading', { name: "What you've agreed to", exact: true }).boundingBox();
  const data = await page.getByRole('heading', { name: 'Your data and matching', exact: true }).boundingBox();
  const del = await page.getByRole('button', { name: 'Delete account', exact: true }).boundingBox();
  expect(agreed && data && del).toBeTruthy();
  expect(agreed!.y).toBeLessThan(data!.y);
  expect(data!.y).toBeLessThan(del!.y);
  await page.getByText(/^Unhappy with how we handle your data\? You can complain to the Danish Data Protection Agency \(/).waitFor();
  expect(await page.getByRole('link', { name: 'datatilsynet.dk', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('tab', { name: 'Me' }).isVisible()).toBe(true);
});

test('Coming from Me, Me leads back', async () => {
  await using app = await openApp({ route: '/me', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByText('Privacy', { exact: true }).click();
  const back = page.getByRole('button', { name: 'Back: Me' });
  await back.waitFor();
  await back.click();
  await page.getByText('Consents, your data, delete account', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Privacy', exact: true }).count()).toBe(0);
});

test('Delete account opens the delete screen', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByRole('heading', { name: 'Delete your account?', exact: true }).waitFor();
});

test('Privacy in Danish', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Privatliv', exact: true }).waitFor();
  expect(await page.getByText('Mig', { exact: true }).first().isVisible()).toBe(true);
  await page.getByRole('heading', { name: 'Det har du sagt ja til', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Dine data og matchning', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Slet konto', exact: true }).waitFor();
  await page.getByText(/^Utilfreds med, hvordan vi behandler dine data\? Du kan klage til Datatilsynet \(/).waitFor();
  expect(await page.getByRole('link', { name: 'datatilsynet.dk', exact: true }).isVisible()).toBe(true);
});
