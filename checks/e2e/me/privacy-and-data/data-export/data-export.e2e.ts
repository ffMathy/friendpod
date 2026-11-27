// ail-derived-from: DataExport@2b73e962e0ca88b3
// End-to-end check of DataExport (ail/me/privacy-and-data/data-export): each test is one of its scenarios, by name,
// played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

test('Asking for the data', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Download my data A file you can keep, ready within minutes', exact: true }).click();
  await page.getByText("We're preparing your file and will let you know when it's ready.", { exact: true }).waitFor();
});

test('A ready file shows until when it can be downloaded', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member this week', locale: 'en' });
  const { page } = app;
  const exportRow = page.getByRole('button', { name: 'Download my data A file you can keep, ready within minutes', exact: true });
  await exportRow.waitFor();
  const ready = page.getByText('Your file is ready until Tue 10 Nov, 21:12.', { exact: true });
  await ready.waitFor();
  const download = page.getByRole('button', { name: 'Download the file', exact: true });
  expect(await download.isVisible()).toBe(true);
  const rowBox = await exportRow.boundingBox();
  const readyBox = await ready.boundingBox();
  expect(rowBox && readyBox && readyBox.y > rowBox.y).toBe(true);
});

test('A download that does not work says so', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Download the file', exact: true }).click();
  await page.getByText("The download didn't work. Try again.", { exact: true }).waitFor();
});

test('The data export in Danish', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member this week', locale: 'da' });
  const { page } = app;
  const exportRow = page.getByRole('button', { name: 'Hent mine data En fil, du kan gemme, klar på få minutter', exact: true });
  await exportRow.waitFor();
  await page.getByText('Din fil er klar indtil tirs. 10. nov., 21.12.', { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Hent filen', exact: true }).isVisible()).toBe(true);
  await exportRow.click();
  await page.getByText('Vi laver din fil og giver besked, når den er klar.', { exact: true }).waitFor();
});
