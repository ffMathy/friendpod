// ail-derived-from: MatchOnCard@5426236bdde05af9
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

/**
 * The What we'll match on card: the innermost block that holds both the card's title (a header) and its
 * summary line. The title row alone does not hold the summary, so this is the card itself.
 */
function matchOnCard(page: Page, title: string, summary: string): Locator {
  const heading = page.getByRole('heading', { name: title });
  return page.locator('div').filter({ has: heading }).filter({ hasText: summary }).last();
}

/** Waits until the locator's whole text contains every expected part, then returns that text. */
async function waitForText(locator: Locator, parts: string[], timeoutMs = 30_000): Promise<string> {
  const end = Date.now() + timeoutMs;
  let text = '';
  while (Date.now() < end) {
    text = ((await locator.textContent()) ?? '').replace(/\s+/g, ' ');
    if (parts.every((part) => text.includes(part))) {
      return text;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return text;
}

test(
  'The card before the drop',
  async () => {
    await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
    const summary = 'Aarhus C · about 10 km · ages 28–42 · Danish, English';
    const card = matchOnCard(app.page, "What we'll match on", summary);
    await card.waitFor({ state: 'visible' });

    const interests = ['brætspil', 'sourdough', 'far på barsel', 'trail running'];
    const text = await waitForText(card, interests);
    for (const interest of interests) {
      expect(text).toContain(interest);
    }
    expect(text).not.toContain('gravid');
    expect(text).toContain(summary);

    await app.saveScreen('the-card-before-the-drop.png');
  },
  TIMEOUT,
);

test(
  'Edit opens the interests',
  async () => {
    await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
    const card = matchOnCard(app.page, "What we'll match on", 'about 10 km');
    await card.waitFor({ state: 'visible' });

    const edit = card.getByRole('link', { name: 'Edit' });
    await edit.click();
    await app.page.waitForURL(/\/interests(\?.*)?$/, { timeout: 30_000 });
    expect(new URL(app.page.url()).pathname).toBe('/interests');

    await app.saveScreen('edit-opens-the-interests.png');
  },
  TIMEOUT,
);

test(
  'The card in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'member this week', locale: 'da' });
    const summary = 'Aarhus C · ca. 10 km · 28–42 år · Dansk, Engelsk';
    const card = matchOnCard(app.page, 'Det matcher vi på', summary);
    await card.waitFor({ state: 'visible' });

    await card.getByRole('heading', { name: 'Det matcher vi på' }).waitFor({ state: 'visible' });
    await card.getByRole('link', { name: 'Ret' }).waitFor({ state: 'visible' });
    const text = await waitForText(card, [summary]);
    expect(text).toContain(summary);

    await app.saveScreen('the-card-in-danish.png');
  },
  TIMEOUT,
);
