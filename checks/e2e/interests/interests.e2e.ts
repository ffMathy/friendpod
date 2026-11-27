// ail-derived-from: Interests@04f59b53d171c9ae
// End-to-end check of Interests (ail/interests): each test is one of its scenarios, by name, played through the running
// app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).isVisible();

/** The interests under the list card's "Interests" eyebrow, in order: each row's "More for …" button names one. */
async function listed(page: Page, more = 'More for '): Promise<string[]> {
  const names = await page.getByRole('button', { name: new RegExp(`^${more}`) }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return names.map((n) => n.slice(more.length));
}

test('The tab shows every interest and the private one apart', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week' });
  const { page } = app;
  await page.getByText('5 of 20', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Interests', exact: true }).count()).toBeGreaterThan(0);
  expect(await listed(page)).toEqual(['brætspil', 'sourdough', 'far på barsel', 'trail running']);
  expect(await page.getByRole('heading', { name: 'Private interests', exact: true }).isVisible()).toBe(true);
  expect(await visible(page, 'gravid')).toBe(true);
  expect(await visible(page, 'Consent given 4 Nov 2026')).toBe(true);
  expect(await page.getByRole('link', { name: 'How private interests work' }).isVisible()).toBe(true);
  expect(await page.getByText('Add at least 3. 5 or more gives better pods.').count()).toBe(0);
});

test('Fewer than five interests show the nudge', async () => {
  await using app = await openApp({ route: '/interests', world: 'member without private-interest consent' });
  const { page } = app;
  await page.getByText('4 of 20', { exact: true }).waitFor();
  expect(await visible(page, 'Add at least 3. 5 or more gives better pods.')).toBe(true);
});

test('How private interests work opens its page', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week' });
  const { page } = app;
  await page.getByRole('link', { name: 'How private interests work' }).click();
  await page.getByText('Some interests say more about you than others. This is how we look after them.', { exact: true }).waitFor();
  expect(new URL(page.url()).pathname).toBe('/info/sensitive-interests');
});

test('The tab in Danish', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'da' });
  const { page } = app;
  await page.getByText('5 af 20', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Interesser', exact: true }).count()).toBeGreaterThan(0);
  expect(await page.getByRole('heading', { name: 'Private interesser', exact: true }).isVisible()).toBe(true);
  expect(await visible(page, 'Du sagde ja 4. nov. 2026')).toBe(true);
  expect(await page.getByRole('link', { name: 'Sådan fungerer private interesser' }).isVisible()).toBe(true);
});
