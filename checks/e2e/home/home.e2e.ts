// End-to-end check of Home (ail/home): each test is one of its scenarios, by name, played through the running app as a
// user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

/** The visible element with exactly this text (tab pages stay mounted, hidden, once opened). */
const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const count = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).count();

test('The no-pod answer ends with its week', async () => {
  await using app = await openApp({ route: '/', world: 'new member with nothing yet' });
  const { page } = app;
  await heading(page, 'This week').waitFor();
  await shown(page, 'Next drop').waitFor();
  await shown(page, 'Thursday 18:00').waitFor();
  expect(await count(page, 'No pod for you this week')).toBe(0);
});

test('The tabs lead to Pods, Interests and Me', async () => {
  await using app = await openApp({ route: '/', world: 'member this week' });
  const { page } = app;
  await heading(page, 'This week').waitFor();
  await page.getByRole('tab', { name: 'Pods' }).click();
  await heading(page, 'Pods').waitFor();
  await heading(page, 'Active · 1').waitFor();
  await heading(page, 'Past · 1').waitFor();
  await page.getByRole('tab', { name: 'Interests' }).click();
  await heading(page, 'Interests').waitFor();
  await page.getByRole('tab', { name: 'Me' }).click();
  await heading(page, 'Me').waitFor();
  await heading(page, 'Weekly drops').waitFor();
  await page.getByRole('tab', { name: 'This week' }).click();
  await heading(page, "What we'll match on").waitFor();
});
