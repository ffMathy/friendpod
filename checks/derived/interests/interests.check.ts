// ail-derived-from: Interests@04f59b53d171c9ae
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../harness/preview';

const TIMEOUT = 120_000;

async function visible(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible', timeout: 15_000 });
}

async function topOf(locator: Locator): Promise<number> {
  await visible(locator);
  const box = await locator.first().boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
}

async function bodyText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

async function interestRowNames(page: Page): Promise<string[]> {
  const more = page.getByRole('button', { name: /^More for / });
  await visible(more);
  const labels = await more.evaluateAll((els) =>
    els.map((el) => ({ label: el.getAttribute('aria-label') ?? el.textContent ?? '', y: el.getBoundingClientRect().y })),
  );
  return labels
    .sort((a, b) => a.y - b.y)
    .map((l) => l.label.replace(/^More for /, '').trim());
}

test(
  'The tab shows every interest and the private one apart',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    const page = app.page;

    await visible(page.getByText('Interests', { exact: true }));
    await visible(page.getByText('5 of 20', { exact: true }));

    expect(await interestRowNames(page)).toEqual(['brætspil', 'sourdough', 'far på barsel', 'trail running']);
    const lastRowY = await topOf(page.getByRole('button', { name: 'More for trail running' }));

    const privateHeading = page.getByText('Private interests', { exact: true });
    const privateHeadingY = await topOf(privateHeading);
    expect(privateHeadingY).toBeGreaterThan(lastRowY);

    const gravidY = await topOf(page.getByText('gravid', { exact: true }));
    expect(gravidY).toBeGreaterThan(privateHeadingY);
    expect(await bodyText(page)).toMatch(/Consent given\s*4 Nov 2026/);

    const howY = await topOf(page.getByText('How private interests work', { exact: true }));
    expect(howY).toBeGreaterThan(gravidY);

    expect(await page.getByText('Add at least 3. 5 or more gives better pods.', { exact: true }).count()).toBe(0);

    await app.saveScreen('the-tab-shows-every-interest-and-the-private-one-apart.png');
  },
  TIMEOUT,
);

test(
  'Fewer than five interests show the nudge',
  async () => {
    await using app = await openApp({
      route: '/interests',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;

    expect(await interestRowNames(page)).toEqual(['brætspil', 'sourdough', 'far på barsel', 'trail running']);
    await visible(page.getByText('4 of 20', { exact: true }));
    await visible(page.getByText('Add at least 3. 5 or more gives better pods.', { exact: true }));

    await app.saveScreen('fewer-than-five-interests-show-the-nudge.png');
  },
  TIMEOUT,
);

test(
  'How private interests work opens its page',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    const page = app.page;

    const link = page.getByText('How private interests work', { exact: true });
    await visible(link);
    await link.first().click();

    await page.waitForURL(/\/info\/sensitive-interests/, { timeout: 15_000 });
    expect(new URL(page.url()).pathname).toBe('/info/sensitive-interests');

    await app.saveScreen('how-private-interests-work-opens-its-page.png');
  },
  TIMEOUT,
);

test(
  'The tab in Danish',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'da' });
    const page = app.page;

    await visible(page.getByText('Interesser', { exact: true }));
    await visible(page.getByText('5 af 20', { exact: true }));
    await visible(page.getByText('Private interesser', { exact: true }));
    expect(await bodyText(page)).toMatch(/Du sagde ja\s*4\. nov\. 2026/);
    await visible(page.getByText('Sådan fungerer private interesser', { exact: true }));

    await app.saveScreen('the-tab-in-danish.png');
  },
  TIMEOUT,
);
