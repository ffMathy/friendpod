// ail-derived-from: MeSettings@8a477716fd4de16d
import { describe, expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('element has no bounding box');
  }
  return box;
}

/** The top of each visible match of a locator. */
async function topsOf(locator: Locator): Promise<number[]> {
  await locator.first().waitFor({ state: 'visible' });
  const tops: number[] = [];
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    if (await item.isVisible()) {
      const box = await item.boundingBox();
      if (box !== null) {
        tops.push(box.y);
      }
    }
  }
  return tops;
}

async function expectVisible(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible' });
  expect(await locator.first().isVisible()).toBe(true);
}

/** Some match of `upper` sits above the first match of `lower`. */
async function expectSomeAbove(upper: Locator, lower: Locator): Promise<void> {
  const lowerBox = await boxOf(lower.first());
  const tops = await topsOf(upper);
  expect(tops.some((top) => top < lowerBox.y)).toBe(true);
}

describe('MeSettings', () => {
  test(
    "Settings lists what Me's row promises",
    async () => {
      await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'en' });
      const page = app.page;

      const title = page.getByText('Settings', { exact: true });
      await expectVisible(title);
      await expectSomeAbove(page.getByText('Me', { exact: true }), title);

      const general = page.getByText('General', { exact: true }).first();
      const legal = page.getByText('Legal', { exact: true }).first();
      const generalBox = await boxOf(general);
      const legalBox = await boxOf(legal);
      expect(generalBox.y).toBeLessThan(legalBox.y);

      const languageGroup = page.getByRole('radiogroup', { name: 'Language' });
      await expectVisible(languageGroup);
      await expectVisible(languageGroup.getByRole('radio', { name: 'Dansk' }));
      await expectVisible(languageGroup.getByRole('radio', { name: 'English' }));

      for (const label of ['Language', 'Notifications', 'Privacy']) {
        const box = await boxOf(page.getByText(label, { exact: true }).first());
        expect(box.y).toBeGreaterThan(generalBox.y);
        expect(box.y).toBeLessThan(legalBox.y);
      }

      const signOut = page.getByRole('button', { name: 'Sign out' });
      const signOutBox = await boxOf(signOut.first());
      for (const label of ['Terms', 'Privacy notice', 'Licences']) {
        const box = await boxOf(page.getByText(label, { exact: true }).first());
        expect(box.y).toBeGreaterThan(legalBox.y);
        expect(box.y).toBeLessThan(signOutBox.y);
      }

      await app.saveScreen('settings-lists-what-me-s-row-promises.png');
    },
    TIMEOUT,
  );

  test(
    'Choosing Dansk switches the app to Danish',
    async () => {
      await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'en' });
      const page = app.page;

      const languageGroup = page.getByRole('radiogroup', { name: 'Language' });
      const dansk = languageGroup.getByRole('radio', { name: 'Dansk' });
      await expectVisible(dansk);
      await dansk.click();

      for (const label of ['Indstillinger', 'Generelt', 'Sprog', 'Notifikationer', 'Juridisk']) {
        await expectVisible(page.getByText(label, { exact: true }));
      }
      await expectVisible(page.getByRole('button', { name: 'Log ud' }));

      await app.saveScreen('choosing-dansk-switches-the-app-to-danish.png');
    },
    TIMEOUT,
  );

  test(
    'Signing out returns to the welcome screen',
    async () => {
      await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'en' });
      const page = app.page;

      const signOut = page.getByRole('button', { name: 'Sign out' });
      await expectVisible(signOut);
      await signOut.first().click();

      await expectVisible(page.getByRole('button', { name: 'Continue with email' }));

      await app.saveScreen('signing-out-returns-to-the-welcome-screen.png');
    },
    TIMEOUT,
  );

  test(
    'The rows open their pages',
    async () => {
      {
        await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'en' });
        const page = app.page;
        const row = page.getByText('Notifications', { exact: true });
        await expectVisible(row);
        await row.first().click();
        await page.waitForURL(/\/settings\/notifications(\?|$)/);
        await expectVisible(page.getByRole('heading', { name: 'Notifications', exact: true }));
        await expectVisible(page.getByText('Know when your drop arrives', { exact: true }));
      }
      {
        await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'en' });
        const page = app.page;
        const row = page.getByText('Privacy', { exact: true });
        await expectVisible(row);
        await row.first().click();
        await page.waitForURL(/\/settings\/privacy(\?|$)/);
        await expectVisible(page.getByRole('heading', { name: 'Privacy', exact: true }));
        await expectVisible(page.getByText("What you've agreed to", { exact: true }));
      }
      {
        await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'en' });
        const page = app.page;
        const row = page.getByText('Terms', { exact: true });
        await expectVisible(row);
        await row.first().click();
        await page.waitForURL(/\/info\/legal\/terms(\?|$)/);
        await expectVisible(page.getByRole('heading', { name: 'Terms', exact: true }));
        await expectVisible(page.getByText(/\bDraft\b/));

        await app.saveScreen('the-rows-open-their-pages.png');
      }
    },
    TIMEOUT,
  );

  test(
    'Settings in Danish',
    async () => {
      await using app = await openApp({ route: '/settings', world: 'member this week', locale: 'da' });
      const page = app.page;

      const title = page.getByText('Indstillinger', { exact: true });
      await expectVisible(title);
      await expectSomeAbove(page.getByText('Mig', { exact: true }), title);

      for (const label of ['Vilkår', 'Privatlivserklæring', 'Licenser']) {
        await expectVisible(page.getByText(label, { exact: true }));
      }
      await expectVisible(page.getByRole('button', { name: 'Log ud' }));

      await app.saveScreen('settings-in-danish.png');
    },
    TIMEOUT,
  );
});
