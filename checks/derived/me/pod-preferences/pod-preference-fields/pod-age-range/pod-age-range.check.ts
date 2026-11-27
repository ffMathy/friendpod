// ail-derived-from: PodAgeRange@23c9fdaeb8786ffd
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../../harness/preview';

const ROUTE = '/settings/preferences';
const WORLD = 'member this week';
const TIMEOUT = 180_000;

/** The ages card: the innermost element holding both sliders and the card's label. */
function agesCard(page: Page, label: string, youngest: string, oldest: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByRole('slider', { name: youngest, exact: true }) })
    .filter({ has: page.getByRole('slider', { name: oldest, exact: true }) })
    .filter({ hasText: label })
    .last();
}

async function textOf(locator: Locator): Promise<string> {
  return (await locator.textContent()) ?? '';
}

/** Waits until the card's text contains every expected part, then asserts it. */
async function expectCardReads(card: Locator, parts: string[]): Promise<void> {
  const deadline = Date.now() + 5_000;
  let text = await textOf(card);
  while (!parts.every((part) => text.includes(part)) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    text = await textOf(card);
  }
  for (const part of parts) {
    expect(text).toContain(part);
  }
}

/** Drags a slider thumb with the mouse all the way to the right edge of the screen. */
async function dragAllTheWayRight(page: Page, thumb: Locator): Promise<void> {
  await thumb.scrollIntoViewIfNeeded();
  const box = await thumb.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(389, y, { steps: 25 });
  await page.mouse.up();
}

test(
  'The saved range',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;
    const youngest = page.getByRole('slider', { name: 'Youngest age', exact: true });
    const oldest = page.getByRole('slider', { name: 'Oldest age', exact: true });
    await youngest.waitFor();
    expect(await youngest.isVisible()).toBe(true);
    expect(await oldest.isVisible()).toBe(true);

    const card = agesCard(page, 'Ages', 'Youngest age', 'Oldest age');
    await expectCardReads(card, ['Ages', '28–42']);

    const hint = page.getByText("Starts around your own age. Everyone in a pod fits everyone else's range.", {
      exact: true,
    });
    expect(await hint.isVisible()).toBe(true);

    await app.saveScreen('the-saved-range.png');
  },
  TIMEOUT,
);

test(
  'The youngest age stops five years below the oldest',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;
    const youngest = page.getByRole('slider', { name: 'Youngest age', exact: true });
    await youngest.waitFor();

    await dragAllTheWayRight(page, youngest);

    const card = agesCard(page, 'Ages', 'Youngest age', 'Oldest age');
    await expectCardReads(card, ['37–42']);

    await app.saveScreen('the-youngest-age-stops-five-years-below-the-oldest.png');
  },
  TIMEOUT,
);

test(
  'The oldest age goes up to 99',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;
    const oldest = page.getByRole('slider', { name: 'Oldest age', exact: true });
    await oldest.waitFor();

    await dragAllTheWayRight(page, oldest);

    const card = agesCard(page, 'Ages', 'Youngest age', 'Oldest age');
    await expectCardReads(card, ['28–99']);

    await app.saveScreen('the-oldest-age-goes-up-to-99.png');
  },
  TIMEOUT,
);

test(
  'Ages in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;
    const youngest = page.getByRole('slider', { name: 'Yngste alder', exact: true });
    await youngest.waitFor();

    const card = agesCard(page, 'Alder', 'Yngste alder', 'Ældste alder');
    await expectCardReads(card, ['Alder', '28–42']);

    const hint = page.getByText(
      'Starter omkring din egen alder. Alle i en pod passer ind i hinandens aldersinterval.',
      { exact: true },
    );
    expect(await hint.isVisible()).toBe(true);

    await app.saveScreen('ages-in-danish.png');
  },
  TIMEOUT,
);
