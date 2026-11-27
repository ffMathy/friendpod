// ail-derived-from: PodMenu@5336ae81045aeec2
// End-to-end check of PodMenu (ail/pod-page/pod-menu): each test is one of its scenarios, by name, played through the
// running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const BRAETSPIL = '/pod/braetspilpodaarhus46';

async function openMenu(page: Page, name = 'More options') {
  await page.getByRole('button', { name, exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.waitFor();
  return sheet;
}

test('The menu offers the safety tips and Leave pod', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const sheet = await openMenu(app.page);
  expect(await sheet.getByRole('heading', { name: 'More options', exact: true }).isVisible()).toBe(true);
  expect(await sheet.getByRole('link', { name: 'Meeting safely', exact: true }).isVisible()).toBe(true);
  expect(await sheet.getByRole('button', { name: 'Leave pod', exact: true }).isVisible()).toBe(true);
});

test('Meeting safely in the menu opens the safety tips', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  const sheet = await openMenu(page);
  await sheet.getByRole('link', { name: 'Meeting safely', exact: true }).click();
  await page.getByText('Before you go', { exact: true }).waitFor();
});

test('Close shuts the menu', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  const sheet = await openMenu(page);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await sheet.waitFor({ state: 'detached' });
  expect(await page.getByRole('heading', { name: 'Still coming tomorrow at 14:00?', exact: true }).isVisible()).toBe(true);
});

test('The reveal has the same menu', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'en' });
  const sheet = await openMenu(app.page);
  expect(await sheet.getByRole('link', { name: 'Meeting safely', exact: true }).isVisible()).toBe(true);
  expect(await sheet.getByRole('button', { name: 'Leave pod', exact: true }).isVisible()).toBe(true);
});

test('The menu in Danish', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'da' });
  const sheet = await openMenu(app.page, 'Flere muligheder');
  expect(await sheet.getByRole('link', { name: 'Mød hinanden trygt', exact: true }).isVisible()).toBe(true);
  expect(await sheet.getByRole('button', { name: 'Forlad poden', exact: true }).isVisible()).toBe(true);
});
