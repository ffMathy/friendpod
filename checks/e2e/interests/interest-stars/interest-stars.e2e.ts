// End-to-end check of InterestStars (ail/interests/interest-stars): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

async function onInterests(locale: 'en' | 'da' = 'en') {
  const app = await openApp({ route: '/interests', world: 'member this week', locale });
  await app.page.getByText(locale === 'en' ? '5 of 20' : '5 af 20', { exact: true }).waitFor();
  return app;
}
const star = (page: Page, name: string, locale: 'en' | 'da' = 'en') =>
  page.getByLabel(`${locale === 'en' ? 'Star' : 'Stjernemarkér'} ${name}`, { exact: true });

/**
 * Whether a star is filled, as a user sees it. (The star's toggle state is not exposed on the web: react-native-web
 * drops it, as it does for checkboxes, so this reads whether the drawn star has a fill, like the harness's isTicked.)
 */
async function isFilled(box: Locator): Promise<boolean> {
  const fill = await box.locator('svg path').first().getAttribute('fill');
  return fill !== null && fill !== 'none';
}

async function press(box: Locator) {
  const before = await isFilled(box);
  await box.click();
  await box.page().waitForTimeout(400);
  return before;
}

test('A fourth main interest is refused', async () => {
  await using app = await onInterests();
  const { page } = app;
  expect(await isFilled(star(page, 'brætspil'))).toBe(true);
  await press(star(page, 'sourdough'));
  await press(star(page, 'trail running'));
  for (const name of ['brætspil', 'sourdough', 'trail running']) expect(await isFilled(star(page, name))).toBe(true);
  await press(star(page, 'far på barsel'));
  await page.getByText('You can star up to 3 interests.', { exact: true }).waitFor();
  expect(await isFilled(star(page, 'far på barsel'))).toBe(false);
});

test('Unstarring makes room, and the message stays', async () => {
  await using app = await onInterests();
  const { page } = app;
  await press(star(page, 'sourdough'));
  await press(star(page, 'trail running'));
  await press(star(page, 'far på barsel'));
  await page.getByText('You can star up to 3 interests.', { exact: true }).waitFor();
  await press(star(page, 'brætspil'));
  await press(star(page, 'far på barsel'));
  expect(await isFilled(star(page, 'far på barsel'))).toBe(true);
  expect(await isFilled(star(page, 'brætspil'))).toBe(false);
  expect(await page.getByText('You can star up to 3 interests.', { exact: true }).isVisible()).toBe(true);
});

test('The star limit in Danish', async () => {
  await using app = await onInterests('da');
  const { page } = app;
  for (const name of ['sourdough', 'trail running', 'far på barsel']) await press(star(page, name, 'da'));
  await page.getByText('Du kan stjernemarkere op til 3 interesser.', { exact: true }).waitFor();
});
