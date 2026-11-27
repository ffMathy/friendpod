// End-to-end check of NoPodThisWeek (ail/home/no-pod-this-week): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const link = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).filter({ visible: true }).first();

/** The top edge of each link, to read their order as the user sees it. */
async function tops(page: Page, names: string[]): Promise<number[]> {
  const out: number[] = [];
  for (const name of names) {
    const box = await link(page, name).boundingBox();
    if (!box) throw new Error(`not shown: ${name}`);
    out.push(box.y);
  }
  return out;
}
const inOrder = (ys: number[]) => ys.every((y, i) => i === 0 || (ys[i - 1] ?? y) < y);

test('No pod this week', async () => {
  await using app = await openApp({ route: '/', world: 'member with no pod this week' });
  const { page } = app;
  await heading(page, 'This week').waitFor();
  await shown(page, 'Week 46').waitFor();
  await heading(page, 'No pod for you this week').waitFor();
  await shown(page, "Not enough people near you shared one of your interests and fit everyone's settings this time.").waitFor();
  await shown(page, "You'll get priority next week.").waitFor();
  await heading(page, 'Things that often help').waitFor();
  expect(inOrder(await tops(page, ['Add a few more interests', 'Try about 15 km']))).toBe(true);
  await page.getByRole('switch', { name: 'Open to meeting anyone' }).waitFor();
  await shown(page, 'A pod without a shared theme').waitFor();
  await shown(page, 'Next drop: Thursday 18:00').waitFor();
});

test('The reason names the setting', async () => {
  await using app = await openApp({ route: '/', world: 'member kept out by a setting' });
  const { page } = app;
  await shown(page, 'Your distance setting leaves too few people near you to form a pod.').waitFor();
  expect(inOrder(await tops(page, ['Try about 15 km', 'Add a few more interests']))).toBe(true);
});

test('A tip opens the setting', async () => {
  await using app = await openApp({ route: '/', world: 'member kept out by a setting' });
  const { page } = app;
  await link(page, 'Try about 15 km').click();
  await heading(page, 'Pod preferences').waitFor();
});

test('A tip opens the interests', async () => {
  await using app = await openApp({ route: '/', world: 'member with no pod this week' });
  const { page } = app;
  await link(page, 'Add a few more interests').click();
  await heading(page, 'Interests').waitFor();
  await page.getByRole('tab', { name: 'Interests', selected: true }).waitFor();
});

test('No pod in Danish', async () => {
  await using app = await openApp({ route: '/', world: 'member kept out by a setting', locale: 'da' });
  const { page } = app;
  await heading(page, 'Denne uge').waitFor();
  await heading(page, 'Ingen pod i denne uge').waitFor();
  await shown(page, 'Med den afstand, du har valgt, er der for få i nærheden til at samle en pod.').waitFor();
  await shown(page, 'Du får forrang i næste uge.').waitFor();
  await heading(page, 'Det hjælper ofte').waitFor();
  await link(page, 'Prøv med ca. 15 km').waitFor();
  await link(page, 'Tilføj et par interesser mere').waitFor();
  await page.getByRole('switch', { name: 'Åben for at møde alle' }).waitFor();
  await shown(page, 'Næste drop: torsdag kl. 18.00').waitFor();
});
