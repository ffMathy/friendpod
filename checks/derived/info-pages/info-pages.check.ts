// ail-derived-from: InfoPages@4a68795eb787ebbe
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../harness/preview';

const TIMEOUT = 180_000;
const TAB_NAMES = ['This week', 'Pods', 'Interests', 'Me'] as const;

/** Something a user can press with this accessible name: a button or a link (or a tab). */
function pressable(page: Page, name: string): Locator {
  return page
    .getByRole('button', { name, exact: true })
    .or(page.getByRole('link', { name, exact: true }))
    .or(page.getByRole('tab', { name, exact: true }))
    .first();
}

/** Every entry of Friendpod's four-tab bar on the page, however the tab bar exposes them. */
function tabEntries(page: Page, name: string): Locator {
  return page
    .getByRole('tab', { name, exact: true })
    .or(page.getByRole('link', { name, exact: true }))
    .or(page.getByRole('button', { name, exact: true }));
}

async function hasTabBar(page: Page): Promise<boolean> {
  for (const name of TAB_NAMES) {
    const entries = tabEntries(page, name);
    const count = await entries.count();
    let visible = false;
    for (let i = 0; i < count; i++) {
      if (await entries.nth(i).isVisible()) {
        visible = true;
        break;
      }
    }
    if (!visible) return false;
  }
  return true;
}

async function tabBarTop(page: Page): Promise<number> {
  const entries = tabEntries(page, 'This week');
  const count = await entries.count();
  for (let i = 0; i < count; i++) {
    const box = await entries.nth(i).boundingBox();
    if (box !== null) return box.y;
  }
  throw new Error('tab bar not found');
}

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element has no box');
  return box.y;
}

function heading(page: Page, name: string): Locator {
  return page.getByRole('heading', { name, exact: true }).first();
}

test(
  'How matching works opens from Me and goes back',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    await page.getByText('Good to know', { exact: true }).first().waitFor({ state: 'visible' });
    await pressable(page, 'How matching works').click();

    const title = heading(page, 'How matching works');
    await title.waitFor({ state: 'visible' });
    const back = pressable(page, 'Back');
    await back.waitFor({ state: 'visible' });
    expect(await topOf(back)).toBeLessThan(await topOf(title));
    expect(await hasTabBar(page)).toBe(true);
    expect(await tabBarTop(page)).toBeGreaterThan(await topOf(title));

    await back.click();
    await page.getByText('Good to know', { exact: true }).first().waitFor({ state: 'visible' });
    await pressable(page, 'How matching works').waitFor({ state: 'visible' });
    await title.waitFor({ state: 'hidden' });

    await app.saveScreen('how-matching-works-opens-from-me-and-goes-back.png');
  },
  TIMEOUT,
);

test(
  'Pause matching leads to Me',
  async () => {
    await using app = await openApp({ route: '/info/how-matching-works', world: 'member this week', locale: 'en' });
    const page = app.page;

    await heading(page, 'How matching works').waitFor({ state: 'visible' });
    await page.getByRole('link', { name: 'Pause matching', exact: true }).first().click();

    await page.getByText('Weekly drops', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Pause matching', exact: true }).first().waitFor({ state: 'visible' });

    await app.saveScreen('pause-matching-leads-to-me.png');
  },
  TIMEOUT,
);

test(
  'Signed out, the page only says matching can be paused',
  async () => {
    await using app = await openApp({ route: '/info/how-matching-works', world: 'signed out', locale: 'en' });
    const page = app.page;

    await heading(page, 'How matching works').waitFor({ state: 'visible' });
    await page.getByText('You can pause matching at any time.').first().waitFor({ state: 'visible' });

    expect(await page.getByRole('link', { name: 'Pause matching' }).count()).toBe(0);
    expect(await page.getByRole('button', { name: 'Pause matching' }).count()).toBe(0);
    expect(await hasTabBar(page)).toBe(false);

    await app.saveScreen('signed-out-the-page-only-says-matching-can-be-paused.png');
  },
  TIMEOUT,
);

test(
  'The Terms open from the welcome screen and go back',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    await pressable(page, 'Continue with email').waitFor({ state: 'visible' });
    await pressable(page, 'Terms').click();

    await heading(page, 'Terms').waitFor({ state: 'visible' });
    await page.getByText('Draft', { exact: true }).first().waitFor({ state: 'visible' });
    expect(await hasTabBar(page)).toBe(false);

    await pressable(page, 'Back').click();
    await pressable(page, 'Continue with email').waitFor({ state: 'visible' });

    await app.saveScreen('the-terms-open-from-the-welcome-screen-and-go-back.png');
  },
  TIMEOUT,
);

test(
  'The privacy notice from the welcome screen in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'da' });
    const page = app.page;

    const link = pressable(page, 'privatlivserklæringen');
    await link.waitFor({ state: 'visible' });
    await link.click();

    await heading(page, 'Privatlivserklæring').waitFor({ state: 'visible' });
    await page.getByText('Udkast', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Version fra november 2026').first().waitFor({ state: 'visible' });

    await app.saveScreen('the-privacy-notice-from-the-welcome-screen-in-danish.png');
  },
  TIMEOUT,
);

test(
  'Read more on the consent step opens Private interests full screen',
  async () => {
    await using app = await openApp({
      route: '/sensitive-consent',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    const page = app.page;

    const readMore = pressable(page, 'Read more about sensitive interests');
    await readMore.waitFor({ state: 'visible' });
    await readMore.click();

    await page.waitForURL(/\/info\/sensitive-interests/);
    await heading(page, 'Private interests').waitFor({ state: 'visible' });
    expect(await hasTabBar(page)).toBe(false);

    await app.saveScreen('read-more-on-the-consent-step-opens-private-interests-full-s.png');
  },
  TIMEOUT,
);
