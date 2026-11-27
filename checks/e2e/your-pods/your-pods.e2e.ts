// ail-derived-from: YourPods@183e5e4e75f82b1e
// End-to-end check of YourPods (ail/your-pods): each test is one of its scenarios, by name, played through the running
// app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

/** The pod rows, top to bottom, by the theme that starts each link's name. */
async function rows(page: Page): Promise<string[]> {
  const names = await page.getByRole('link').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return names.filter((n) => n.includes('. ')).map((n) => n.split(/[.,] /)[0] ?? '');
}

/** The section headings ("Active · 1", "Past"), top to bottom. */
async function headings(page: Page): Promise<string[]> {
  return (await page.getByRole('heading').allInnerTexts()).map((t) => t.trim());
}

test('Active and past pods are listed apart', async () => {
  await using app = await openApp({ route: '/pods', world: 'member this week' });
  const { page } = app;
  await page.getByText('Past', { exact: false }).first().waitFor();
  expect(await headings(page)).toEqual(['Pods', 'Active · 1', 'Past · 1']);
  expect(await rows(page)).toEqual(['sourdough', 'bouldering']);
});

test('No past pods yet', async () => {
  await using app = await openApp({ route: '/pods', world: 'member with a pod proposal' });
  const { page } = app;
  await page.getByText('No past pods yet.', { exact: true }).waitFor();
  expect(await headings(page)).toEqual(['Pods', 'Active · 1', 'Past']);
  expect(await rows(page)).toEqual(['brætspil']);
});

test('A member with no pods', async () => {
  await using app = await openApp({ route: '/pods', world: 'new member with nothing yet' });
  const { page } = app;
  await page.getByText('No pods yet', { exact: true }).waitFor();
  expect(await page.getByText("Your first pod arrives with a Thursday drop. We'll let you know when it's here.", { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText(/^Active/).count()).toBe(0);
  expect(await page.getByText(/^Past/).count()).toBe(0);
});

test('A row opens its pod', async () => {
  await using app = await openApp({ route: '/pods', world: 'member this week' });
  const { page } = app;
  await page.getByRole('link', { name: /^sourdough\. / }).click();
  await page.getByText('4 people near Aarhus C', { exact: true }).waitFor();
  expect(new URL(page.url()).pathname).toMatch(/^\/pod\/sourdough/);
});

test('A pod said no to leaves the list', async () => {
  await using app = await openApp({ route: '/pods', world: 'member with a pod proposal' });
  const { page } = app;
  await page.getByRole('link', { name: /^brætspil\. / }).click();
  await page.getByRole('button', { name: 'Not this time', exact: true }).click();
  await page.getByRole('button', { name: 'Decline this pod', exact: true }).click();
  await page.getByText('You said no', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Pods' }).click();
  await page.getByText('No pods yet', { exact: true }).waitFor();
  expect(await rows(page)).toEqual([]);
});

test('The Pods tab in Danish', async () => {
  await using app = await openApp({ route: '/pods', world: 'member this week', locale: 'da' });
  const { page } = app;
  await page.getByText('Arkiveret', { exact: true }).waitFor();
  expect(await headings(page)).toEqual(['Pods', 'Aktive · 1', 'Tidligere · 1']);
  expect(await page.getByText('Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg', { exact: true }).isVisible()).toBe(true);
});
