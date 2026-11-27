// ail-derived-from: EmailLinkLanding@c2080a3b41ed3380
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const SIGN_IN_LINK_ROUTE =
  '/auth/complete?link=https%3A%2F%2Ffriendpod-staging.firebaseapp.com%2F__%2Fauth%2Faction%3Fmode%3DsignIn%26oobCode%3Dpreview';
const NOT_A_SIGN_IN_LINK_ROUTE =
  '/auth/complete?link=https%3A%2F%2Ffriendpod-staging.firebaseapp.com%2F__%2Fauth%2Faction%3Fmode%3DsignIn';
const NO_LINK_ROUTE = '/auth/complete';

const TIMEOUT = 180_000;
const WAIT = 30_000;

/** Waits until the page's visible text contains the given text, even when it is composed across elements. */
async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction((t: string) => document.body.innerText.includes(t), text, { timeout: WAIT });
}

/** Whether the page's visible text contains the given text right now. */
async function hasText(page: Page, text: string): Promise<boolean> {
  return page.evaluate((t: string) => document.body.innerText.includes(t), text);
}

/** Something to press with that name, whether it is shown as a link or a button. */
function pressable(page: Page, name: string): Locator {
  return page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).first();
}

describe('EmailLinkLanding', () => {
  test(
    'A link opened on the phone that asked for it signs in at once',
    async () => {
      await using app = await openApp({ route: SIGN_IN_LINK_ROUTE, world: 'signed out, email link sent', locale: 'en' });
      const page = app.page;

      await waitForText(page, 'About you');
      await waitForText(page, 'Step 1 of 6');
      expect(await hasText(page, 'About you')).toBe(true);
      expect(await hasText(page, 'Step 1 of 6')).toBe(true);

      await app.saveScreen('a-link-opened-on-the-phone-that-asked-for-it-signs-in-at-onc.png');
    },
    TIMEOUT,
  );

  test(
    'A link that does not work offers a new one',
    async () => {
      await using app = await openApp({
        route: NOT_A_SIGN_IN_LINK_ROUTE,
        world: 'signed out, email link sent',
        locale: 'en',
      });
      const page = app.page;

      await waitForText(page, 'That link didn’t work');
      await waitForText(page, 'This isn’t a valid sign-in link. Ask for a new one.');
      expect(await hasText(page, 'That link didn’t work')).toBe(true);
      expect(await hasText(page, 'This isn’t a valid sign-in link. Ask for a new one.')).toBe(true);

      const newLink = page.getByRole('button', { name: 'Send a new link', exact: true });
      await newLink.waitFor({ state: 'visible', timeout: WAIT });
      await newLink.click();

      await waitForText(page, 'Sign in with email');
      const email = page.getByLabel('Email address');
      await email.waitFor({ state: 'visible', timeout: WAIT });
      expect(await email.inputValue()).toBe('emil@example.com');

      await app.saveScreen('a-link-that-does-not-work-offers-a-new-one.png');
    },
    TIMEOUT,
  );

  test(
    'Back to the start from a link that does not work',
    async () => {
      await using app = await openApp({
        route: NOT_A_SIGN_IN_LINK_ROUTE,
        world: 'signed out, email link sent',
        locale: 'en',
      });
      const page = app.page;

      await waitForText(page, 'That link didn’t work');

      const back = pressable(page, 'Back to the start');
      await back.waitFor({ state: 'visible', timeout: WAIT });
      await back.click();

      await waitForText(page, 'Continue with email');
      expect(await hasText(page, 'Continue with email')).toBe(true);
      expect(await hasText(page, 'That link didn’t work')).toBe(false);

      await app.saveScreen('back-to-the-start-from-a-link-that-does-not-work.png');
    },
    TIMEOUT,
  );

  test(
    'Opened without a link, the landing only waits',
    async () => {
      await using app = await openApp({ route: NO_LINK_ROUTE, world: 'signed out', locale: 'en' });
      const page = app.page;

      await waitForText(page, 'Signing you in');
      await waitForText(page, 'This only takes a moment.');
      const spinner = page.getByRole('progressbar', { name: 'Signing you in' });
      await spinner.waitFor({ state: 'visible', timeout: WAIT });

      // It only waits: give it a moment, then it is still the same, with nothing to press or fill in.
      await page.waitForTimeout(1500);
      expect(await hasText(page, 'Signing you in')).toBe(true);
      expect(await hasText(page, 'This only takes a moment.')).toBe(true);
      expect(await spinner.isVisible()).toBe(true);
      expect(await page.getByRole('button').count()).toBe(0);
      expect(await page.getByRole('link').count()).toBe(0);
      expect(await page.getByRole('textbox').count()).toBe(0);
      expect(await page.getByRole('alert').count()).toBe(0);

      await app.saveScreen('opened-without-a-link-the-landing-only-waits.png');
    },
    TIMEOUT,
  );

  test(
    'A link that does not work, in Danish',
    async () => {
      await using app = await openApp({
        route: NOT_A_SIGN_IN_LINK_ROUTE,
        world: 'signed out, email link sent',
        locale: 'da',
      });
      const page = app.page;

      await waitForText(page, 'Linket virkede ikke');
      await waitForText(page, 'Linket er ikke gyldigt. Bed om et nyt.');
      expect(await hasText(page, 'Linket virkede ikke')).toBe(true);
      expect(await hasText(page, 'Linket er ikke gyldigt. Bed om et nyt.')).toBe(true);

      const newLink = page.getByRole('button', { name: 'Send et nyt link', exact: true });
      await newLink.waitFor({ state: 'visible', timeout: WAIT });
      const back = pressable(page, 'Tilbage til start');
      await back.waitFor({ state: 'visible', timeout: WAIT });

      await app.saveScreen('a-link-that-does-not-work-in-danish.png');
    },
    TIMEOUT,
  );
});
