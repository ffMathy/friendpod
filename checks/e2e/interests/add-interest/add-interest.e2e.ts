// End-to-end check of AddInterest (ail/interests/add-interest): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

async function onInterests(locale: 'en' | 'da' = 'en') {
  const app = await openApp({ route: '/interests', world: 'member this week', locale });
  await app.page.getByText(locale === 'en' ? '5 of 20' : '5 af 20', { exact: true }).waitFor();
  return app;
}
const field = (page: Page, locale: 'en' | 'da' = 'en') =>
  page.getByLabel(locale === 'en' ? 'Add an interest in your own words' : 'Tilføj en interesse med egne ord', { exact: true });

async function add(page: Page, text: string, locale: 'en' | 'da' = 'en') {
  await field(page, locale).fill(text);
  await page.getByRole('button', { name: locale === 'en' ? 'Add' : 'Tilføj', exact: true }).click();
}

async function listed(page: Page): Promise<string[]> {
  const names = await page.getByRole('button', { name: /^More for / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return names.map((n) => n.replace(/^More for /, ''));
}

test('A new interest is added at the end of the list', async () => {
  await using app = await onInterests();
  const { page } = app;
  await page.getByText('5 of 20', { exact: true }).waitFor();
  await add(page, 'climbing');
  await page.getByText('Added.', { exact: true }).waitFor();
  await page.getByText('6 of 20', { exact: true }).waitFor();
  expect((await listed(page)).at(-1)).toBe('climbing');
  expect(await field(page).inputValue()).toBe('');
});

test('An interest of one character is refused', async () => {
  await using app = await onInterests();
  const { page } = app;
  await add(page, 'a');
  await page.getByText('An interest needs at least 2 characters.', { exact: true }).waitFor();
  expect(await field(page).inputValue()).toBe('a');
  expect(await page.getByText('5 of 20', { exact: true }).isVisible()).toBe(true);
});

test('An interest of more than 40 characters is refused', async () => {
  await using app = await onInterests();
  const { page } = app;
  await add(page, 'x'.repeat(41));
  await page.getByText('An interest can have at most 40 characters.', { exact: true }).waitFor();
});

test('Contact details are refused', async () => {
  await using app = await onInterests();
  const { page } = app;
  await add(page, 'call me 12345678');
  await page.getByText('Interests cannot contain contact details such as phone numbers, emails, links or handles.', { exact: true }).waitFor();
  expect(await field(page).inputValue()).toBe('call me 12345678');
  expect(await page.getByText('5 of 20', { exact: true }).isVisible()).toBe(true);
});

test("Someone else's sensitive situation is refused", async () => {
  await using app = await onInterests();
  const { page } = app;
  await add(page, 'min datters diabetes');
  await page
    .getByText(
      "This seems to describe someone else's sensitive situation. Describe your own instead, for example “parent of an autistic child”.",
      { exact: true },
    )
    .waitFor();
  expect(await page.getByText('5 of 20', { exact: true }).isVisible()).toBe(true);
});

test('Adding in Danish', async () => {
  await using app = await onInterests('da');
  const { page } = app;
  await add(page, 'klatring', 'da');
  await page.getByText('Tilføjet.', { exact: true }).waitFor();
  await page.getByText('6 af 20', { exact: true }).waitFor();
  await add(page, 'a', 'da');
  await page.getByText('En interesse skal have mindst 2 tegn.', { exact: true }).waitFor();
});
