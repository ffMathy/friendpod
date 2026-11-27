// ail-derived-from: InfoLicences@02f7c4865340ee0a
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const ROUTE = '/info/legal/licences';
const WORLD = 'member this week';
const TIMEOUT = 300_000;

const OFL_HEADING = 'SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Waits until the first match of a locator is visible and returns it. */
const seen = async (locator: Locator): Promise<Locator> => {
  const first = locator.first();
  await first.waitFor({ state: 'visible' });
  return first;
};

/** The whole text of the page, as the DOM holds it. */
const pageText = async (page: Page): Promise<string> => (await page.locator('body').textContent()) ?? '';

/** The vertical position of a visible element. */
const topOf = async (locator: Locator): Promise<number> => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
};

const ROWS: ReadonlyArray<readonly [string, string]> = [
  ['React and React Native', 'MIT'],
  ['Expo, Expo Router and Expo Modules', 'MIT'],
  ['React Native Firebase', 'Apache-2.0'],
  ['React Native Google Sign-In', 'MIT'],
  ['TanStack Query', 'MIT'],
  ['i18next and react-i18next', 'MIT'],
  ['React Hook Form', 'MIT'],
  ['Zod', 'MIT'],
  ['react-native-svg', 'MIT'],
  ['React Native Screens, Gesture Handler and Safe Area Context', 'MIT'],
  ['ONNX Runtime', 'MIT'],
  ['Hugging Face Tokenizers', 'Apache-2.0'],
  ['EmbeddingGemma 2 (the on-device model)', 'Apache-2.0'],
];

test(
  'The licences credit postcodes, fonts and software',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await seen(
      page.getByText(
        'Friendpod is built with open data and open-source software. Thank you to the people behind them.',
        { exact: true },
      ),
    );

    // POSTCODES with its two links
    await seen(page.getByText(/^\s*postcodes\s*$/i));
    await seen(page.getByRole('link', { name: 'GeoNames (www.geonames.org)', exact: true }));
    await seen(page.getByRole('link', { name: 'CC BY 4.0', exact: true }));

    // FONTS, each with its licence and copyright line
    await seen(page.getByText(/^\s*fonts\s*$/i));
    const text = await pageText(page);
    expect(text).toMatch(
      new RegExp(
        'Plus Jakarta Sans[\\s\\S]*?SIL Open Font License 1\\.1[\\s\\S]*?(Copyright|©)[\\s\\S]*?' +
          'Bricolage Grotesque[\\s\\S]*?SIL Open Font License 1\\.1[\\s\\S]*?(Copyright|©)',
        'i',
      ),
    );

    // OPEN-SOURCE SOFTWARE: 13 rows in order, each with its licence
    await seen(page.getByText(/^\s*open-source software\s*$/i));
    let from = 0;
    for (const [name, licence] of ROWS) {
      const re = new RegExp(`${escapeRegExp(name)}\\s*${escapeRegExp(licence)}`, 'g');
      re.lastIndex = from;
      const match = re.exec(text);
      expect(match, `row ${name}, ${licence}`).not.toBeNull();
      if (match !== null) {
        from = match.index + match[0].length;
      }
    }

    // The page ends with the note
    const note = await seen(page.getByText("Each package's full licence text comes with its source code.", { exact: true }));
    const lastRow = await seen(page.getByText('EmbeddingGemma 2 (the on-device model)', { exact: false }));
    expect(await topOf(note)).toBeGreaterThan(await topOf(lastRow));

    await app.saveScreen('the-licences-credit-postcodes-fonts-and-software.png');
  },
  TIMEOUT,
);

test(
  "A font's licence opens and closes",
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const show = await seen(page.getByLabel('Show the licence for Plus Jakarta Sans', { exact: true }));
    await show.click();

    const heading = await seen(page.getByText(OFL_HEADING));
    const hide = await seen(page.getByLabel('Hide the licence for Plus Jakarta Sans', { exact: true }));
    expect(((await hide.textContent()) ?? '').trim()).toBe('Hide the licence');

    // From its copyright line to the licence heading and on
    const licenceText =
      (await page
        .locator('div')
        .filter({ hasText: new RegExp(`(Copyright|©)[\\s\\S]*${escapeRegExp(OFL_HEADING)}[\\s\\S]*PREAMBLE`) })
        .last()
        .textContent()) ?? '';
    expect(licenceText).toMatch(new RegExp(`(Copyright|©)[\\s\\S]*${escapeRegExp(OFL_HEADING)}[\\s\\S]*PREAMBLE`));

    // Under the Plus Jakarta Sans link, before the next font
    const nextFont = await seen(page.getByLabel('Show the licence for Bricolage Grotesque', { exact: true }));
    const headingTop = await topOf(heading);
    expect(headingTop).toBeGreaterThan(await topOf(hide));
    expect(headingTop).toBeLessThan(await topOf(nextFont));

    await hide.click();
    await page.getByText(OFL_HEADING).first().waitFor({ state: 'hidden' });
    const left = page.getByText(OFL_HEADING);
    const count = await left.count();
    for (let i = 0; i < count; i += 1) {
      expect(await left.nth(i).isVisible()).toBe(false);
    }
    await seen(page.getByLabel('Show the licence for Plus Jakarta Sans', { exact: true }));

    await app.saveScreen('a-font-s-licence-opens-and-closes.png');
  },
  TIMEOUT,
);

test(
  'The GeoNames link opens its website',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;
    const context = page.context();

    await context.route(/^https?:\/\/(www\.)?geonames\.org(\/.*)?$/, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>GeoNames</body></html>' }),
    );

    const link = await seen(page.getByRole('link', { name: 'GeoNames (www.geonames.org)', exact: true }));
    const [opened] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await opened.waitForURL(/^https?:\/\/(www\.)?geonames\.org\/?/);
    expect(opened.url()).toMatch(/^https?:\/\/(www\.)?geonames\.org\/?/);

    // The app itself stays on Licences
    expect(new URL(page.url()).pathname).toBe(ROUTE);

    await app.saveScreen('the-geonames-link-opens-its-website.png');
  },
  TIMEOUT,
);

test(
  'Licences in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    await seen(page.getByText(/^\s*licenser\s*$/i));
    await seen(page.getByText(/^\s*postnumre\s*$/i));
    await seen(page.getByText(/^\s*skrifttyper\s*$/i));
    await seen(page.getByText(/^\s*open source-software\s*$/i));

    await seen(page.getByText('React og React Native', { exact: true }));
    await seen(page.getByText('EmbeddingGemma 2 (modellen på telefonen)', { exact: true }));

    for (const font of ['Plus Jakarta Sans', 'Bricolage Grotesque']) {
      const show = await seen(page.getByLabel(`Vis licensen for ${font}`, { exact: true }));
      expect(((await show.textContent()) ?? '').trim()).toBe('Vis licensen');
    }

    await app.saveScreen('licences-in-danish.png');
  },
  TIMEOUT,
);
