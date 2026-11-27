// ail-derived-from: MeInterestsCard@3eb2463d7aa24f5d
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview.ts';

const TIMEOUT = 180_000;

/** The innermost element that holds both the card's title and its Edit link: the Your interests card. */
function interestsCard(page: Page, title: RegExp, editLabel: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByText(title) })
    .filter({ has: page.getByRole('link', { name: editLabel, exact: true }) })
    .last();
}

test(
  'Interests as chips, the private one only counted',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    const card = interestsCard(page, /^\s*your interests\s*$/i, 'Edit your interests');
    await card.waitFor({ state: 'visible' });

    for (const word of ['brætspil', 'sourdough', 'far på barsel', 'trail running']) {
      expect(await card.getByText(word, { exact: true }).count()).toBeGreaterThanOrEqual(1);
      await card.getByText(word, { exact: true }).first().waitFor({ state: 'visible' });
    }

    // Exactly one star, and it belongs to the brætspil chip.
    const stars = card.getByRole('img', { name: 'Main interest', exact: true });
    expect(await stars.count()).toBe(1);
    const brætspilChip = card
      .locator('div')
      .filter({ has: page.getByText('brætspil', { exact: true }) })
      .filter({ has: page.getByRole('img', { name: 'Main interest', exact: true }) })
      .filter({ hasNot: page.getByText('sourdough', { exact: true }) });
    expect(await brætspilChip.count()).toBeGreaterThanOrEqual(1);

    const cardText = (await card.textContent()) ?? '';
    expect(cardText).toMatch(/\b1 private interest(?!s)/);

    const pageText = (await page.locator('body').textContent()) ?? '';
    expect(pageText.toLowerCase()).not.toContain('gravid');
    expect(await page.getByLabel(/gravid/i).count()).toBe(0);
    expect(await page.getByRole('img', { name: /gravid/i }).count()).toBe(0);

    await app.saveScreen('interests-as-chips-the-private-one-only-counted.png');
  },
  TIMEOUT,
);

test(
  'Edit opens the Interests tab',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    const edit = page.getByRole('link', { name: 'Edit your interests', exact: true });
    await edit.waitFor({ state: 'visible' });
    await edit.click();

    await page.waitForURL((url) => url.pathname === '/interests');
    expect(new URL(page.url()).pathname).toBe('/interests');

    await app.saveScreen('edit-opens-the-interests-tab.png');
  },
  TIMEOUT,
);

test(
  'Your interests in Danish',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'da' });
    const page = app.page;

    const card = interestsCard(page, /^\s*dine interesser\s*$/i, 'Ret dine interesser');
    await card.waitFor({ state: 'visible' });

    const edit = card.getByRole('link', { name: 'Ret dine interesser', exact: true });
    expect(((await edit.textContent()) ?? '').trim()).toBe('Ret');

    const cardText = (await card.textContent()) ?? '';
    expect(cardText).toMatch(/\b1 privat interesse(?!r)/);

    await app.saveScreen('your-interests-in-danish.png');
  },
  TIMEOUT,
);
