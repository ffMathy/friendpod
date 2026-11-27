// ail-derived-from: HomeTabBar@815f28a168dfb880
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../harness/preview.ts';

const TIMEOUT = 300_000;

async function leftOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? Number.NaN : box.x;
}

async function expectTabsInOrder(tablist: Locator, names: readonly string[]): Promise<void> {
  expect(await tablist.getByRole('tab').count()).toBe(names.length);
  const xs: number[] = [];
  for (const name of names) {
    const tab = tablist.getByRole('tab', { name, exact: true });
    expect(await tab.count()).toBe(1);
    xs.push(await leftOf(tab));
  }
  for (let i = 1; i < xs.length; i += 1) {
    const previous = xs[i - 1];
    const current = xs[i];
    expect(previous).toBeDefined();
    expect(current).toBeDefined();
    if (previous !== undefined && current !== undefined) {
      expect(current).toBeGreaterThan(previous);
    }
  }
}

async function expectSelected(tablist: Locator, name: string): Promise<void> {
  expect(await tablist.getByRole('tab', { selected: true }).count()).toBe(1);
  expect(await tablist.getByRole('tab', { name, exact: true, selected: true }).count()).toBe(1);
}

test(
  'This week is the active tab on Home',
  async () => {
    await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
    const tablist = app.page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible' });
    await expectTabsInOrder(tablist, ['This week', 'Pods', 'Interests', 'Me']);
    await expectSelected(tablist, 'This week');
    await app.saveScreen('this-week-is-the-active-tab-on-home.png');
  },
  TIMEOUT,
);

test(
  'The tab bar in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'member this week', locale: 'da' });
    const tablist = app.page.getByRole('tablist');
    await tablist.waitFor({ state: 'visible' });
    await expectTabsInOrder(tablist, ['Denne uge', 'Pods', 'Interesser', 'Mig']);
    await expectSelected(tablist, 'Denne uge');
    await app.saveScreen('the-tab-bar-in-danish.png');
  },
  TIMEOUT,
);
