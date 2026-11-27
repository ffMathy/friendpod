// ail-derived-from: YourPodsRow@6783b7fb72a2f956
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The row on the Pods tab: a link named "<theme>. <state line>". */
async function rowNamed(page: Page, name: RegExp): Promise<Locator> {
  const row = page.getByRole('link', { name });
  await row.first().waitFor({ state: 'visible', timeout: 60_000 });
  expect(await row.count()).toBe(1);
  return row;
}

function exactName(theme: string, state: string): RegExp {
  return new RegExp(`^${escapeRegExp(theme)}\\. ${escapeRegExp(state)}$`);
}

async function tokensOf(row: Locator): Promise<string[]> {
  const text = await row.innerText();
  return text.split(/\s+/).filter((t) => t.length > 0);
}

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
}

const POD_COLOURS_RGB = [
  // solsikke
  'rgb(255, 216, 77)', 'rgb(106, 73, 0)', 'rgb(255, 241, 194)',
  // blad
  'rgb(159, 208, 94)', 'rgb(57, 85, 0)', 'rgb(230, 243, 212)',
  // baer
  'rgb(244, 138, 179)', 'rgb(144, 18, 77)', 'rgb(253, 226, 236)',
  // tomat
  'rgb(242, 106, 75)', 'rgb(140, 33, 7)', 'rgb(253, 226, 217)',
  // fjord
  'rgb(47, 111, 214)', 'rgb(18, 69, 147)', 'rgb(221, 231, 251)',
  // blomme
  'rgb(108, 51, 153)', 'rgb(79, 34, 114)', 'rgb(237, 225, 246)',
];

describe('YourPodsRow', () => {
  test(
    'A proposal not answered yet',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member with a pod proposal', locale: 'en' });
      const row = await rowNamed(app.page, exactName('brætspil', 'New pod · answer by Sat 18:00'));
      expect(await row.textContent()).toContain('New pod · answer by Sat 18:00');
      await app.saveScreen('a-proposal-not-answered-yet.png');
    },
    TIMEOUT,
  );

  test(
    'A pod waiting for the others',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member waiting for the others', locale: 'en' });
      const row = await rowNamed(app.page, exactName('brætspil', 'Waiting for the others · 3 of 5 said yes'));
      expect(await row.textContent()).toContain('Waiting for the others · 3 of 5 said yes');
      await app.saveScreen('a-pod-waiting-for-the-others.png');
    },
    TIMEOUT,
  );

  test(
    'A pod planning its meetup',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member planning a meetup', locale: 'en' });
      const row = await rowNamed(app.page, exactName('brætspil', 'Planning · vote by Tue 18:00'));
      expect(await row.textContent()).toContain('Planning · vote by Tue 18:00');
      const tokens = await tokensOf(row);
      expect(tokens).toContain('M');
      expect(tokens).toContain('J');
      expect(tokens).toContain('S');
      await app.saveScreen('a-pod-planning-its-meetup.png');
    },
    TIMEOUT,
  );

  test(
    'A scheduled meetup',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member the day before a meetup', locale: 'en' });
      const row = await rowNamed(app.page, /^brætspil\. Saturday 14:00 · .+, Aarhus C$/);
      expect(await row.textContent()).toMatch(/Saturday 14:00 · .+, Aarhus C/);
      await app.saveScreen('a-scheduled-meetup.png');
    },
    TIMEOUT,
  );

  test(
    'A pod that has met',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member the morning after a meetup', locale: 'en' });
      const row = await rowNamed(app.page, exactName('brætspil', 'Met'));
      // The section heading carries its count: "Active · 1".
      const active = app.page.getByRole('heading', { name: /^Active\b/ }).first();
      await active.waitFor({ state: 'visible' });
      const rowTop = await topOf(row);
      expect(rowTop).toBeGreaterThan(await topOf(active));
      const past = app.page.getByRole('heading', { name: /^Past\b/ });
      if ((await past.count()) > 0) {
        expect(rowTop).toBeLessThan(await topOf(past.first()));
      }
      await app.saveScreen('a-pod-that-has-met.png');
    },
    TIMEOUT,
  );

  test(
    'A past pod reads Archived',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member this week', locale: 'en' });
      const row = await rowNamed(app.page, exactName('bouldering', 'Archived'));
      const past = app.page.getByRole('heading', { name: /^Past\b/ }).first();
      await past.waitFor({ state: 'visible' });
      expect(await topOf(row)).toBeGreaterThan(await topOf(past));
      const text = (await row.textContent()) ?? '';
      expect(text).toContain('bouldering');
      expect(text).toContain('Archived');
      const tokens = await tokensOf(row);
      expect(tokens).toContain('S');
      expect(tokens).toContain('K');
      await app.saveScreen('a-past-pod-reads-archived.png');
    },
    TIMEOUT,
  );

  test(
    'A pod without a theme',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member with an open pod proposal', locale: 'en' });
      const row = await rowNamed(app.page, exactName('Open to anyone', 'New pod · answer by Sat 18:00'));
      const text = (await row.textContent()) ?? '';
      expect(text).toContain('Open to anyone');
      expect(text).toContain('New pod · answer by Sat 18:00');
      await app.saveScreen('a-pod-without-a-theme.png');
    },
    TIMEOUT,
  );

  test(
    'A private pod stays quiet',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member with a private pod proposal', locale: 'en' });
      const row = await rowNamed(app.page, /^gravid, Private interest\. .+$/);
      expect(await row.textContent()).toContain('gravid');
      const colours = await row.evaluate((root) => {
        const found: string[] = [];
        const all = [root, ...Array.from(root.querySelectorAll('*'))];
        for (const el of all) {
          const style = window.getComputedStyle(el);
          found.push(style.backgroundColor, style.color, style.borderTopColor);
          // Icons are drawn with their stroke (and the filled ones with their fill).
          for (const attr of ['fill', 'stroke']) {
            const value = el.getAttribute(attr);
            const hex = value === null ? null : /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
            if (hex !== null && hex[1] !== undefined && hex[2] !== undefined && hex[3] !== undefined) {
              found.push(`rgb(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)})`);
            } else if (value !== null) {
              found.push(value);
            }
          }
          found.push(style.fill);
        }
        return found;
      });
      for (const colour of POD_COLOURS_RGB) {
        expect(colours).not.toContain(colour);
      }
      // The lock and discs are in color.private.fill (#3A423D) instead of a pod colour.
      expect(colours.some((c) => c === 'rgb(58, 66, 61)' || c.toUpperCase() === '#3A423D')).toBe(true);
      await app.saveScreen('a-private-pod-stays-quiet.png');
    },
    TIMEOUT,
  );

  test(
    'Rows in Danish',
    async () => {
      await using app = await openApp({ route: '/pods', world: 'member waiting for the others', locale: 'da' });
      const row = await rowNamed(app.page, exactName('brætspil', 'Venter på de andre · 3 af 5 har sagt ja'));
      expect(await row.textContent()).toContain('Venter på de andre · 3 af 5 har sagt ja');
      await app.saveScreen('rows-in-danish.png');
    },
    TIMEOUT,
  );
});
