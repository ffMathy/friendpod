// ail-derived-from: Me@bde2c1aaac149ea5
import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../harness/preview';

const TIMEOUT = 180_000;

/**
 * The visible text of the whole page, so text composed from several elements can be read as one; no-break spaces
 * (which keep the parts of the preferences summary together) read as spaces.
 */
async function pageText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\u00a0/g, ' ');
}

/** Whether the page shows `words`, ignoring case: the cards' eyebrows are drawn in upper case. */
function showsIgnoringCase(text: string, words: string): boolean {
  return text.toLowerCase().includes(words.toLowerCase());
}

/** Waits until Me has loaded its account card. */
async function waitForMe(page: Page, yourAccount: string): Promise<void> {
  await page.getByText(yourAccount, { exact: true }).first().waitFor({ state: 'visible' });
}

describe('Me', () => {
  test(
    'Me shows the member and their account',
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
      const page = app.page;
      await waitForMe(page, 'Your account');

      expect(await page.getByText('Me', { exact: true }).first().isVisible()).toBe(true);
      const text = await pageText(page);
      expect(text).toContain('Emil');
      expect(text).toContain('Aarhus C');
      expect(text).toContain('Attended 2 of 2 meetups');
      expect(showsIgnoringCase(text, 'Your account')).toBe(true);
      expect(text).toContain('Pod preferences');
      expect(text).toContain('Ages 28–42 · about 10 km');
      expect(text).toContain('Danish, English');
      for (const row of ['Privacy', 'Messages from Friendpod', 'Settings']) {
        expect(await page.getByText(row, { exact: true }).first().isVisible()).toBe(true);
      }
      expect(showsIgnoringCase(text, 'Good to know')).toBe(true);
      for (const row of ['How matching works', 'Meeting safely', 'Private interests']) {
        expect(await page.getByText(row, { exact: true }).first().isVisible()).toBe(true);
      }

      await app.saveScreen('me-shows-the-member-and-their-account.png');
    },
    TIMEOUT,
  );

  test(
    'A setting that kept a new member out is named',
    async () => {
      await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'en' });
      const page = app.page;
      await waitForMe(page, 'Your account');

      const note = 'Your distance is short for your area. Going a little further would help.';
      expect(await page.getByText(note, { exact: true }).first().isVisible()).toBe(true);

      await page.getByText('Change preferences', { exact: true }).first().click();
      await page.waitForURL(/\/settings\/preferences(\?.*)?$/);
      await page.getByRole('heading', { name: 'Pod preferences', exact: true }).first().waitFor({ state: 'visible' });

      await app.saveScreen('a-setting-that-kept-a-new-member-out-is-named.png');
    },
    TIMEOUT,
  );

  test(
    'The account rows open their pages',
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
      const page = app.page;
      await waitForMe(page, 'Your account');

      const rows: { label: string; url: RegExp; back: string }[] = [
        { label: 'Pod preferences', url: /\/settings\/preferences(\?.*)?$/, back: 'Back' },
        { label: 'Messages from Friendpod', url: /\/settings\/notices(\?.*)?$/, back: 'Back' },
        { label: 'Settings', url: /\/settings(\?.*)?$/, back: 'Back' },
        // On Privacy, Back is the "Me" above the title.
        { label: 'Privacy', url: /\/settings\/privacy(\?.*)?$/, back: 'Back: Me' },
      ];

      for (const row of rows) {
        await page.getByText(row.label, { exact: true }).first().click();
        await page.waitForURL(row.url);

        const back = page.getByRole('button', { name: row.back, exact: true }).first();
        const title = page.getByRole('heading', { name: row.label, exact: true }).first();
        await back.waitFor({ state: 'visible' });
        await title.waitFor({ state: 'visible' });
        const backBox = await back.boundingBox();
        const titleBox = await title.boundingBox();
        expect(backBox).not.toBeNull();
        expect(titleBox).not.toBeNull();
        if (backBox !== null && titleBox !== null) {
          expect(backBox.y).toBeLessThan(titleBox.y);
        }

        await back.click();
        await page.waitForURL(/\/me(\?.*)?$/);
        await waitForMe(page, 'Your account');
      }

      await app.saveScreen('the-account-rows-open-their-pages.png');
    },
    TIMEOUT,
  );

  test(
    'Me in Danish',
    async () => {
      await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'da' });
      const page = app.page;
      await waitForMe(page, 'Din konto');

      expect(await page.getByText('Mig', { exact: true }).first().isVisible()).toBe(true);
      const text = await pageText(page);
      expect(text).toContain('Ingen møder endnu');
      expect(showsIgnoringCase(text, 'Din konto')).toBe(true);
      expect(text).toContain('Ønsker til pods');
      expect(text).toContain('28–42 år · ca. 10 km');
      expect(text).toContain('Dansk, Engelsk');

      await app.saveScreen('me-in-danish.png');
    },
    TIMEOUT,
  );
});
