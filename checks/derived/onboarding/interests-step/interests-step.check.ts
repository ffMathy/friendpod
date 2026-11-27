// ail-derived-from: InterestsStep@efa72b9190842dc0
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;
type Page = App['page'];

const TIMEOUT = 180_000;
const ROUTE = '/add-interests';

/** Waits until the page's whole text, with white space collapsed, matches the pattern. */
async function waitForPageText(page: Page, pattern: RegExp): Promise<void> {
  await page.waitForFunction(
    ([source, flags]) => {
      const text = (document.body.textContent ?? '').replace(/\s+/g, ' ');
      return new RegExp(source, flags).test(text);
    },
    [pattern.source, pattern.flags] as const,
  );
}

/** The page's whole text, with white space collapsed. */
async function pageText(page: Page): Promise<string> {
  const text = await page.locator('body').textContent();
  return (text ?? '').replace(/\s+/g, ' ');
}

function continueButton(page: Page) {
  return page.getByRole('button', { name: 'Continue', exact: true });
}

describe('InterestsStep', () => {
  test(
    'Three or more interests let the member continue',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await page.getByText('What are you into?', { exact: true }).first().waitFor({ state: 'visible' });
      await waitForPageText(page, /Your interests\s*·\s*4 added/);

      const text = await pageText(page);
      expect(text).toMatch(/Step\s*4\s*of\s*6/);
      expect(text).toMatch(/Your interests\s*·\s*4 added/);

      for (const name of ['brætspil', 'sourdough', 'far på barsel', 'gravid, private']) {
        await page.getByRole('button', { name, exact: true }).waitFor({ state: 'visible' });
      }

      expect(await continueButton(page).isDisabled()).toBe(false);

      await app.saveScreen('three-or-more-interests-let-the-member-continue.png');
    },
    TIMEOUT,
  );

  test(
    'Below three interests Continue waits',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForPageText(page, /Your interests\s*·\s*4 added/);

      await page.getByRole('button', { name: 'Remove brætspil', exact: true }).click();
      await waitForPageText(page, /Your interests\s*·\s*3 added/);
      await page.getByRole('button', { name: 'Remove sourdough', exact: true }).click();
      await waitForPageText(page, /Your interests\s*·\s*2 added/);

      expect(await pageText(page)).toMatch(/Your interests\s*·\s*2 added/);
      expect(await continueButton(page).isDisabled()).toBe(true);

      await app.saveScreen('below-three-interests-continue-waits.png');
    },
    TIMEOUT,
  );

  test(
    'An added interest joins the chips',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForPageText(page, /Your interests\s*·\s*4 added/);

      await page.getByLabel('Add an interest in your own words').fill('kayak');
      await page.getByRole('button', { name: 'Add', exact: true }).click();

      await page.getByText('Added.', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'kayak', exact: true }).waitFor({ state: 'visible' });
      await waitForPageText(page, /Your interests\s*·\s*5 added/);

      expect(await pageText(page)).toMatch(/Your interests\s*·\s*5 added/);

      await app.saveScreen('an-added-interest-joins-the-chips.png');
    },
    TIMEOUT,
  );

  test(
    'No interests yet',
    async () => {
      await using app = await openApp({
        route: ROUTE,
        world: 'member choosing about private interests',
        locale: 'en',
      });
      const page = app.page;

      await page.getByText('What are you into?', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('No interests yet.', { exact: true }).first().waitFor({ state: 'visible' });

      expect(await pageText(page)).toContain('Your interests');
      expect(await continueButton(page).isDisabled()).toBe(true);

      await app.saveScreen('no-interests-yet.png');
    },
    TIMEOUT,
  );

  test(
    'Continue opens step 5',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForPageText(page, /Your interests\s*·\s*4 added/);

      await continueButton(page).click();

      await page.getByText('Who would you like to meet?', { exact: true }).first().waitFor({ state: 'visible' });
      await waitForPageText(page, /Step\s*5\s*of\s*6/);

      const text = await pageText(page);
      expect(text).toMatch(/Step\s*5\s*of\s*6/);
      expect(text).toContain('Who would you like to meet?');

      await app.saveScreen('continue-opens-step-5.png');
    },
    TIMEOUT,
  );

  test(
    'The step in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member adding interests', locale: 'da' });
      const page = app.page;

      await page.getByText('Hvad går du op i?', { exact: true }).first().waitFor({ state: 'visible' });
      await waitForPageText(page, /Dine interesser\s*·\s*4 tilføjet/);

      const text = await pageText(page);
      expect(text).toMatch(/Trin\s*4\s*af\s*6/);
      expect(text).toContain('Hvad går du op i?');
      expect(text).toMatch(/Dine interesser\s*·\s*4 tilføjet/);

      await app.saveScreen('the-step-in-danish.png');
    },
    TIMEOUT,
  );
});
