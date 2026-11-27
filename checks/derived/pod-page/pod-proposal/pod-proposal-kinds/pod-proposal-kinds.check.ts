// ail-derived-from: PodProposalKinds@b61051192454eeb4
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;
type Page = App['page'];
type Locator = ReturnType<Page['getByText']>;

const TIMEOUT = 180_000;
const WAIT_MS = 15_000;

// Pod colours and private-card colours from the design tokens, as computed CSS colours.
const FJORD_DEEP = 'rgb(18, 69, 147)'; // pod.fjord.deep #124593
const FJORD_TINT = 'rgb(221, 231, 251)'; // pod.fjord.tint #DDE7FB
const SOLSIKKE_DEEP = 'rgb(106, 73, 0)'; // pod.solsikke.deep #6A4900
const SOLSIKKE_TINT = 'rgb(255, 241, 194)'; // pod.solsikke.tint #FFF1C2
const TOMAT_DEEP = 'rgb(140, 33, 7)'; // pod.tomat.deep #8C2107
const TOMAT_TINT = 'rgb(253, 226, 217)'; // pod.tomat.tint #FDE2D9
const BLOMME_DEEP = 'rgb(79, 34, 114)'; // pod.blomme.deep #4F2272
const BLOMME_TINT = 'rgb(237, 225, 246)'; // pod.blomme.tint #EDE1F6
const INK = 'rgb(24, 33, 29)'; // color.text / color.ink #18211D
const WHITE = 'rgb(255, 255, 255)'; // color.private.bg #FFFFFF

function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

async function pageText(page: Page): Promise<string> {
  return normalize(await page.locator('body').innerText());
}

/** Waits until the page's whole text contains every given text, then returns that text. */
async function waitForTexts(page: Page, texts: string[]): Promise<string> {
  const end = Date.now() + WAIT_MS;
  let text = await pageText(page);
  while (Date.now() < end && !texts.every((t) => text.includes(t))) {
    await page.waitForTimeout(200);
    text = await pageText(page);
  }
  for (const t of texts) {
    expect(text).toContain(t);
  }
  return text;
}

type ColourPair = { color: string; bg: string };

/** The text colour of each matching element and the first opaque background behind it. */
async function colourPairs(loc: Locator): Promise<ColourPair[]> {
  return loc.evaluateAll((els) =>
    els.map((el) => {
      const color = getComputedStyle(el).color;
      let node: Element | null = el;
      let bg = 'rgba(0, 0, 0, 0)';
      while (node) {
        const b = getComputedStyle(node).backgroundColor;
        if (b && b !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(b)) {
          bg = b;
          break;
        }
        node = node.parentElement;
      }
      return { color, bg };
    }),
  );
}

/** Expects some element whose own text is exactly `text` to be in `color` on `bg`. */
async function expectTextColourOn(page: Page, text: string, color: string, bg: string): Promise<void> {
  const loc = page.getByText(text, { exact: true });
  await loc.first().waitFor({ state: 'visible', timeout: WAIT_MS });
  const end = Date.now() + WAIT_MS;
  let pairs = await colourPairs(loc);
  while (Date.now() < end && !pairs.some((p) => p.color === color && p.bg === bg)) {
    await page.waitForTimeout(200);
    pairs = await colourPairs(loc);
  }
  expect(pairs).toContainEqual({ color, bg });
}

test(
  "A Fjord pod's proposal",
  async () => {
    await using app = await openApp({
      route: '/pod/farpaabarselpod46aaa',
      world: 'member with a Fjord pod proposal',
      locale: 'en',
    });
    const page = app.page;

    await expectTextColourOn(page, 'far på barsel', FJORD_DEEP, FJORD_TINT);

    const text = await waitForTexts(page, ['5 people']);
    expect(text).toMatch(/ages 30–39/i);
    expect(text).not.toContain('Some of you also share');

    await app.saveScreen('a-fjord-pod-s-proposal.png');
  },
  TIMEOUT,
);

test(
  "A Solsikke pod's proposal",
  async () => {
    await using app = await openApp({
      route: '/pod/sourdoughpodwk46aaaa',
      world: 'member with a Solsikke pod proposal',
      locale: 'en',
    });
    const page = app.page;

    await expectTextColourOn(page, 'sourdough', SOLSIKKE_DEEP, SOLSIKKE_TINT);

    await app.saveScreen('a-solsikke-pod-s-proposal.png');
  },
  TIMEOUT,
);

