// End-to-end check of PodPage (ail/pod-page): each test is one of its scenarios, by name, played through the running
// app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Locator } from 'playwright';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const BRAETSPIL = '/pod/braetspilpodaarhus46';

/** Whether a tab is drawn selected, as the user sees it: its icon sits on the active pill (color.tab.active.bg). */
const looksSelected = (tab: Locator) =>
  tab.evaluate((node) => [node, ...node.querySelectorAll('*')].some((e) => getComputedStyle(e).backgroundColor === 'rgb(225, 239, 233)'));

test('A pod that no longer exists', async () => {
  await using app = await openApp({ route: '/pod/doesnotexist', world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  await page.getByText('This pod no longer exists.', { exact: true }).waitFor();
  for (const tab of ['This week', 'Pods', 'Interests', 'Me']) {
    expect(await page.getByRole('tab', { name: tab, exact: true }).isVisible()).toBe(true);
  }
  expect(await looksSelected(page.getByRole('tab', { name: 'Pods', exact: true }))).toBe(true);
  for (const tab of ['This week', 'Interests', 'Me']) {
    expect(await looksSelected(page.getByRole('tab', { name: tab, exact: true }))).toBe(false);
  }
});

test('Back from a pod opened on its own goes to the Pods tab', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText(/^Active/).first().waitFor();
  expect(await page.getByText('brætspil', { exact: true }).first().isVisible()).toBe(true);
  expect(await page.getByText('Still coming tomorrow at 14:00?', { exact: true }).count()).toBe(0);
});

test('A tab leaves the pod', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Plan the meetup', exact: true }).waitFor();
  await page.getByRole('tab', { name: 'This week', exact: true }).click();
  await page.getByRole('heading', { name: 'This week', exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Plan the meetup', exact: true }).count()).toBe(0);
});

test('A pod that no longer exists, in Danish', async () => {
  await using app = await openApp({ route: '/pod/doesnotexist', world: 'member of a confirmed pod', locale: 'da' });
  await app.page.getByText('Denne pod findes ikke længere.', { exact: true }).waitFor();
});
