// ail-derived-from: DropWhy@7b581fdec9dd6dc0
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const SHEET_ROUTE = '/sheets/why-this-pod?podId=braetspilpodaarhus46';
const WORLD = 'member with a pod proposal';
const TIMEOUT = 300_000;

/** The page's whole text, with whitespace collapsed, so sentences split across bold parts read as one. */
async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => (document.body.textContent ?? '').replace(/\s+/g, ' '));
}

/** Waits until the page's whole text contains every one of the given sentences. */
async function waitForTexts(page: Page, texts: string[]): Promise<void> {
  await page.waitForFunction(
    (wanted: string[]) => {
      const all = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      return wanted.every((t) => all.includes(t));
    },
    texts,
    { timeout: 30_000 },
  );
}

/** Waits until none of the given sentences is in the page's text any more. */
async function waitForTextsGone(page: Page, texts: string[]): Promise<void> {
  await page.waitForFunction(
    (gone: string[]) => {
      const all = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      return gone.every((t) => !all.includes(t));
    },
    texts,
    { timeout: 30_000 },
  );
}

const THEME_EN = 'Everyone added brætspil, or something that means the same.';
const ALSO_SHARE_EN = 'You also share sourdough and trail running with some of them.';
const NEAR_AREA_EN = 'Everyone lives about 10 km or less from you, near Aarhus C.';
const AGE_SPAN_EN = "Ages 29–38: everyone is inside everyone else's age range.";
const PRIORITY_EN = 'You waited 2 weeks, so you got priority this time.';
const NEVER_TITLE_EN = 'What we never use';
const NEVER_BODY_EN =
  "Photos, looks, or anything you haven't told us. Gender only if you chose same-gender pods. " +
  'Private interests only as the theme of a pod about them.';

test(
  'The reasons for the brætspil pod',
  async () => {
    await using app = await openApp({ route: SHEET_ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const ordered = [THEME_EN, ALSO_SHARE_EN, NEAR_AREA_EN, AGE_SPAN_EN, PRIORITY_EN];
    await waitForTexts(page, [...ordered, NEVER_TITLE_EN, NEVER_BODY_EN]);

    const all = await pageText(page);
    let last = -1;
    for (const sentence of ordered) {
      const at = all.indexOf(sentence);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
    expect(all.indexOf(NEVER_BODY_EN)).toBeGreaterThan(all.indexOf(NEVER_TITLE_EN));

    await page.getByText(NEVER_TITLE_EN, { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('How matching works', { exact: true }).first().waitFor({ state: 'visible' });

    await app.saveScreen('the-reasons-for-the-br-tspil-pod.png');
  },
  TIMEOUT,
);

test(
  'Close returns to the proposal',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    await page.getByRole('link', { name: 'Why this pod?', exact: true }).first().click();
    await waitForTexts(page, [THEME_EN]);

    await page.getByRole('button', { name: 'Close' }).first().click();

    await waitForTextsGone(page, [THEME_EN, NEVER_BODY_EN]);
    expect(await page.getByText('Why this pod', { exact: true }).count()).toBe(0);
    await page.getByRole('button', { name: "I'm in" }).first().waitFor({ state: 'visible' });

    await app.saveScreen('close-returns-to-the-proposal.png');
  },
  TIMEOUT,
);

test(
  'Tapping beside the sheet closes it',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    await page.getByRole('link', { name: 'Why this pod?', exact: true }).first().click();
    await waitForTexts(page, [THEME_EN]);
    await page.getByText('Why this pod', { exact: true }).first().waitFor({ state: 'visible' });

    // The sheet is as tall as its content and rises from the bottom; the top of the 390×844 screen is the dimmed proposal.
    await page.mouse.click(195, 40);

    await waitForTextsGone(page, [THEME_EN, NEVER_BODY_EN]);
    expect(await page.getByText('Why this pod', { exact: true }).count()).toBe(0);

    await app.saveScreen('tapping-beside-the-sheet-closes-it.png');
  },
  TIMEOUT,
);

test(
  'How matching works from the sheet',
  async () => {
    await using app = await openApp({ route: SHEET_ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await waitForTexts(page, [THEME_EN]);
    await page.getByText('How matching works', { exact: true }).first().click();

    await page.waitForURL(/\/info\/how-matching-works/, { timeout: 30_000 });
    expect(page.url()).toContain('/info/how-matching-works');

    await app.saveScreen('how-matching-works-from-the-sheet.png');
  },
  TIMEOUT,
);

test(
  'Why this pod in Danish',
  async () => {
    await using app = await openApp({ route: SHEET_ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    const theme = 'Alle har tilføjet brætspil eller noget, der betyder det samme.';
    const priority = 'Du har ventet 2 uger, så du fik forrang denne gang.';
    await waitForTexts(page, [theme, priority, 'Det bruger vi aldrig', 'Sådan matcher vi']);

    await page.getByText('Hvorfor denne pod', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Det bruger vi aldrig', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Sådan matcher vi', { exact: true }).first().waitFor({ state: 'visible' });

    await app.saveScreen('why-this-pod-in-danish.png');
  },
  TIMEOUT,
);
