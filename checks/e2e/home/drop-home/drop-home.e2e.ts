// ail-derived-from: DropHome@f89eed499f59965f
// End-to-end check of DropHome (ail/home/drop-home): each test is one of its scenarios, by name, played through the
// running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const thisWeek = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'member this week', locale });

test('This week before the drop', async () => {
  await using app = await thisWeek();
  const { page } = app;
  await heading(page, 'This week').waitFor();
  for (const text of ['Week 46', 'Next drop', 'Thursday 18:00', 'in 2 days and 6 hours', "You're in this week"]) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'Your pods · 1 of 2 active').waitFor();
  const row = page.getByRole('link', { name: 'sourdough. Saturday 14:00 · [Bakery café], Frederiksbjerg' });
  await row.waitFor();
  const links = await page.getByRole('link').filter({ visible: true }).allTextContents();
  expect(links.at(-1)).toBe('How matching works');
});

test('The next drop explains the drop', async () => {
  await using app = await thisWeek();
  const { page } = app;
  await page.getByRole('link', { name: /^Next drop Thursday 18:00/ }).click();
  await heading(page, 'How matching works').waitFor();
  await heading(page, 'What we use').waitFor();
});

test('A pod row opens its pod', async () => {
  await using app = await thisWeek();
  const { page } = app;
  await page.getByRole('link', { name: /^sourdough\./ }).click();
  await heading(page, 'Plan').waitFor();
  await heading(page, 'Members').waitFor();
  await heading(page, 'sourdough').waitFor();
});

test('This week in Danish', async () => {
  await using app = await thisWeek('da');
  const { page } = app;
  await heading(page, 'Denne uge').waitFor();
  for (const text of ['Uge 46', 'Næste drop', 'Torsdag kl. 18.00', 'om 2 dage og 6 timer', 'Du er med i denne uge']) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'Dine pods · 1 af 2 aktive').waitFor();
  await page.getByRole('link', { name: 'sourdough. Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg' }).waitFor();
  const links = await page.getByRole('link').filter({ visible: true }).allTextContents();
  expect(links.at(-1)).toBe('Sådan matcher vi');
});
