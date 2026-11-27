// ail-derived-from: AreaStep@3c87955f81c425c4
import { afterAll, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { openApp } from '../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;
type Locale = 'en' | 'da';

const TIMEOUT = 300_000;

const I18N_DIR = join(import.meta.dir, '..', '..', '..', '..', 'apps', 'mobile', 'src', 'i18n');

function flatten(value: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof value === 'string') {
    out.set(prefix, value);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      flatten(child, prefix === '' ? key : `${prefix}.${key}`, out);
    }
  }
}

function loadLocale(locale: Locale): Map<string, string> {
  const out = new Map<string, string>();
  const dir = join(I18N_DIR, locale);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const namespace = file.slice(0, -'.json'.length);
    flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown, namespace, out);
  }
  return out;
}

/** Turns an English text of the app into the app's own Danish text for the same i18next key. */
function toDanish(english: string): string {
  const en = loadLocale('en');
  const da = loadLocale('da');
  const lookup = (text: string): string | null => {
    for (const [key, value] of en) {
      if (value === text) {
        const danish = da.get(key);
        if (danish !== undefined) return danish;
      }
    }
    return null;
  };
  const whole = lookup(english);
  if (whole !== null) return whole;
  const parts = english.split(', ').map(lookup);
  if (parts.length > 1 && parts.every((part): part is string => part !== null)) return parts.join(', ');
  throw new Error(`No Danish text found in the app's i18n files for "${english}"`);
}

function text(locale: Locale, english: string): string {
  return locale === 'en' ? english : toDanish(english);
}

async function eventually(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() > end) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Fills About you (Emil, 14 03 1991, the Terms ticked) and presses Continue. */
async function passAboutYou(app: App, locale: Locale): Promise<void> {
  const page = app.page;
  await page.getByLabel(text(locale, 'First name'), { exact: true }).fill('Emil');
  await page.getByLabel(text(locale, 'Date of birth, Day'), { exact: true }).fill('14');
  await page.getByLabel(text(locale, 'Date of birth, Month'), { exact: true }).fill('03');
  await page.getByLabel(text(locale, 'Date of birth, Year'), { exact: true }).fill('1991');
  await page.getByRole('checkbox', { name: text(locale, 'I accept the Terms') }).click();
  await page.getByRole('button', { name: text(locale, 'Continue'), exact: true }).click();
}

async function onAreaAfterAboutYou(app: App): Promise<void> {
  await passAboutYou(app, 'en');
  await app.page.getByText('Where do you live?', { exact: true }).waitFor();
}

function continueButton(app: App) {
  return app.page.getByRole('button', { name: 'Continue', exact: true });
}

afterAll(() => {});

test(
  'The step starts with no area and Continue waits',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await passAboutYou(app, 'en');

    await page.getByText('Where do you live?', { exact: true }).waitFor();
    await page.getByText('Step 2 of 6').waitFor();
    expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(1);

    expect(await page.getByLabel('Postcode', { exact: true }).inputValue()).toBe('');
    expect(await page.getByText('Your area', { exact: true }).count()).toBe(0);
    expect(await continueButton(app).isDisabled()).toBe(true);

    const body = await page.locator('body').innerText();
    expect(body).toContain('Postal code data: GeoNames (www.geonames.org)');

    await app.saveScreen('the-step-starts-with-no-area-and-continue-waits.png');
  },
  TIMEOUT,
);

test(
  'A known postcode gives an area',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await onAreaAfterAboutYou(app);

    await page.getByLabel('Postcode', { exact: true }).fill('8000');

    await page.getByText('Your area', { exact: true }).waitFor();
    await page.getByText('Aarhus C', { exact: true }).waitFor();
    await page.getByText('Aarhus opens soon', { exact: true }).waitFor();
    expect(await eventually(async () => !(await continueButton(app).isDisabled()))).toBe(true);

    await app.saveScreen('a-known-postcode-gives-an-area.png');
  },
  TIMEOUT,
);

test(
  'An unknown postcode is refused',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await onAreaAfterAboutYou(app);

    await page.getByLabel('Postcode', { exact: true }).fill('0000');

    await page.getByText("We don't know that postcode.", { exact: true }).waitFor();
    expect(await page.getByText('Your area', { exact: true }).count()).toBe(0);
    expect(await continueButton(app).isDisabled()).toBe(true);

    await app.saveScreen('an-unknown-postcode-is-refused.png');
  },
  TIMEOUT,
);

test(
  'No approximate location',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await onAreaAfterAboutYou(app);
    // The phone gives no location: no location permission is granted to the page.
    await page.context().clearPermissions();

    await page.getByRole('button', { name: 'Use my approximate location' }).click();

    await page
      .getByText('We could not get your approximate location. Use your postcode instead.', { exact: true })
      .waitFor();

    await app.saveScreen('no-approximate-location.png');
  },
  TIMEOUT,
);

test(
  'Continue sends the basics and opens step 3',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await onAreaAfterAboutYou(app);
    await page.getByLabel('Postcode', { exact: true }).fill('8000');
    await page.getByText('Aarhus C', { exact: true }).waitFor();
    expect(await eventually(async () => !(await continueButton(app).isDisabled()))).toBe(true);

    await continueButton(app).click();

    await page.getByText('Step 3 of 6').waitFor({ timeout: 20_000 });
    await page.getByText('Sensitive interests').first().waitFor();
    expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);

    await app.saveScreen('continue-sends-the-basics-and-opens-step-3.png');
  },
  TIMEOUT,
);

test(
  'Opened directly, the step cannot be finished',
  async () => {
    await using app = await openApp({ route: '/area', world: 'new member', locale: 'en' });
    const page = app.page;
    await page.getByText('Where do you live?', { exact: true }).waitFor();

    await page.getByLabel('Postcode', { exact: true }).fill('8000');
    await page.getByText('Aarhus C', { exact: true }).waitFor();
    await continueButton(app).click();

    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expect(await page.getByText('Where do you live?', { exact: true }).isVisible()).toBe(true);
    expect(await page.getByText('Step 3 of 6').count()).toBe(0);

    await app.saveScreen('opened-directly-the-step-cannot-be-finished.png');
  },
  TIMEOUT,
);

test(
  'The step in Danish',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
    const page = app.page;
    await passAboutYou(app, 'da');
    await page.getByText('Hvor bor du?', { exact: true }).waitFor();

    await page.getByLabel('Postnummer', { exact: true }).fill('8000');

    await page.getByText('Trin 2 af 6').waitFor();
    await page.getByText('Postnummer', { exact: true }).first().waitFor();
    await page.getByText('Dit område', { exact: true }).waitFor();
    await page.getByText('Aarhus C', { exact: true }).waitFor();
    await page.getByText('Aarhus åbner snart', { exact: true }).waitFor();

    await app.saveScreen('the-step-in-danish.png');
  },
  TIMEOUT,
);
