// ail-derived-from: AreaStep@06516c2c43eec859
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isTicked, openApp } from '../../../harness/preview.ts';

type App = Awaited<ReturnType<typeof openApp>>;
type Page = App['page'];

const TIMEOUT = 180_000;
const WAIT = 20_000;

/** Waits until a text the user can read is visible. */
async function shows(page: Page, text: string): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible', timeout: WAIT });
}

/** Counts how many visible elements carry exactly this text. */
async function visibleCount(page: Page, text: string): Promise<number> {
  const all = page.getByText(text, { exact: true });
  const n = await all.count();
  let visible = 0;
  for (let i = 0; i < n; i += 1) {
    if (await all.nth(i).isVisible()) {
      visible += 1;
    }
  }
  return visible;
}

/** Looks up the Danish text that goes with an English copy text in the app's own i18n files. */
function danishFor(english: string): string {
  const root = join(import.meta.dir, '../../../../apps/mobile/src/i18n');
  const find = (node: unknown, path: string[]): string[] | null => {
    if (typeof node === 'string') {
      return node === english ? path : null;
    }
    if (node !== null && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const hit = find(value, [...path, key]);
        if (hit !== null) {
          return hit;
        }
      }
    }
    return null;
  };
  for (const file of readdirSync(join(root, 'en')).filter((f) => f.endsWith('.json'))) {
    const en: unknown = JSON.parse(readFileSync(join(root, 'en', file), 'utf8'));
    const path = find(en, []);
    if (path === null) {
      continue;
    }
    let node: unknown = JSON.parse(readFileSync(join(root, 'da', file), 'utf8'));
    for (const key of path) {
      node = node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
    }
    if (typeof node === 'string') {
      return node;
    }
  }
  throw new Error(`no Danish text found for "${english}"`);
}

/** Fills About you in English with Emil, 14 03 1991 and the Terms ticked. */
async function fillAboutYou(page: Page): Promise<void> {
  await page.getByLabel('First name').fill('Emil');
  await page.getByLabel('Date of birth, Day').fill('14');
  await page.getByLabel('Date of birth, Month').fill('03');
  await page.getByLabel('Date of birth, Year').fill('1991');
  const terms = page.getByRole('checkbox', { name: 'I accept the Terms' });
  if (!(await isTicked(terms))) {
    await terms.click();
  }
  expect(await isTicked(terms)).toBe(true);
}

/** Goes through About you in English and arrives on Where do you live?. */
async function arriveOnAreaStep(page: Page): Promise<void> {
  await fillAboutYou(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await shows(page, 'Where do you live?');
}

test('The step starts with no area and Continue waits', async () => {
  await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
  const page = app.page;
  await fillAboutYou(page);

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await shows(page, 'Step 2 of 6');
  await shows(page, 'Where do you live?');
  expect(await page.getByRole('button', { name: 'Back' }).count()).toBeGreaterThan(0);
  expect(await page.getByLabel('Postcode').inputValue()).toBe('');
  expect(await visibleCount(page, 'Your area')).toBe(0);
  expect(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled()).toBe(true);
  await shows(page, 'Postal code data: GeoNames (www.geonames.org)');

  await app.saveScreen('the-step-starts-with-no-area-and-continue-waits.png');
}, TIMEOUT);

test('A known postcode gives an area', async () => {
  await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
  const page = app.page;
  await arriveOnAreaStep(page);

  await page.getByLabel('Postcode').fill('8000');

  await shows(page, 'Your area');
  await shows(page, 'Aarhus C');
  await shows(page, 'Aarhus opens soon');
  expect(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled()).toBe(false);

  await app.saveScreen('a-known-postcode-gives-an-area.png');
}, TIMEOUT);

test('An unknown postcode is refused', async () => {
  await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
  const page = app.page;
  await arriveOnAreaStep(page);

  await page.getByLabel('Postcode').fill('0000');

  await shows(page, "We don't know that postcode.");
  expect(await visibleCount(page, 'Your area')).toBe(0);
  expect(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled()).toBe(true);

  await app.saveScreen('an-unknown-postcode-is-refused.png');
}, TIMEOUT);

test('No approximate location', async () => {
  await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
  const page = app.page;
  await arriveOnAreaStep(page);
  // The phone gives no location: permission is not granted and every position request fails.
  await page.context().clearPermissions();
  await page.evaluate(() => {
    const failure = { code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
    const fail = (_success: unknown, error?: (e: unknown) => void): void => {
      setTimeout(() => error?.(failure), 0);
    };
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: fail,
        watchPosition: (success: unknown, error?: (e: unknown) => void): number => {
          fail(success, error);
          return 0;
        },
        clearWatch: (): void => {},
      },
    });
  });

  await page.getByRole('button', { name: 'Use my approximate location' }).click();

  await shows(page, 'We could not get your approximate location. Use your postcode instead.');

  await app.saveScreen('no-approximate-location.png');
}, TIMEOUT);

test('Continue sends the basics and opens step 3', async () => {
  await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
  const page = app.page;
  await arriveOnAreaStep(page);
  await page.getByLabel('Postcode').fill('8000');
  await shows(page, 'Aarhus C');

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await shows(page, 'Step 3 of 6');
  await shows(page, 'Sensitive interests');
  expect(await page.getByRole('button', { name: 'Back' }).count()).toBe(0);

  await app.saveScreen('continue-sends-the-basics-and-opens-step-3.png');
}, TIMEOUT);

test('Opened directly, the step cannot be finished', async () => {
  await using app = await openApp({ route: '/area', world: 'new member', locale: 'en' });
  const page = app.page;
  await shows(page, 'Where do you live?');
  expect(await page.getByRole('button', { name: 'Back' }).count()).toBe(0);

  await page.getByLabel('Postcode').fill('8000');
  await shows(page, 'Aarhus C');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForTimeout(3_000);

  await shows(page, 'Where do you live?');
  expect(await visibleCount(page, 'Step 3 of 6')).toBe(0);

  await app.saveScreen('opened-directly-the-step-cannot-be-finished.png');
}, TIMEOUT);

test('The step in Danish', async () => {
  await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
  const page = app.page;
  // Om dig, in the order its fields are shown: first name, then day, month and year of birth.
  const fields = page.getByRole('textbox');
  await fields.nth(0).fill('Emil');
  await fields.nth(1).fill('14');
  await fields.nth(2).fill('03');
  await fields.nth(3).fill('1991');
  const terms = page.getByRole('checkbox').first();
  if (!(await isTicked(terms))) {
    await terms.click();
  }
  await page.getByRole('button', { name: danishFor('Continue'), exact: true }).click();
  await shows(page, 'Hvor bor du?');

  await page.getByLabel('Postnummer').fill('8000');

  await shows(page, 'Trin 2 af 6');
  await shows(page, 'Postnummer');
  await shows(page, 'Dit område');
  await shows(page, 'Aarhus C');
  await shows(page, 'Aarhus åbner snart');

  await app.saveScreen('the-step-in-danish.png');
}, TIMEOUT);
