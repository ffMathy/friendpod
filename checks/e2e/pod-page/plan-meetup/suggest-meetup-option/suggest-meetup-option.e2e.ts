// End-to-end check of SuggestMeetupOption (ail/pod-page/plan-meetup/suggest-meetup-option): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees: labels, roles and the
// copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const PLANNER = '/pod/braetspilpodaarhus46/plan';
const FORM = '/pod/braetspilpodaarhus46/propose';
const text = (page: Page, t: string) => page.getByText(t, { exact: true });
const send = (page: Page) => page.getByRole('button', { name: 'Suggest this time', exact: true }).click();

async function pickDay(page: Page, day: string) {
  await page.getByRole('button', { name: /^Day, / }).click();
  await page.getByRole('radio', { name: day, exact: true }).click();
}
async function pickTime(page: Page, time: string) {
  await page.getByRole('button', { name: /^Time, / }).click();
  await page.getByRole('radio', { name: time, exact: true }).click();
}
async function pickPlace(page: Page, search: string, place: string) {
  await page.getByRole('textbox', { name: 'Place', exact: true }).fill(search);
  const card = page.getByRole('button', { name: new RegExp(`^${place.replace(/[[\]]/g, '\\$&')}, `) });
  await card.click();
  await card.getByRole('img', { name: 'Selected' }).waitFor();
}

test('The form opens from the planner', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Suggest another time (1 spot left)', exact: true }).click();
  await page.getByRole('heading', { name: 'Suggest a time', exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Day, Pick a day', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Time, Pick a time', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('textbox', { name: 'Place', exact: true }).inputValue()).toBe('');
  expect(await text(page, 'Cafés, bars, libraries, parks and other public places near the pod.').isVisible()).toBe(true);
});

test('Sending without a day and a time is refused', async () => {
  await using app = await openApp({ route: FORM, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await send(page);
  await text(page, 'Pick a day and a time.').waitFor();
});

test('Sending without a place is refused', async () => {
  await using app = await openApp({ route: FORM, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await pickDay(page, 'Sunday 22 Nov');
  await pickTime(page, '15:00');
  await send(page);
  await text(page, 'Pick a public place from the list.').waitFor();
});

test('A time that has passed is refused', async () => {
  await using app = await openApp({ route: FORM, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await pickTime(page, '08:00');
  await pickDay(page, 'Monday 16 Nov');
  await pickPlace(page, 'café', '[Café bar name]');
  await send(page);
  await text(page, 'Pick a time within 14 days, between 08:00 and 22:00.').waitFor();
});

test('A suggestion joins the planner', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Suggest another time (1 spot left)', exact: true }).click();
  await pickDay(page, 'Sunday 22 Nov');
  await pickTime(page, '15:00');
  await pickPlace(page, 'café', '[Café name], Latin Quarter');
  await send(page);
  await page.getByRole('heading', { name: 'Sunday 22 Nov, 15:00', exact: true }).waitFor();
  expect(await text(page, '[Café name], Latin Quarter, Aarhus C').isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: /^Suggest (another time|a time)/ }).count()).toBe(0);
});

test('Close returns to the planner', async () => {
  await using app = await openApp({ route: PLANNER, world: 'member in the extra planning round', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Suggest another time (1 spot left)', exact: true }).click();
  await page.getByRole('heading', { name: 'Suggest a time', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await text(page, 'No time works yet — add another option').waitFor();
  expect(await page.getByRole('heading', { name: 'Suggest a time', exact: true }).count()).toBe(0);
});

test('The form once the plan is locked', async () => {
  await using app = await openApp({ route: FORM, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await text(page, 'The planner opens once the pod is confirmed.').waitFor();
  expect(await page.getByRole('button', { name: 'Suggest this time', exact: true }).count()).toBe(0);
});

test('The form in Danish', async () => {
  await using app = await openApp({ route: FORM, world: 'member planning a meetup', locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Foreslå et tidspunkt', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Foreslå dette tidspunkt', exact: true }).click();
  await text(page, 'Vælg en dag og et tidspunkt.').waitFor();
});
