// ail-derived-from: PodPreferences@89b28d5d5574b482
// End-to-end check of PodPreferences (ail/me/pod-preferences): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const route = '/settings/preferences';
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });
const shows = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor();
const box = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true });
const distance = (page: Page, km: number) => page.getByRole('radio', { name: `about ${km} km`, exact: true });
const save = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const TIMES = ['Weekdays, daytime', 'Weekdays, evening', 'Saturday, daytime', 'Saturday, evening', 'Sunday, daytime', 'Sunday, evening'];

test('The page shows what is saved', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'en' });
  const { page } = app;
  await heading(page, 'Pod preferences').waitFor();
  expect(await page.getByText('Me', { exact: true }).first().isVisible()).toBe(true);
  await shows(page, "Who you'd like to meet and when you're free. Changes count from the next drop.");
  await shows(page, '28–42');
  // A chosen distance carries a check mark; the others do not.
  expect(await isTicked(distance(page, 10))).toBe(true);
  for (const km of [5, 15, 25]) expect(await isTicked(distance(page, km))).toBe(false);
  for (const name of ['Danish', 'English']) expect(await isTicked(box(page, name))).toBe(true);
  const ticked = ['Weekdays, evening', 'Saturday, daytime', 'Sunday, daytime'];
  for (const name of TIMES) expect(await isTicked(box(page, name))).toBe(ticked.includes(name));
});

test('Saved changes show on Me', async () => {
  await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: /^Pod preferences/ }).click();
  await heading(page, 'Pod preferences').waitFor();
  await distance(page, 15).click();
  await box(page, 'Danish').click();
  await save(page).click();
  await heading(page, 'Your account').waitFor();
  const row = page.getByRole('link', { name: /^Pod preferences/ });
  const summary = (await row.innerText()).replace(/\u00a0/g, ' ');
  expect(summary).toContain('Ages 28–42 · about 15 km');
  expect(summary.split('\n').map((l) => l.trim())).toContain('English');
  expect(summary).not.toContain('Danish');
});

test('Save needs a language and a time', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'en' });
  const { page } = app;
  await heading(page, 'Pod preferences').waitFor();
  for (const name of ['Danish', 'English']) await box(page, name).click();
  for (const name of TIMES) if (await isTicked(box(page, name))) await box(page, name).click();
  await save(page).click();
  await shows(page, 'Pick at least one language.');
  await shows(page, 'Pick at least one time.');
  expect(await heading(page, 'Pod preferences').isVisible()).toBe(true);
  await box(page, 'English').click();
  await page.getByText('Pick at least one language.', { exact: true }).waitFor({ state: 'detached' });
  expect(await page.getByText('Pick at least one time.', { exact: true }).isVisible()).toBe(true);
});

test('Pod preferences in Danish', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'da' });
  const { page } = app;
  await heading(page, 'Ønsker til pods').waitFor();
  await heading(page, 'Alder').waitFor();
  await shows(page, 'Hvor langt vil du rejse for at mødes?');
  await shows(page, 'Sprog til møderne');
  for (const name of ['Dansk', 'Engelsk']) expect(await box(page, name).count()).toBe(1);
  expect(await page.getByRole('button', { name: 'Gem', exact: true }).isVisible()).toBe(true);
});