test(
  'The brætspil proposal is Tomat',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46',
      world: 'member with a pod proposal',
      locale: 'en',
    });
    const page = app.page;

    await expectTextColourOn(page, 'brætspil', TOMAT_DEEP, TOMAT_TINT);

    await app.saveScreen('the-br-tspil-proposal-is-tomat.png');
  },
  TIMEOUT,
);

test(
  "An open pod's proposal takes its colour from the pod",
  async () => {
    await using app = await openApp({
      route: '/pod/openpodaarhusweek46a',
      world: 'member with an open pod proposal',
      locale: 'en',
    });
    const page = app.page;

    const noTheme = page.getByText('A pod without a shared theme', { exact: true }).first();
    const openToAnyone = page.getByText('Open to anyone', { exact: true }).first();
    await noTheme.waitFor({ state: 'visible', timeout: WAIT_MS });
    await openToAnyone.waitFor({ state: 'visible', timeout: WAIT_MS });

    const noThemeBox = await noTheme.boundingBox();
    const openBox = await openToAnyone.boundingBox();
    expect(noThemeBox).not.toBeNull();
    expect(openBox).not.toBeNull();
    if (noThemeBox && openBox) {
      expect(noThemeBox.y).toBeLessThan(openBox.y);
    }

    await expectTextColourOn(page, 'Open to anyone', BLOMME_DEEP, BLOMME_TINT);

    await app.saveScreen('an-open-pod-s-proposal-takes-its-colour-from-the-pod.png');
  },
  TIMEOUT,
);

test(
  "A private pod's proposal shows less",
  async () => {
    await using app = await openApp({
      route: '/pod/privatepodaarhusweek',
      world: 'member with a private pod proposal',
      locale: 'en',
    });
    const page = app.page;

    const text = await waitForTexts(page, [
      'Week 48',
      'Private interest',
      'Answer by Sat 18:00',
      'A pod around',
      'gravid',
      '5 people',
      'Near Aarhus C',
      'Everyone invited added this interest themselves and gave consent.',
      'Once the pod is confirmed, members see first names.',
    ]);
    await expectTextColourOn(page, 'gravid', INK, WHITE);

    // No ages, no distance, no seats, no New pod and no shared interests.
    expect(text).not.toMatch(/ages \d/i);
    expect(text).not.toContain('within about');
    expect(await page.getByText('You', { exact: true }).count()).toBe(0);
    expect(await page.getByText('New pod', { exact: true }).count()).toBe(0);
    expect(text).not.toContain('Some of you also share');

    // How private interests are protected is under the card, not Why this pod?
    const link = page.getByText('How private interests are protected', { exact: true }).first();
    await link.waitFor({ state: 'visible', timeout: WAIT_MS });
    expect(await page.getByText('Why this pod?').count()).toBe(0);
    const note = page.getByText(/Once the pod is confirmed, members see first names\./).first();
    const noteBox = await note.boundingBox();
    const linkBox = await link.boundingBox();
    expect(noteBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    if (noteBox && linkBox) {
      expect(linkBox.y).toBeGreaterThanOrEqual(noteBox.y + noteBox.height);
    }

    await link.click();
    await page.waitForURL(/\/info\/sensitive-interests/, { timeout: WAIT_MS });
    await page.getByText('Private interests', { exact: true }).first().waitFor({ state: 'visible', timeout: WAIT_MS });

    await app.saveScreen('a-private-pod-s-proposal-shows-less.png');
  },
  TIMEOUT,
);

test(
  "A private pod's proposal in Danish",
  async () => {
    await using app = await openApp({
      route: '/pod/privatepodaarhusweek',
      world: 'member with a private pod proposal',
      locale: 'da',
    });
    const page = app.page;

    await waitForTexts(page, [
      'Privat interesse',
      'Svar senest lør. kl. 18.00',
      'Sådan beskytter vi private interesser',
    ]);

    await app.saveScreen('a-private-pod-s-proposal-in-danish.png');
  },
  TIMEOUT,
);
