// ail-derived-from: PodPage@f9a8bc2b74fb7d96
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../harness/preview';

const TIMEOUT = 180_000;

const TABS = ['This week', 'Pods', 'Interests', 'Me'] as const;

/** The tab named `name` in the tab bar at the page's foot. */
function tab(page: Page, name: string) {
  return page.getByRole('tab', { name, exact: false });
}

/**
 * Whether a tab is drawn selected, as the user sees it: its icon sits on the active pill (color.tab.active.bg). (The
 * pod page's tab bar carries no selected state on the web: react-native-web drops `accessibilityState`.)
 */
function looksSelected(t: Locator): Promise<boolean> {
  return t.evaluate((node) =>
    [node, ...node.querySelectorAll('*')].some((e) => getComputedStyle(e).backgroundColor === 'rgb(225, 239, 233)'),
  );
}

/** Waits until the tab named `name` is drawn selected. */
async function waitSelected(page: Page, name: string): Promise<void> {
  const t = tab(page, name).first();
  await t.waitFor({ state: 'visible' });
  const handle = await t.elementHandle();
  await t.page().waitForFunction(
    (node) => [node, ...node.querySelectorAll('*')].some((e) => getComputedStyle(e).backgroundColor === 'rgb(225, 239, 233)'),
    handle,
  );
  expect(await looksSelected(t)).toBe(true);
}

test(
  'A pod that no longer exists',
  async () => {
    await using app = await openApp({ route: '/pod/doesnotexist', world: 'member of a confirmed pod', locale: 'en' });
    const page = app.page;

    const gone = page.getByText('This pod no longer exists.', { exact: true });
    await gone.waitFor({ state: 'visible' });
    expect(await gone.isVisible()).toBe(true);

    for (const name of TABS) {
      const t = tab(page, name).first();
      await t.waitFor({ state: 'visible' });
      expect(await t.isVisible()).toBe(true);
    }
    await waitSelected(page, 'Pods');
    for (const name of ['This week', 'Interests', 'Me']) {
      expect(await looksSelected(tab(page, name).first())).toBe(false);
    }

    await app.saveScreen('a-pod-that-no-longer-exists.png');
  },
  TIMEOUT,
);

test(
  'Back from a pod opened on its own goes to the Pods tab',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46',
      world: 'member the day before a meetup',
      locale: 'en',
    });
    const page = app.page;

    const back = page.getByRole('button', { name: 'Back' }).first();
    await back.waitFor({ state: 'visible' });
    await back.click();

    // The section header reads "Active · <count>".
    const active = page.getByText(/^Active\b/).first();
    await active.waitFor({ state: 'visible' });
    // Off the pod page, the main tab bar shows which tab is selected.
    const pods = page.getByRole('tab', { name: 'Pods', exact: false, selected: true }).first();
    await pods.waitFor({ state: 'visible' });
    expect(await pods.isVisible()).toBe(true);
    expect(new URL(page.url()).pathname.startsWith('/pod/')).toBe(false);

    const activeBox = await active.boundingBox();
    expect(activeBox).not.toBeNull();
    const pod = page.getByText('brætspil', { exact: false });
    await pod.first().waitFor({ state: 'visible' });
    const count = await pod.count();
    let under = false;
    for (let i = 0; i < count; i += 1) {
      const box = await pod.nth(i).boundingBox();
      if (box !== null && activeBox !== null && box.y > activeBox.y && (await pod.nth(i).isVisible())) {
        under = true;
        break;
      }
    }
    expect(under).toBe(true);

    await app.saveScreen('back-from-a-pod-opened-on-its-own-goes-to-the-pods-tab.png');
  },
  TIMEOUT,
);

test(
  'A tab leaves the pod',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46',
      world: 'member of a confirmed pod',
      locale: 'en',
    });
    const page = app.page;

    await waitSelected(page, 'Pods');

    const thisWeek = tab(page, 'This week').first();
    await thisWeek.click();

    await page.waitForURL((url) => !url.pathname.startsWith('/pod/'));
    // Off the pod page, the main tab bar shows which tab is selected.
    const selected = page.getByRole('tab', { name: 'This week', exact: false, selected: true }).first();
    await selected.waitFor({ state: 'visible' });
    expect(await selected.isVisible()).toBe(true);
    expect(new URL(page.url()).pathname.startsWith('/pod/')).toBe(false);

    await app.saveScreen('a-tab-leaves-the-pod.png');
  },
  TIMEOUT,
);

test(
  'A pod that no longer exists, in Danish',
  async () => {
    await using app = await openApp({ route: '/pod/doesnotexist', world: 'member of a confirmed pod', locale: 'da' });
    const page = app.page;

    const gone = page.getByText('Denne pod findes ikke længere.', { exact: true });
    await gone.waitFor({ state: 'visible' });
    expect(await gone.isVisible()).toBe(true);

    await app.saveScreen('a-pod-that-no-longer-exists-in-danish.png');
  },
  TIMEOUT,
);
