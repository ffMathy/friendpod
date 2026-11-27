// End-to-end check of PlanMeetup (ail/pod-page/plan-meetup): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const PLANNER = '/pod/braetspilpodaarhus46/plan';
const SATURDAY = 'Saturday 21 Nov, 14:00';
const SUNDAY = 'Sunday 22 Nov, 11:00';

const text = (page: Page, t: string) => page.getByText(t, { exact: true });
/** The option card with this time: the innermost block holding both its time and its own Yes button. */
const option = (page: Page, when: string, yes = 'Yes to') =>
  page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: when, exact: true }) })
    .filter({ has: page.getByRole('button', { name: `${yes} ${when}`, exact: true }) })
    .last();
const isLeading = async (page: Page, when: string) => (await option(page, when).getByText('Leading', { exact: true }).count()) > 0;

test('The planner shows the options to vote on', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await text(page, 'Plan the meetup').waitFor();
  expect(await text(page, 'Voting closes Tuesday 18:00').isVisible()).toBe(true);
  expect(await option(page, SATURDAY).getByText('[Board game café], Aarhus C', { exact: true }).isVisible()).toBe(true);
  expect(await option(page, SATURDAY).getByText('3 yes', { exact: true }).isVisible()).toBe(true);
  expect(await isLeading(page, SATURDAY)).toBe(true);
  expect(await option(page, SUNDAY).getByText('[Library café], Aarhus harbour', { exact: true }).isVisible()).toBe(true);
  expect(await option(page, SUNDAY).getByText('2 yes', { exact: true }).isVisible()).toBe(true);
  expect(await isLeading(page, SUNDAY)).toBe(false);
  expect(await page.getByRole('button', { name: 'Suggest another time (1 spot left)', exact: true }).isEnabled()).toBe(true);
  expect(await page.getByRole('button', { name: 'Done voting', exact: true }).isEnabled()).toBe(true);
  expect(await page.getByText(/Press and hold an option to report it\.$/).isVisible()).toBe(true);
});

test('A yes and a yes taken back move the lead', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: `Yes to ${SUNDAY}`, exact: true }).click();
  await option(page, SUNDAY).getByText('3 yes', { exact: true }).waitFor();
  expect(await isLeading(page, SATURDAY)).toBe(true);
  expect(await isLeading(page, SUNDAY)).toBe(false);
  await page.getByRole('button', { name: `Yes to ${SATURDAY}`, exact: true }).click();
  await option(page, SATURDAY).getByText('2 yes', { exact: true }).waitFor();
  expect(await isLeading(page, SUNDAY)).toBe(true);
  expect(await isLeading(page, SATURDAY)).toBe(false);
});

test('Done voting returns to the pod', async () => {
  await using app = await openApp({ route: '/pod/braetspilpodaarhus46', world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Plan the meetup', exact: true }).click();
  await page.getByRole('button', { name: 'Done voting', exact: true }).click();
  await page.getByRole('heading', { name: 'brætspil', exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Done voting', exact: true }).count()).toBe(0);
});

test('A pod with no options yet', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  await text(page, 'No times yet. Suggest a time and a public place, and the others can vote on it.').waitFor();
  expect(await page.getByRole('button', { name: 'Suggest a time (3 spots left)', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Back to the pod', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Press and hold an option to report it.').count()).toBe(0);
});

test('The planner in Danish', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'da' });
  const { page } = app;
  await text(page, 'Planlæg mødet').waitFor();
  expect(await text(page, 'Afstemningen lukker tirsdag kl. 18.00').isVisible()).toBe(true);
  expect(await option(page, 'Lørdag 21. nov. kl. 14.00', 'Ja til').getByText('Fører', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Foreslå et nyt tidspunkt (1 ledig plads)', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Færdig med at stemme', exact: true }).isVisible()).toBe(true);
});
