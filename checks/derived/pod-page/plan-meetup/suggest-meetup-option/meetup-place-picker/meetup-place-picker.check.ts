// ail-derived-from: MeetupPlacePicker@2eea0e88fc1b8edf
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/propose';
const WORLD = 'member planning a meetup';
const TIMEOUT = 180_000;

/** Every place result is a button named "name, kind, area"; all places in these worlds are in Aarhus C. */
const PLACE_RESULT = /, [^,]+, Aarhus C$/;

async function waitUntil(condition: () => Promise<boolean>, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  for (;;) {
    if (await condition()) {
      return;
    }
    if (Date.now() > end) {
      throw new Error('condition not met in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function placeResults(page: Page): Locator {
  return page.getByRole('button', { name: PLACE_RESULT });
}

async function textOf(locator: Locator): Promise<string> {
  return (await locator.textContent()) ?? '';
}

async function isBelow(lower: Locator, upper: Locator): Promise<boolean> {
  const a = await lower.boundingBox();
  const b = await upper.boundingBox();
  if (a === null || b === null) {
    return false;
  }
  return a.y >= b.y + b.height - 1;
}

test(
  'Searching shows public places',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await page.getByRole('textbox', { name: 'Place' }).fill('café');
    const results = placeResults(page);
    await waitUntil(async () => (await results.count()) === 3);

    const first = results.nth(0);
    const second = results.nth(1);
    const third = results.nth(2);
    await expect(page.getByRole('button', { name: /, Latin Quarter, Café, Aarhus C$/ }).count()).resolves.toBe(1);

    const firstText = await textOf(first);
    expect(firstText).toContain('Latin Quarter');
    expect(firstText).toContain('Café · Aarhus C');
    expect(await textOf(second)).toContain('Café · Aarhus C');
    expect(await textOf(third)).toContain('Bakery · Aarhus C');

    const firstBox = await first.boundingBox();
    const secondBox = await second.boundingBox();
    const thirdBox = await third.boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(thirdBox).not.toBeNull();
    if (firstBox !== null && secondBox !== null && thirdBox !== null) {
      expect(secondBox.y).toBeGreaterThan(firstBox.y);
      expect(thirdBox.y).toBeGreaterThan(secondBox.y);
    }

    const attribution = page.getByText('Places from Google Maps.', { exact: true });
    await attribution.waitFor({ state: 'visible' });
    expect(await isBelow(attribution, third)).toBe(true);

    await app.saveScreen('searching-shows-public-places.png');
  },
  TIMEOUT,
);

test(
  'One letter searches nothing',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await page.getByRole('textbox', { name: 'Place' }).fill('c');
    // Well past the search's debounce.
    await page.waitForTimeout(1500);

    expect(await placeResults(page).count()).toBe(0);
    expect(await page.getByText('No public places found. Try another name.', { exact: true }).count()).toBe(0);
    expect(await page.getByText("Places couldn't be searched right now. Try again.", { exact: true }).count()).toBe(0);
    expect(
      await page.getByText("That isn't a public place. Pick a café, library, park or similar.", { exact: true }).count(),
    ).toBe(0);

    await app.saveScreen('one-letter-searches-nothing.png');
  },
  TIMEOUT,
);

test(
  'A picked place is marked and stays on top',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;
    const field = page.getByRole('textbox', { name: 'Place' });

    await field.fill('café');
    const results = placeResults(page);
    await waitUntil(async () => (await results.count()) === 3);

    // [Café bar name] is the second café result: a café in Aarhus C that is not the Latin Quarter one.
    const cafeBar = page
      .getByRole('button', { name: /, Café, Aarhus C$/ })
      .filter({ hasNotText: 'Latin Quarter' })
      .first();
    const cafeBarName = await cafeBar.getAttribute('aria-label');
    expect(cafeBarName).not.toBeNull();
    await cafeBar.click();

    const picked = page.getByRole('button', { name: cafeBarName ?? '', exact: true });
    await waitUntil(async () => (await picked.getByRole('img', { name: 'Selected' }).count()) === 1);

    await field.fill('zzz');
    await page.waitForTimeout(1500);

    expect(await picked.count()).toBe(1);
    expect(await picked.isVisible()).toBe(true);
    expect(await picked.getByRole('img', { name: 'Selected' }).count()).toBe(1);
    expect(await placeResults(page).count()).toBe(1);

    await app.saveScreen('a-picked-place-is-marked-and-stays-on-top.png');
  },
  TIMEOUT,
);

test(
  'Nothing found',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await page.getByRole('textbox', { name: 'Place' }).fill('zzz');
    const message = page.getByText('No public places found. Try another name.', { exact: true });
    await message.waitFor({ state: 'visible' });
    expect(await placeResults(page).count()).toBe(0);

    await app.saveScreen('nothing-found.png');
  },
  TIMEOUT,
);

test(
  'The place search in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;
    const field = page.getByRole('textbox', { name: 'Sted' });

    await field.fill('café');
    const bakery = page.getByRole('button', { name: /, Bageri, Aarhus C$/ }).first();
    await bakery.waitFor({ state: 'visible' });
    expect(await textOf(bakery)).toContain('Bageri · Aarhus C');

    const results = placeResults(page);
    const last = results.nth((await results.count()) - 1);
    const attribution = page.getByText('Steder fra Google Maps.', { exact: true });
    await attribution.waitFor({ state: 'visible' });
    expect(await isBelow(attribution, last)).toBe(true);

    await field.fill('zzz');
    const message = page.getByText('Ingen offentlige steder fundet. Prøv et andet navn.', { exact: true });
    await message.waitFor({ state: 'visible' });

    await app.saveScreen('the-place-search-in-danish.png');
  },
  TIMEOUT,
);
