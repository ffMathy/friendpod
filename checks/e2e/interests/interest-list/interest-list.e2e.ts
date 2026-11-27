// ail-derived-from: InterestList@038eff64c520e625
// End-to-end check of InterestList (ail/interests/interest-list): each test is one of its scenarios, by name, played
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
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('"…" opens the row\'s actions', async () => {
  await using app = await onInterests();
  const { page } = app;
  // far på barsel keeps its own Keep this private in its row, so one shows before anything is opened.
  expect(await button(page, 'Keep this private').count()).toBe(1);
  await button(page, 'More for sourdough').click();
  await button(page, 'Remove sourdough').waitFor();
  expect(await button(page, 'Keep this private').count()).toBe(2);
  await button(page, 'More for sourdough').click();
  await button(page, 'Remove sourdough').waitFor({ state: 'detached' });
  expect(await button(page, 'Keep this private').count()).toBe(1);
});

test('Remove takes an interest off the list at once', async () => {
  await using app = await onInterests();
  const { page } = app;
  await page.getByText('5 of 20', { exact: true }).waitFor();
  await button(page, 'More for sourdough').click();
  await button(page, 'Remove sourdough').click();
  await page.getByText('4 of 20', { exact: true }).waitFor();
  expect(await button(page, 'More for sourdough').count()).toBe(0);
  expect(await page.getByText('sourdough', { exact: true }).count()).toBe(0);
  expect(await page.getByText('Add at least 3. 5 or more gives better pods.', { exact: true }).isVisible()).toBe(true);
});

test('An interest made ordinary keeps Keep this private at hand', async () => {
  await using app = await onInterests();
  const { page } = app;
  // Its name is the only "More for far på barsel" control, and Keep this private stands in its row.
  const name = button(page, 'More for far på barsel');
  expect(await name.textContent()).toBe('far på barsel');
  expect(await button(page, 'Keep this private').count()).toBe(1);
  await name.click();
  await button(page, 'Remove far på barsel').waitFor();
  expect(await button(page, 'Keep this private').count()).toBe(1);
});

test("The row's actions in Danish", async () => {
  await using app = await onInterests('da');
  const { page } = app;
  await button(page, 'Flere valg for brætspil').click();
  await button(page, 'Fjern brætspil').waitFor();
  expect(await page.getByText('Fjern', { exact: true }).isVisible()).toBe(true);
  expect(await button(page, 'Hold den privat').count()).toBe(2);
});
