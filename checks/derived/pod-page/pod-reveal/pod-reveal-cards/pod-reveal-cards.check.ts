// ail-derived-from: PodRevealCards@44845595ce4be41f
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;
type Locator = ReturnType<App['page']['locator']>;

const ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 300_000;

const NEEDS_YOU = 'rgb(255, 216, 77)';
const TEXT_SECONDARY = 'rgb(58, 66, 61)';

const SOLSIKKE = { tint: 'rgb(255, 241, 194)', base: 'rgb(255, 216, 77)' };
const BAER = { tint: 'rgb(253, 226, 236)', base: 'rgb(244, 138, 179)' };
const BLOMME = { tint: 'rgb(237, 225, 246)', base: 'rgb(108, 51, 153)' };

/** The background of the nearest element, the locator's own or an ancestor's, that paints one. */
async function backgroundOf(locator: Locator): Promise<string> {
  return locator.evaluate((el) => {
    let node: Element | null = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        return bg;
      }
      node = node.parentElement;
    }
    return '';
  });
}

/** Whether the target's top edge is at or below the bottom edge of the reference. */
async function isUnder(target: Locator, reference: Locator): Promise<boolean> {
  const t = await target.boundingBox();
  const r = await reference.boundingBox();
  if (t === null || r === null) {
    return false;
  }
  return t.y >= r.y + r.height - 1;
}

type ChipInfo = { word: string; found: boolean; background: string; dots: string[] };

/** For each word, the chip inside the card holding the heading: its background and the backgrounds inside it. */
async function chipsUnder(heading: Locator, words: string[]): Promise<ChipInfo[]> {
  return heading.evaluate((el, list) => {
    const painted = (n: Element): string => {
      const bg = getComputedStyle(n).backgroundColor;
      return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : '';
    };
    let card: Element | null = el;
    while (card) {
      const text = (card.textContent ?? '').toLowerCase();
      if (list.every((w) => text.includes(w.toLowerCase()))) {
        break;
      }
      card = card.parentElement;
    }
    return list.map((word) => {
      if (card === null) {
        return { word, found: false, background: '', dots: [] };
      }
      const all = Array.from(card.querySelectorAll('*'));
      const leaf = all.find((n) =>
        Array.from(n.childNodes).some(
          (c) => c.nodeType === 3 && (c.textContent ?? '').toLowerCase().includes(word.toLowerCase()),
        ),
      );
      if (leaf === undefined) {
        return { word, found: false, background: '', dots: [] };
      }
      let chip: Element | null = leaf;
      while (chip && chip !== card && painted(chip) === '') {
        chip = chip.parentElement;
      }
      if (chip === null || chip === card) {
        return { word, found: true, background: '', dots: [] };
      }
      const dots = Array.from(chip.querySelectorAll('*'))
        .map((n) => painted(n))
        .filter((bg) => bg !== '');
      return { word, found: true, background: painted(chip), dots };
    });
  }, words);
}

test('The shared interests wear their own colours', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member of a confirmed pod', locale: 'en' });
  const page = app.page;

  const heading = page.getByText('More than one of you also likes', { exact: true });
  await expect(heading.isVisible()).resolves.toBe(true);

  const chips = await chipsUnder(heading, ['sourdough', 'coffee', 'hiking']);
  const expected = [SOLSIKKE, BAER, BLOMME];
  chips.forEach((chip, i) => {
    const colour = expected[i];
    expect(chip.found).toBe(true);
    if (colour !== undefined) {
      expect(chip.background).toBe(colour.tint);
      expect(chip.dots).toContain(colour.base);
    }
  });

  await expect(page.getByText('In their own words', { exact: true }).count()).resolves.toBe(0);

  await app.saveScreen('the-shared-interests-wear-their-own-colours.png');
}, TIMEOUT);

test('The deadline is a needs-you pill while there is no option', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member of a confirmed pod', locale: 'en' });
  const page = app.page;

  const button = page.getByRole('button', { name: 'Plan the meetup' });
  await expect(button.isVisible()).resolves.toBe(true);

  const deadline = page.getByText('Pick a time by Tuesday 18:00', { exact: true });
  await expect(deadline.isVisible()).resolves.toBe(true);
  await expect(backgroundOf(deadline)).resolves.toBe(NEEDS_YOU);
  await expect(isUnder(deadline, button)).resolves.toBe(true);

  await app.saveScreen('the-deadline-is-a-needs-you-pill-while-there-is-no-option.png');
}, TIMEOUT);

test("Once every option has the viewer's vote, the deadline is quiet", async () => {
  await using app = await openApp({ route: ROUTE, world: 'member in the extra planning round', locale: 'en' });
  const page = app.page;

  const button = page.getByRole('button', { name: 'Plan the meetup' });
  await expect(button.isVisible()).resolves.toBe(true);

  const deadline = page.getByText('Voting closes Wednesday 18:00', { exact: true });
  await expect(deadline.isVisible()).resolves.toBe(true);
  await expect(isUnder(deadline, button)).resolves.toBe(true);
  await expect(backgroundOf(deadline)).resolves.not.toBe(NEEDS_YOU);
  await expect(deadline.evaluate((el) => getComputedStyle(el).color)).resolves.toBe(TEXT_SECONDARY);

  await expect(page.getByText(/^(Pick a time by|Vote by) /).count()).resolves.toBe(0);

  await app.saveScreen('once-every-option-has-the-viewer-s-vote-the-deadline-is-quie.png');
}, TIMEOUT);
