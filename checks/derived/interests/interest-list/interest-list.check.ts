// ail-derived-from: InterestList@4034a7077f1b2b7b
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

/** Waits until the locator matches exactly `n` elements, then returns the count it settled on. */
async function settleCount(locator: Locator, n: number, ms = 10_000): Promise<number> {
  const until = Date.now() + ms;
  let count = await locator.count();
  while (count !== n && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    count = await locator.count();
  }
  return count;
}

/** Whether the page's visible text, with whitespace collapsed, comes to contain `text` within the time allowed. */
async function pageSays(page: Page, text: string, ms = 10_000): Promise<boolean> {
  try {
    await page.waitForFunction(
      (wanted: string) => document.body.innerText.replace(/\s+/g, ' ').includes(wanted),
      text,
      { timeout: ms },
    );
    return true;
  } catch {
    return false;
  }
}

test(
  '"…" opens the row\'s actions',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    const page = app.page;

    const more = page.getByRole('button', { name: 'More for sourdough', exact: true });
    await more.waitFor({ state: 'visible' });

    const keepPrivate = page.getByRole('button', { name: 'Keep this private', exact: true });
    const remove = page.getByRole('button', { name: 'Remove sourdough', exact: true });
    const keepBefore = await keepPrivate.count();
    expect(await remove.count()).toBe(0);

    await more.click();
    await remove.waitFor({ state: 'visible' });
    expect(await remove.isVisible()).toBe(true);
    expect(await settleCount(keepPrivate, keepBefore + 1)).toBe(keepBefore + 1);

    await more.click();
    expect(await settleCount(remove, 0)).toBe(0);
    expect(await settleCount(keepPrivate, keepBefore)).toBe(keepBefore);

    await app.saveScreen('opens-the-row-s-actions.png');
  },
  TIMEOUT,
);

test(
  'Remove takes an interest off the list at once',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    const page = app.page;

    const more = page.getByRole('button', { name: 'More for sourdough', exact: true });
    await more.waitFor({ state: 'visible' });
    expect(await pageSays(page, '5 of 20')).toBe(true);

    await more.click();
    const remove = page.getByRole('button', { name: 'Remove sourdough', exact: true });
    await remove.waitFor({ state: 'visible' });
    await remove.click();

    expect(await settleCount(more, 0)).toBe(0);
    expect(await settleCount(page.getByRole('button', { name: 'Star sourdough', exact: true }), 0)).toBe(0);
    expect(await settleCount(remove, 0)).toBe(0);
    expect(await pageSays(page, '4 of 20')).toBe(true);
    expect(await pageSays(page, 'Add at least 3. 5 or more gives better pods.')).toBe(true);

    await app.saveScreen('remove-takes-an-interest-off-the-list-at-once.png');
  },
  TIMEOUT,
);

test(
  'An interest made ordinary keeps Keep this private at hand',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    const page = app.page;

    const name = page.getByText('far på barsel', { exact: true }).first();
    await name.waitFor({ state: 'visible' });

    const keepPrivate = page.getByRole('button', { name: 'Keep this private', exact: true });
    await keepPrivate.first().waitFor({ state: 'visible' });
    const keepBefore = await keepPrivate.count();
    expect(keepBefore).toBeGreaterThanOrEqual(1);
    expect(await page.getByRole('button', { name: 'More for far på barsel', exact: true }).count()).toBe(0);

    const remove = page.getByRole('button', { name: 'Remove far på barsel', exact: true });
    expect(await remove.count()).toBe(0);

    await name.click();
    await remove.waitFor({ state: 'visible' });
    expect(await remove.isVisible()).toBe(true);
    expect(await settleCount(keepPrivate, keepBefore)).toBe(keepBefore);

    await app.saveScreen('an-interest-made-ordinary-keeps-keep-this-private-at-hand.png');
  },
  TIMEOUT,
);

test(
  "The row's actions in Danish",
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'da' });
    const page = app.page;

    const more = page.getByRole('button', { name: 'Flere valg for brætspil', exact: true });
    await more.waitFor({ state: 'visible' });

    const keepPrivate = page.getByRole('button', { name: 'Hold den privat', exact: true });
    const remove = page.getByRole('button', { name: 'Fjern brætspil', exact: true });
    const keepBefore = await keepPrivate.count();
    expect(await remove.count()).toBe(0);

    await more.click();
    await remove.waitFor({ state: 'visible' });
    expect(await remove.isVisible()).toBe(true);
    expect((await remove.innerText()).replace(/\s+/g, ' ').trim()).toContain('Fjern');
    expect(await settleCount(keepPrivate, keepBefore + 1)).toBe(keepBefore + 1);

    await app.saveScreen('the-row-s-actions-in-danish.png');
  },
  TIMEOUT,
);
