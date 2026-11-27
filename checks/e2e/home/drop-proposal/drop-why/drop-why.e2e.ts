// ail-derived-from: DropWhy@7b581fdec9dd6dc0
// End-to-end check of DropWhy (ail/home/drop-proposal/drop-why): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const ROUTE = '/sheets/why-this-pod?podId=braetspilpodaarhus46';
const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();

/** Opens Why this pod the way a member does: from the proposal on Home. */
async function fromHome(page: Page) {
  await page.getByRole('link', { name: 'Why this pod?' }).click();
  await heading(page, 'Why this pod').waitFor();
}

test('The reasons for the brætspil pod', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal' });
  const { page } = app;
  await heading(page, 'Why this pod').waitFor();
  const lines = [
    'Everyone added brætspil, or something that means the same.',
    'You also share sourdough and trail running with some of them.',
    'Everyone lives about 10 km or less from you, near Aarhus C.',
    "Ages 29–38: everyone is inside everyone else's age range.",
    'You waited 2 weeks, so you got priority this time.',
  ];
  const tops: number[] = [];
  for (const line of lines) {
    const box = await shown(page, line).boundingBox();
    if (!box) throw new Error(`not shown: ${line}`);
    tops.push(box.y);
  }
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  await shown(page, 'What we never use').waitFor();
  await shown(
    page,
    "Photos, looks, or anything you haven't told us. Gender only if you chose same-gender pods. Private interests only as the theme of a pod about them.",
  ).waitFor();
  await page.getByRole('link', { name: 'How matching works' }).waitFor();
});

test('Close returns to the proposal', async () => {
  await using app = await openApp({ route: '/', world: 'member with a pod proposal' });
  const { page } = app;
  await fromHome(page);
  await page.getByRole('button', { name: 'Close' }).click();
  await heading(page, 'Why this pod').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: "I'm in" }).waitFor();
});

test('Tapping beside the sheet closes it', async () => {
  await using app = await openApp({ route: '/', world: 'member with a pod proposal' });
  const { page } = app;
  await fromHome(page);
  await page.mouse.click(195, 100);
  await heading(page, 'Why this pod').waitFor({ state: 'detached' });
  expect(await page.getByRole('button', { name: "I'm in" }).isVisible()).toBe(true);
});

test('How matching works from the sheet', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal' });
  const { page } = app;
  await page.getByRole('link', { name: 'How matching works' }).click();
  await heading(page, 'How matching works').waitFor();
  await heading(page, 'What we use').waitFor();
});

test('Why this pod in Danish', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'da' });
  const { page } = app;
  await heading(page, 'Hvorfor denne pod').waitFor();
  await shown(page, 'Alle har tilføjet brætspil eller noget, der betyder det samme.').waitFor();
  await shown(page, 'Du har ventet 2 uger, så du fik forrang denne gang.').waitFor();
  await shown(page, 'Det bruger vi aldrig').waitFor();
  await page.getByRole('link', { name: 'Sådan matcher vi' }).waitFor();
});
