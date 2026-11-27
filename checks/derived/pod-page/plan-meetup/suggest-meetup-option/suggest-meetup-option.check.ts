// ail-derived-from: SuggestMeetupOption@0642c6f363504011
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const POD_ID = 'braetspilpodaarhus46';
const PLAN_ROUTE = `/pod/${POD_ID}/plan`;
const PROPOSE_ROUTE = `/pod/${POD_ID}/propose`;
const TIMEOUT = 180_000;

type App = Awaited<ReturnType<typeof openApp>>;

const OPTION_PATTERN = /(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\s\d{1,2}\sNov\W+\d{2}:\d{2}/g;

async function pageText(app: App): Promise<string> {
  return app.page.locator('body').innerText();
}

function countOptions(text: string): number {
  return (text.match(OPTION_PATTERN) ?? []).length;
}

async function pickDay(app: App, day: RegExp): Promise<void> {
  await app.page.getByRole('button', { name: /^Day, / }).click();
  const dialog = app.page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('radio', { name: day }).first().click();
}

async function pickTime(app: App, time: string): Promise<void> {
  await app.page.getByRole('button', { name: /^Time, / }).click();
  const dialog = app.page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('radio', { name: time, exact: true }).click();
}

async function searchPlace(app: App, query: string): Promise<void> {
  await app.page.getByRole('textbox', { name: 'Place' }).fill(query);
}

test(
  'The form opens from the planner',
  async () => {
    await using app = await openApp({ route: PLAN_ROUTE, world: 'member planning a meetup', locale: 'en' });
    await app.page.getByRole('button', { name: 'Suggest another time' }).click();
    await app.page.getByText('Suggest a time', { exact: true }).waitFor({ state: 'visible' });
    await app.page.getByRole('button', { name: 'Day, Pick a day', exact: true }).waitFor({ state: 'visible' });
    await app.page.getByRole('button', { name: 'Time, Pick a time', exact: true }).waitFor({ state: 'visible' });
    const place = app.page.getByRole('textbox', { name: 'Place' });
    await place.waitFor({ state: 'visible' });
    expect(await place.inputValue()).toBe('');
    await app.page
      .getByText('Cafés, bars, libraries, parks and other public places near the pod.')
      .waitFor({ state: 'visible' });
    await app.saveScreen('the-form-opens-from-the-planner.png');
  },
  TIMEOUT,
);

test(
  'Sending without a day and a time is refused',
  async () => {
    await using app = await openApp({ route: PROPOSE_ROUTE, world: 'member planning a meetup', locale: 'en' });
    await app.page.getByRole('button', { name: 'Suggest this time', exact: true }).click();
    await app.page.getByText('Pick a day and a time.').waitFor({ state: 'visible' });
    await app.saveScreen('sending-without-a-day-and-a-time-is-refused.png');
  },
  TIMEOUT,
);

test(
  'Sending without a place is refused',
  async () => {
    await using app = await openApp({ route: PROPOSE_ROUTE, world: 'member planning a meetup', locale: 'en' });
    await pickDay(app, /^Sun(day)? 22 Nov/);
    await pickTime(app, '15:00');
    await app.page.getByRole('button', { name: 'Suggest this time', exact: true }).click();
    await app.page.getByText('Pick a public place from the list.').waitFor({ state: 'visible' });
    await app.saveScreen('sending-without-a-place-is-refused.png');
  },
  TIMEOUT,
);

test(
  'A time that has passed is refused',
  async () => {
    await using app = await openApp({ route: PROPOSE_ROUTE, world: 'member planning a meetup', locale: 'en' });
    await pickTime(app, '08:00');
    await pickDay(app, /^Mon(day)? 16 Nov/);
    await searchPlace(app, 'café');
    const cafes = app.page.getByRole('button', { name: /, Café, Aarhus C$/ });
    await cafes.first().waitFor({ state: 'visible' });
    const names = await cafes.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent ?? ''));
    const index = names.findIndex((name) => !name.includes('Latin Quarter'));
    expect(index).toBeGreaterThanOrEqual(0);
    await cafes.nth(index).click();
    await app.page.getByRole('button', { name: 'Suggest this time', exact: true }).click();
    await app.page.getByText('Pick a time within 14 days, between 08:00 and 22:00.').waitFor({ state: 'visible' });
    await app.saveScreen('a-time-that-has-passed-is-refused.png');
  },
  TIMEOUT,
);

test(
  'A suggestion joins the planner',
  async () => {
    await using app = await openApp({ route: PLAN_ROUTE, world: 'member planning a meetup', locale: 'en' });
    const suggestAnother = app.page.getByRole('button', { name: 'Suggest another time' });
    await suggestAnother.waitFor({ state: 'visible' });
    const before = countOptions(await pageText(app));
    await suggestAnother.click();
    await pickDay(app, /^Sun(day)? 22 Nov/);
    await pickTime(app, '15:00');
    await searchPlace(app, 'café');
    const latin = app.page.getByRole('button', { name: /Latin Quarter/ }).first();
    await latin.waitFor({ state: 'visible' });
    await latin.click();
    await app.page.getByRole('button', { name: 'Suggest this time', exact: true }).click();
    await app.page.getByText(/Latin Quarter, Aarhus C/).first().waitFor({ state: 'visible' });
    const after = await pageText(app);
    expect(after).toMatch(/Sunday\s22\sNov,\s15:00\s+\[Café name\], Latin Quarter, Aarhus C/);
    expect(countOptions(after)).toBe(before + 1);
    expect(await app.page.getByRole('button', { name: 'Suggest another time' }).count()).toBe(0);
    await app.saveScreen('a-suggestion-joins-the-planner.png');
  },
  TIMEOUT,
);

test(
  'Close returns to the planner',
  async () => {
    await using app = await openApp({ route: PLAN_ROUTE, world: 'member in the extra planning round', locale: 'en' });
    await app.page.getByRole('button', { name: /Suggest another time|add another option/ }).first().click();
    await app.page.getByText('Suggest a time', { exact: true }).waitFor({ state: 'visible' });
    await app.page.getByRole('button', { name: 'Close', exact: true }).click();
    await app.page.getByText('No time works yet — add another option').first().waitFor({ state: 'visible' });
    await app.saveScreen('close-returns-to-the-planner.png');
  },
  TIMEOUT,
);

test(
  'The form once the plan is locked',
  async () => {
    await using app = await openApp({ route: PROPOSE_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    await app.page.getByText('The planner opens once the pod is confirmed.').waitFor({ state: 'visible' });
    await app.saveScreen('the-form-once-the-plan-is-locked.png');
  },
  TIMEOUT,
);

test(
  'The form in Danish',
  async () => {
    await using app = await openApp({ route: PROPOSE_ROUTE, world: 'member planning a meetup', locale: 'da' });
    await app.page.getByText('Foreslå et tidspunkt', { exact: true }).waitFor({ state: 'visible' });
    await app.page.getByRole('button', { name: 'Foreslå dette tidspunkt', exact: true }).click();
    await app.page.getByText('Vælg en dag og et tidspunkt.').waitFor({ state: 'visible' });
    await app.saveScreen('the-form-in-danish.png');
  },
  TIMEOUT,
);
