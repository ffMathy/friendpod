// ail-derived-from: PodRevealCards@7086055f51ea519d
import { describe, expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 240_000;

const NEEDS_YOU = 'rgb(255, 216, 77)';
const TEXT_MUTED = 'rgb(74, 81, 76)';

const SOLSIKKE = { tint: 'rgb(255, 241, 194)', base: 'rgb(255, 216, 77)' };
const BAER = { tint: 'rgb(253, 226, 236)', base: 'rgb(244, 138, 179)' };
const BLOMME = { tint: 'rgb(237, 225, 246)', base: 'rgb(108, 51, 153)' };

/** The first background colour that is not transparent, from the element up through its ancestors. */
async function ownBackground(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    let node: Element | null = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        return bg;
      }
      node = node.parentElement;
    }
    return 'transparent';
  });
}

/** The chip's tint (the nearest coloured background) and whether a dot inside it is drawn in the base colour. */
async function chipColours(label: Locator, base: string): Promise<{ tint: string; hasDot: boolean }> {
  return label.evaluate((el, dotColour) => {
    let node: Element | null = el;
    let chip: Element | null = null;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        chip = node;
        break;
      }
      node = node.parentElement;
    }
    if (!chip) {
      return { tint: 'transparent', hasDot: false };
    }
    const tint = getComputedStyle(chip).backgroundColor;
    const hasDot = Array.from(chip.querySelectorAll('*')).some(
      (d) => getComputedStyle(d).backgroundColor === dotColour,
    );
    return { tint, hasDot };
  }, base);
}

/** Whether a deadline line sits below the Plan the meetup button. */
async function isUnder(line: Locator, button: Locator): Promise<boolean> {
  const lineBox = await line.boundingBox();
  const buttonBox = await button.boundingBox();
  if (!lineBox || !buttonBox) {
    return false;
  }
  return lineBox.y >= buttonBox.y + buttonBox.height;
}

describe('PodRevealCards', () => {
  test(
    'The shared interests wear their own colours',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member of a confirmed pod', locale: 'en' });
      const page = app.page;

      const heading = page.getByText('More than one of you also likes', { exact: true });
      await expect(heading.isVisible()).resolves.toBe(true);

      const card = page
        .locator('div')
        .filter({ has: heading })
        .filter({ has: page.getByText(/^sourdough$/i) })
        .last();

      const cases: Array<[RegExp, { tint: string; base: string }]> = [
        [/^sourdough$/i, SOLSIKKE],
        [/^coffee$/i, BAER],
        [/^hiking$/i, BLOMME],
      ];
      for (const [name, colour] of cases) {
        const label = card.getByText(name).first();
        expect(await label.isVisible()).toBe(true);
        const chip = await chipColours(label, colour.base);
        expect(chip.tint).toBe(colour.tint);
        expect(chip.hasDot).toBe(true);
      }

      expect(await page.getByText('In their own words', { exact: true }).count()).toBe(0);

      await app.saveScreen('the-shared-interests-wear-their-own-colours.png');
    },
    TIMEOUT,
  );

  test(
    'The deadline is a needs-you pill while there is no option',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member of a confirmed pod', locale: 'en' });
      const page = app.page;

      const button = page.getByRole('button', { name: 'Plan the meetup' });
      expect(await button.isVisible()).toBe(true);

      const line = page.getByText('Pick a time by Tuesday 18:00', { exact: true });
      expect(await line.isVisible()).toBe(true);
      expect(await ownBackground(line)).toBe(NEEDS_YOU);
      expect(await isUnder(line, button)).toBe(true);

      await app.saveScreen('the-deadline-is-a-needs-you-pill-while-there-is-no-option.png');
    },
    TIMEOUT,
  );

  test(
    "Once every option has the viewer's vote, the deadline is quiet",
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member in the extra planning round', locale: 'en' });
      const page = app.page;

      const button = page.getByRole('button', { name: 'Plan the meetup' });
      expect(await button.isVisible()).toBe(true);

      const line = page.getByText('Voting closes Wednesday 18:00', { exact: true });
      expect(await line.isVisible()).toBe(true);
      expect(await ownBackground(line)).not.toBe(NEEDS_YOU);
      expect(await line.evaluate((el) => getComputedStyle(el).color)).toBe(TEXT_MUTED);
      expect(await isUnder(line, button)).toBe(true);

      expect(await page.getByText(/^Vote by /).count()).toBe(0);
      expect(await page.getByText(/^Pick a time by /).count()).toBe(0);

      await app.saveScreen('once-every-option-has-the-viewer-s-vote-the-deadline-is-quie.png');
    },
    TIMEOUT,
  );
});
