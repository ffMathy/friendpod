// ail-derived-from: InfoPages@4a68795eb787ebbe
// End-to-end check of InfoPages (ail/info-pages): each test is one of its scenarios, by name, played through the
// running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });
const tabBar = (page: Page) => page.getByRole('tablist');

test('How matching works opens from Me and goes back', async () => {
  await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'How matching works', exact: true }).click();
  await heading(page, 'How matching works').waitFor();
  expect(page.url()).toContain('/info/how-matching-works');
  expect(await page.getByRole('button', { name: 'Back', exact: true }).isVisible()).toBe(true);
  expect(await tabBar(page).last().isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForURL(/\/me/);
  await heading(page, 'Me').waitFor();
  expect(await heading(page, 'How matching works').count()).toBe(0);
});

test('Pause matching leads to Me', async () => {
  await using app = await openApp({ route: '/info/how-matching-works', world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: /^Pause matching/ }).click();
  await heading(page, 'Weekly drops').waitFor();
  expect(page.url()).toMatch(/\/me$/);
  expect(await page.getByRole('button', { name: 'Pause matching', exact: true }).isVisible()).toBe(true);
});

test('Signed out, the page only says matching can be paused', async () => {
  await using app = await openApp({ route: '/info/how-matching-works', world: 'signed out', locale: 'en' });
  const { page } = app;
  await heading(page, 'How matching works').waitFor();
  expect(await page.getByText('You can pause matching at any time.', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: /Pause matching/ }).count()).toBe(0);
  expect(await page.getByText('Pause matching', { exact: true }).count()).toBe(0);
  expect(await tabBar(page).count()).toBe(0);
});

test('The Terms open from the welcome screen and go back', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Terms', exact: true }).click();
  await heading(page, 'Terms').waitFor();
  expect(await page.getByText('Draft', { exact: true }).isVisible()).toBe(true);
  expect(await tabBar(page).count()).toBe(0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
  expect(await heading(page, 'Terms').count()).toBe(0);
});

test('The privacy notice from the welcome screen in Danish', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'da' });
  const { page } = app;
  await page.getByRole('link', { name: 'privatlivserklæringen', exact: true }).click();
  await heading(page, 'Privatlivserklæring').waitFor();
  expect(await page.getByText('Udkast', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Version fra november 2026', { exact: true }).isVisible()).toBe(true);
});

test('Read more on the consent step opens Private interests full screen', async () => {
  await using app = await openApp({ route: '/sensitive-consent', world: 'member choosing about private interests', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Read more about sensitive interests', exact: true }).click();
  await heading(page, 'Private interests').waitFor();
  expect(page.url()).toContain('/info/sensitive-interests');
  expect(await tabBar(page).count()).toBe(0);
});
