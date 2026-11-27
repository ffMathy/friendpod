// ail-derived-from: InterestsStep@b82f22f198da5535
import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../harness/preview.ts';

const TIMEOUT = 300_000;

/** The page's visible text, with each run of white space made one space. */
async function screenText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/\s+/g, ' ');
}

/** Polls until the condition holds, or fails with the message after the timeout. */
async function waitUntil(condition: () => Promise<boolean>, message: string, timeout = 15_000): Promise<void> {
  const end = Date.now() + timeout;
  for (;;) {
    if (await condition()) return;
    if (Date.now() > end) throw new Error(`Timed out waiting for: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** Waits until the visible screen text matches the pattern. */
async function waitForScreenText(page: Page, pattern: RegExp): Promise<void> {
  await waitUntil(async () => pattern.test(await screenText(page)), `screen text ${String(pattern)}`);
}

describe('InterestsStep', () => {
  test(
    'Three or more interests let the member continue',
    async () => {
      await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForScreenText(page, /What are you into\?/);
      await waitForScreenText(page, /Step\s*4\s*of\s*6/);
      await waitForScreenText(page, /Your interests\s*·\s*4\s*added/);

      for (const name of ['brætspil', 'sourdough', 'far på barsel', 'gravid, private']) {
        const chip = page.getByRole('button', { name, exact: true });
        await chip.waitFor({ state: 'visible' });
        expect(await chip.count()).toBe(1);
      }

      const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
      await continueButton.waitFor({ state: 'visible' });
      await waitUntil(async () => !(await continueButton.isDisabled()), 'Continue can be pressed');
      expect(await continueButton.isDisabled()).toBe(false);

      await app.saveScreen('three-or-more-interests-let-the-member-continue.png');
    },
    TIMEOUT,
  );

  test(
    'Below three interests Continue waits',
    async () => {
      await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForScreenText(page, /Your interests\s*·\s*4\s*added/);

      const removeBraetspil = page.getByRole('button', { name: 'Remove brætspil', exact: true });
      await removeBraetspil.waitFor({ state: 'visible' });
      await removeBraetspil.click();
      await waitForScreenText(page, /Your interests\s*·\s*3\s*added/);

      const removeSourdough = page.getByRole('button', { name: 'Remove sourdough', exact: true });
      await removeSourdough.waitFor({ state: 'visible' });
      await removeSourdough.click();

      await waitForScreenText(page, /Your interests\s*·\s*2\s*added/);
      expect(await screenText(page)).toMatch(/Your interests\s*·\s*2\s*added/);

      const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
      await continueButton.waitFor({ state: 'visible' });
      await waitUntil(async () => continueButton.isDisabled(), 'Continue cannot be pressed');
      expect(await continueButton.isDisabled()).toBe(true);

      await app.saveScreen('below-three-interests-continue-waits.png');
    },
    TIMEOUT,
  );

  test(
    'An added interest joins the chips',
    async () => {
      await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForScreenText(page, /Your interests\s*·\s*4\s*added/);

      const field = page.getByLabel('Add an interest in your own words');
      await field.waitFor({ state: 'visible' });
      const addButton = page.getByRole('button', { name: 'Add', exact: true });
      await waitUntil(async () => (await field.isEditable()) && !(await addButton.isDisabled()), 'the field is ready');
      await field.fill('kayak');
      await addButton.click();

      await page.getByText('Added.', { exact: true }).waitFor({ state: 'visible' });

      const kayak = page.getByRole('button', { name: 'kayak', exact: true });
      await kayak.waitFor({ state: 'visible' });
      expect(await kayak.count()).toBe(1);

      await waitForScreenText(page, /Your interests\s*·\s*5\s*added/);
      expect(await screenText(page)).toMatch(/Your interests\s*·\s*5\s*added/);

      await app.saveScreen('an-added-interest-joins-the-chips.png');
    },
    TIMEOUT,
  );

  test(
    'No interests yet',
    async () => {
      await using app = await openApp({
        route: '/add-interests',
        world: 'member choosing about private interests',
        locale: 'en',
      });
      const page = app.page;

      await waitForScreenText(page, /What are you into\?/);
      await waitForScreenText(page, /Your interests/);
      await page.getByText('No interests yet.', { exact: true }).waitFor({ state: 'visible' });

      const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
      await continueButton.waitFor({ state: 'visible' });
      expect(await continueButton.isDisabled()).toBe(true);

      await app.saveScreen('no-interests-yet.png');
    },
    TIMEOUT,
  );

  test(
    'Continue opens step 5',
    async () => {
      await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
      const page = app.page;

      await waitForScreenText(page, /Your interests\s*·\s*4\s*added/);

      const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
      await continueButton.waitFor({ state: 'visible' });
      await waitUntil(async () => !(await continueButton.isDisabled()), 'Continue can be pressed');
      await continueButton.click();

      await waitForScreenText(page, /Who would you like to meet\?/);
      await waitForScreenText(page, /Step\s*5\s*of\s*6/);
      const text = await screenText(page);
      expect(text).toMatch(/Step\s*5\s*of\s*6/);
      expect(text).toMatch(/Who would you like to meet\?/);

      await app.saveScreen('continue-opens-step-5.png');
    },
    TIMEOUT,
  );

  test(
    'The step in Danish',
    async () => {
      await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'da' });
      const page = app.page;

      await waitForScreenText(page, /Hvad går du op i\?/);
      await waitForScreenText(page, /Trin\s*4\s*af\s*6/);
      await waitForScreenText(page, /Dine interesser\s*·\s*4\s*tilføjet/);
      const text = await screenText(page);
      expect(text).toMatch(/Trin\s*4\s*af\s*6/);
      expect(text).toMatch(/Hvad går du op i\?/);
      expect(text).toMatch(/Dine interesser\s*·\s*4\s*tilføjet/);

      await app.saveScreen('the-step-in-danish.png');
    },
    TIMEOUT,
  );
});
