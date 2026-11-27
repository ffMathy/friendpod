// ail-derived-from: BlockedPeople@86027c2540fea8be
// End-to-end check of BlockedPeople (ail/me/blocked-people): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const route = '/settings/blocked';
const shows = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor();

test('One blocked person', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Blocked people', exact: true }).waitFor();
  await shows(page, "You're never matched with someone you've blocked.");
  await shows(page, 'Rasmus');
  await shows(page, 'Blocked 31 Oct');
  await page.getByRole('button', { name: 'Unblock Rasmus', exact: true }).waitFor();
  expect(await page.getByText('Unblock', { exact: true }).isVisible()).toBe(true);
  await shows(page, 'To block someone, tap their name in a pod.');
  const shown = await page.locator('body').innerText();
  expect(shown.indexOf('To block someone')).toBeGreaterThan(shown.indexOf('Rasmus'));
});

test('Unblocking takes the block away at once', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Unblock Rasmus', exact: true }).click();
  await shows(page, "You haven't blocked anyone.");
  expect(await page.getByText('Rasmus', { exact: true }).count()).toBe(0);
});

test('Nobody blocked', async () => {
  await using app = await openApp({ route, world: 'new member with nothing yet', locale: 'en' });
  const { page } = app;
  await shows(page, "You haven't blocked anyone.");
  await shows(page, 'To block someone, tap their name in a pod.');
});

test('Blocked people in Danish', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Blokerede personer', exact: true }).waitFor();
  await shows(page, 'Rasmus');
  await shows(page, 'Blokeret 31. okt.');
  await page.getByRole('button', { name: 'Fjern blokering af Rasmus', exact: true }).waitFor();
  expect(await page.getByText('Fjern blokering', { exact: true }).isVisible()).toBe(true);
});
