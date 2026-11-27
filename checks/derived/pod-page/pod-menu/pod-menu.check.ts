// ail-derived-from: PodMenu@ac9176ff10c02c9f
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const POD_ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 180_000;

async function shows(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible' });
  expect(await locator.isVisible()).toBe(true);
}

async function gone(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'hidden' });
  expect(await locator.count()).toBe(0);
}

async function pageReads(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (wanted: string) => (document.body.innerText || '').replace(/\s+/g, ' ').includes(wanted),
    text,
  );
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  expect(body).toContain(text);
}

test(
  'The menu offers the safety tips and Leave pod',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'More options' }).click();

    await shows(page.getByRole('dialog').getByText('More options', { exact: true }));
    await shows(page.getByRole('dialog').getByText('Meeting safely', { exact: true }));
    await shows(page.getByRole('dialog').getByText('Leave pod', { exact: true }));

    await app.saveScreen('the-menu-offers-the-safety-tips-and-leave-pod.png');
  },
  TIMEOUT,
);

test(
  'Meeting safely in the menu opens the safety tips',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'More options' }).click();
    await shows(page.getByRole('dialog').getByText('Meeting safely', { exact: true }));

    await page.getByRole('dialog').getByText('Meeting safely', { exact: true }).click();

    await shows(page.getByRole('heading', { name: 'Meeting safely' }));
    await shows(page.getByRole('heading', { name: 'Before you go' }));

    await app.saveScreen('meeting-safely-in-the-menu-opens-the-safety-tips.png');
  },
  TIMEOUT,
);

test(
  'Close shuts the menu',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'More options' }).click();
    await shows(page.getByRole('dialog').getByText('More options', { exact: true }));

    await page.getByRole('button', { name: 'Close' }).click();

    await gone(page.getByRole('dialog').getByText('More options', { exact: true }));
    await gone(page.getByRole('dialog').getByText('Leave pod', { exact: true }));
    await pageReads(page, 'Still coming tomorrow at 14:00?');

    await app.saveScreen('close-shuts-the-menu.png');
  },
  TIMEOUT,
);

test(
  'The reveal has the same menu',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member of a confirmed pod', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'More options' }).click();

    await shows(page.getByRole('dialog').getByText('Meeting safely', { exact: true }));
    await shows(page.getByRole('dialog').getByText('Leave pod', { exact: true }));

    await app.saveScreen('the-reveal-has-the-same-menu.png');
  },
  TIMEOUT,
);

test(
  'The menu in Danish',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'da' });
    const page = app.page;

    await page.getByRole('button', { name: 'Flere muligheder' }).click();

    await shows(page.getByRole('dialog').getByText('Mød hinanden trygt', { exact: true }));
    await shows(page.getByRole('dialog').getByText('Forlad poden', { exact: true }));

    await app.saveScreen('the-menu-in-danish.png');
  },
  TIMEOUT,
);
