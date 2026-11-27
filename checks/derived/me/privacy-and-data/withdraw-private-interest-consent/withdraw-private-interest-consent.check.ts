// ail-derived-from: WithdrawPrivateInterestConsent@d4c5f7a9a4d1098c
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/settings/sensitive-consent';
const TIMEOUT = 180_000;

/** The see-them link may be exposed as a link or as a pressable; a user finds it by its name either way. */
function linkNamed(page: Page, name: string): Locator {
  return page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).first();
}

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
}

describe('WithdrawPrivateInterestConsent', () => {
  test(
    'The consent shows when it was given and what it covers',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      const givenOn = page.getByText('You agreed on 4 Nov 2026.', { exact: true });
      await expect(givenOn.isVisible()).resolves.toBe(true);
      await givenOn.waitFor({ state: 'visible' });

      const count = page.getByText('1 of your interests is private.', { exact: true });
      await count.waitFor({ state: 'visible' });

      const seeThem = linkNamed(page, 'See them under Interests');
      await seeThem.waitFor({ state: 'visible' });

      const consentText = page.getByText(/^Some interests can reveal your health, religion or beliefs/).first();
      await consentText.waitFor({ state: 'visible' });

      const withdraw = page.getByRole('button', { name: 'Withdraw consent', exact: true });
      await withdraw.waitFor({ state: 'visible' });

      const seeThemTop = await topOf(seeThem);
      const consentTop = await topOf(consentText);
      const withdrawTop = await topOf(withdraw);
      expect(seeThemTop).toBeLessThan(consentTop);
      expect(consentTop).toBeLessThan(withdrawTop);

      expect(await page.getByRole('checkbox').count()).toBe(0);
      expect(await page.getByRole('button', { name: 'I agree', exact: true }).count()).toBe(0);
      expect(await page.getByText('I agree', { exact: true }).count()).toBe(0);

      await app.saveScreen('the-consent-shows-when-it-was-given-and-what-it-covers.png');
    },
    TIMEOUT,
  );

  test(
    'See them under Interests opens Interests',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      const seeThem = linkNamed(page, 'See them under Interests');
      await seeThem.waitFor({ state: 'visible' });
      await seeThem.click();

      await page.getByText('gravid', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Withdraw consent', exact: true }).waitFor({ state: 'hidden' });
      expect(await page.getByText('You agreed on 4 Nov 2026.', { exact: true }).isVisible()).toBe(false);

      await app.saveScreen('see-them-under-interests-opens-interests.png');
    },
    TIMEOUT,
  );

  test(
    'Withdrawing waits for a confirmation',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      const withdraw = page.getByRole('button', { name: 'Withdraw consent', exact: true });
      await withdraw.waitFor({ state: 'visible' });
      await withdraw.click();

      // The phone's dialog does nothing in the preview, so nothing is confirmed.
      await page.waitForTimeout(1_000);
      expect(await page.getByText('You agreed on 4 Nov 2026.', { exact: true }).isVisible()).toBe(true);

      await app.saveScreen('withdrawing-waits-for-a-confirmation.png');
    },
    TIMEOUT,
  );

  test(
    'The given consent in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'da' });
      const page = app.page;

      await page.getByText('Du sagde ja den 4. nov. 2026.', { exact: true }).waitFor({ state: 'visible' });
      await page.getByText('1 af dine interesser er privat.', { exact: true }).waitFor({ state: 'visible' });
      await linkNamed(page, 'Se dem under Interesser').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Træk samtykket tilbage', exact: true }).waitFor({ state: 'visible' });

      await app.saveScreen('the-given-consent-in-danish.png');
    },
    TIMEOUT,
  );
});
