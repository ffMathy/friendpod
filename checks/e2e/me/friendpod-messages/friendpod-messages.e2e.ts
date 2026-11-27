// End-to-end check of FriendpodMessages (ail/me/friendpod-messages): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const route = '/settings/notices';
const shows = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor();

/** Where each text first appears in what the page shows, top to bottom. */
async function order(page: Page, texts: readonly string[]): Promise<number[]> {
  const shown = await page.locator('body').innerText();
  return texts.map((t) => shown.indexOf(t));
}

test('One message of each kind, newest first', async () => {
  await using app = await openApp({ route, world: 'member with messages from Friendpod', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Messages from Friendpod', exact: true }).waitFor();
  await shows(page, 'Pauses, report receipts and other news about your account. Each message is kept for a year.');
  await page.getByRole('heading', { name: 'Matching paused', exact: true }).waitFor();
  const sequence = [
    'Mon 9 Nov, 09:12', 'Your Friendpod data',
    'Sun 1 Nov, 22:40', 'Thanks for your report',
    'Sat 31 Oct, 21:00', 'Your pod changed',
    'Mon 26 Oct, 09:00', 'Welcome back',
    'Mon 12 Oct, 09:00', 'Matching paused',
  ];
  const at = await order(page, sequence);
  for (const i of at) expect(i).toBeGreaterThanOrEqual(0);
  expect([...at].sort((a, b) => a - b)).toEqual(at);
});

test('No messages yet', async () => {
  await using app = await openApp({ route, world: 'new member with nothing yet', locale: 'en' });
  const { page } = app;
  await shows(page, 'No messages from Friendpod.');
  await shows(page, "If we pause matching, receive your report or have your data ready, you'll find it here.");
});

test('Messages in Danish', async () => {
  await using app = await openApp({ route, world: 'member with messages from Friendpod', locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Beskeder fra Friendpod', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Dine Friendpod-data', exact: true }).waitFor();
  await shows(page, 'man. 9. nov., 09.12');
  await page.getByRole('heading', { name: 'Matchning sat på pause', exact: true }).waitFor();
});
