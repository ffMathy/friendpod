// ail-derived-from: PodRevealField@5c00a05c54b66528
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;

interface Paint {
  color: string;
  background: string;
}

const TIMEOUT = 20_000;

/** Turns a design token's hex into the rgb() form a browser's computed style reports. */
function rgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgb(${r},${g},${b})`;
}

function normalizeColor(value: string): string {
  return value.replace(/\s+/g, '').replace(/^rgba\((\d+),(\d+),(\d+),1\)$/, 'rgb($1,$2,$3)');
}

const WHITE = rgb('#FFFFFF');
const INK = rgb('#18211D');

/**
 * Finds the first (top-most) element on the page whose whole text is `wanted` (lines may be split into
 * separate elements, so whitespace is ignored), and reads its text colour and the background it sits on.
 */
async function paintOfText(app: App, wanted: string): Promise<Paint> {
  const handle = await app.page.waitForFunction(
    (target: string) => {
      const squeeze = (s: string | null): string => (s ?? '').replace(/\s+/g, '');
      const want = squeeze(target);
      const matches = (el: Element): boolean => squeeze(el.textContent) === want;
      const deepest = (el: Element): Element => {
        let current = el;
        for (;;) {
          const child = Array.from(current.children).find(matches);
          if (!child) return current;
          current = child;
        }
      };
      const backgroundOf = (start: Element | null): string | null => {
        let el: Element | null = start;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'transparent' && !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(bg)) return bg;
          el = el.parentElement;
        }
        return null;
      };
      const first = Array.from(document.body.querySelectorAll('*')).find(matches);
      if (!first) return null;
      const el = deepest(first);
      const background = backgroundOf(el);
      if (!background) return null;
      return { color: getComputedStyle(el).color, background };
    },
    wanted,
    { timeout: TIMEOUT },
  );
  return (await handle.jsonValue()) as Paint;
}

/**
 * Finds the member labelled with `firstName` and reads the background colour under their initial.
 */
async function backgroundOfInitial(app: App, firstName: string): Promise<string> {
  const handle = await app.page.waitForFunction(
    (name: string) => {
      const squeeze = (s: string | null): string => (s ?? '').replace(/\s+/g, '');
      const initial = name.charAt(0);
      const isDeepestWithText = (el: Element, text: string): boolean =>
        squeeze(el.textContent) === text && !Array.from(el.children).some((c) => squeeze(c.textContent) === text);
      const backgroundOf = (start: Element | null): string | null => {
        let el: Element | null = start;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'transparent' && !/^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(bg)) return bg;
          el = el.parentElement;
        }
        return null;
      };
      const all = Array.from(document.body.querySelectorAll('*'));
      const labels = all.filter((el) => isDeepestWithText(el, name));
      for (const label of labels) {
        let ancestor: Element | null = label.parentElement;
        for (let level = 0; ancestor && level < 8; level += 1) {
          const disc = Array.from(ancestor.querySelectorAll('*')).find((el) => isDeepestWithText(el, initial));
          if (disc) return backgroundOf(disc);
          ancestor = ancestor.parentElement;
        }
      }
      return null;
    },
    firstName,
    { timeout: TIMEOUT },
  );
  return (await handle.jsonValue()) as string;
}

test("A Fjord pod's reveal", async () => {
  await using app = await openApp({ route: '/pod/farpaabarselpod46aaa', world: 'member of a confirmed Fjord pod', locale: 'en' });

  const name = await paintOfText(app, 'far på barsel');
  expect(normalizeColor(name.color)).toBe(WHITE);
  expect(normalizeColor(name.background)).toBe(rgb('#2F6FD6'));

  const initial = await backgroundOfInitial(app, 'Anders');
  expect(normalizeColor(initial)).toBe(rgb('#124593'));

  await app.saveScreen('a-fjord-pod-s-reveal.png');
});

test("A Solsikke pod's reveal", async () => {
  await using app = await openApp({ route: '/pod/sourdoughpodwk46aaaa', world: 'member of a confirmed Solsikke pod', locale: 'en' });

  const name = await paintOfText(app, 'sourdough');
  expect(normalizeColor(name.color)).toBe(INK);
  expect(normalizeColor(name.background)).toBe(rgb('#FFD84D'));

  const initial = await backgroundOfInitial(app, 'Laura');
  expect(normalizeColor(initial)).toBe(rgb('#6A4900'));

  await app.saveScreen('a-solsikke-pod-s-reveal.png');
});

test("A Blad pod's reveal", async () => {
  await using app = await openApp({ route: '/pod/trailrunpodwk46aaaaa', world: 'member of a confirmed Blad pod', locale: 'en' });

  const name = await paintOfText(app, 'trail running');
  expect(normalizeColor(name.color)).toBe(INK);
  expect(normalizeColor(name.background)).toBe(rgb('#9FD05E'));

  const initial = await backgroundOfInitial(app, 'Ida');
  expect(normalizeColor(initial)).toBe(rgb('#395500'));

  await app.saveScreen('a-blad-pod-s-reveal.png');
});

test("An open pod's reveal", async () => {
  await using app = await openApp({ route: '/pod/openpodaarhusweek46a', world: 'member of a confirmed open pod', locale: 'en' });

  const name = await paintOfText(app, 'Open to anyone');
  expect(normalizeColor(name.color)).toBe(WHITE);
  expect(normalizeColor(name.background)).toBe(rgb('#6C3399'));

  const initial = await backgroundOfInitial(app, 'Camilla');
  expect(normalizeColor(initial)).toBe(rgb('#4F2272'));

  await app.saveScreen('an-open-pod-s-reveal.png');
});

test('The brætspil reveal is Tomat', async () => {
  await using app = await openApp({ route: '/pod/braetspilpodaarhus46', world: 'member of a confirmed pod', locale: 'en' });

  const name = await paintOfText(app, 'brætspil');
  expect(normalizeColor(name.color)).toBe(INK);
  expect(normalizeColor(name.background)).toBe(rgb('#F26A4B'));

  const initial = await backgroundOfInitial(app, 'Mette');
  expect(normalizeColor(initial)).toBe(rgb('#8C2107'));

  await app.saveScreen('the-br-tspil-reveal-is-tomat.png');
});
