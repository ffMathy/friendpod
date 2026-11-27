// End-to-end check of LockedMeetupPlan (ail/pod-page/plan-meetup/locked-meetup-plan): each test is one of its scenarios,
// by name, played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const PLANNER = '/pod/braetspilpodaarhus46/plan';
const WON = 'Voting has closed: this time won with 3 yes votes.';
const text = (page: Page, t: string) => page.getByText(t, { exact: true });
/** A member's row in the members card: their name and their status, as the row's link names them. */
const memberRow = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(`^${name}\\b`) });

test('The plan once it is locked', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await text(page, 'Your meetup').waitFor();
  expect(await text(page, WON).isVisible()).toBe(true);
  expect(await text(page, 'Saturday 21 Nov, 14:00').isVisible()).toBe(true);
  expect(await text(page, '[Board game café] · Aarhus C').isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Open [Board game café] in Maps', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Add to calendar', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Meeting safely', exact: true }).isVisible()).toBe(true);
  expect(await text(page, "You haven't said if you're coming yet.").isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: "I'm coming", exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: "Can't make it", exact: true }).isVisible()).toBe(true);
  for (const name of ['Mette', 'Jonas', 'Ahmed']) expect(await memberRow(page, name).getByText('Coming', { exact: true }).isVisible()).toBe(true);
  expect(await memberRow(page, 'Sofie').getByText("Hasn't confirmed", { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: /^Yes to / }).count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Done voting', exact: true }).count()).toBe(0);
});

test("Saying I'm coming on the plan", async () => {
  await using app = await openApp({ route: PLANNER, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: "I'm coming", exact: true }).click();
  await text(page, "You're coming.").waitFor();
  expect(await text(page, WON).isVisible()).toBe(true);
  expect(await page.getByText('Your yes counts as').count()).toBe(0);
});

test('Meeting safely opens the safety tips', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Meeting safely', exact: true }).click();
  await text(page, 'In danger right now? Call 112.').waitFor();
  expect(await page.getByRole('heading', { name: 'Meeting safely', exact: true }).isVisible()).toBe(true);
});

test('After the meetup the plan is a record', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member the morning after a meetup', locale: 'en' });
  const { page } = app;
  await text(page, 'Saturday 21 Nov, 14:00').waitFor();
  expect(await text(page, '[Board game café] · Aarhus C').isVisible()).toBe(true);
  expect(await page.getByText('Open in Maps').count()).toBe(0);
  expect(await page.getByText('Add to calendar').count()).toBe(0);
  expect(await page.getByText('Meeting safely').count()).toBe(0);
  expect(await page.getByRole('button', { name: "I'm coming", exact: true }).count()).toBe(0);
});

test('Before the pod is confirmed', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member with a pod proposal', locale: 'en' });
  const { page } = app;
  await text(page, 'The planner opens once the pod is confirmed.').waitFor();
  expect(await text(page, 'Your meetup').isVisible()).toBe(true);
});

test('The plan in Danish', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member the day before a meetup', locale: 'da' });
  const { page } = app;
  await text(page, 'Jeres møde').waitFor();
  expect(await text(page, 'Afstemningen er lukket, og det her tidspunkt vandt med 3 ja-stemmer.').isVisible()).toBe(true);
  expect(await text(page, 'Lørdag 21. nov. kl. 14.00').isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Åbn [Brætspilscafé] i Kort', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Føj til kalender', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Mød hinanden trygt', exact: true }).isVisible()).toBe(true);
});
