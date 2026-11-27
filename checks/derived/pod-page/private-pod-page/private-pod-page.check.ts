// ail-derived-from: PrivatePodPage@099ba2114749f7eb
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';
import { openApp } from '../../../harness/preview';

const ROUTE = '/pod/privatepodaarhusweek';
const TIMEOUT = 120_000;
const INK = 'rgb(24, 33, 29)';
const WHITE = 'rgb(255, 255, 255)';
const INK_2 = 'rgb(58, 66, 61)';

/** The page's visible text with runs of white space collapsed to one space. */
async function pageText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/\s+/g, ' ');
}

/** Whether the first element showing `text` sits inside a white box with an Ink border. */
async function inkOnWhite(page: Page, text: string): Promise<boolean> {
  return page.evaluate(
    ({ text, ink, white }) => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
      const leaf = all.find((el) => {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .trim();
        return own === text || (el.children.length === 0 && (el.textContent ?? '').trim() === text);
      });
      let node: HTMLElement | null = leaf ?? null;
      while (node) {
        const s = getComputedStyle(node);
        const bordered =
          s.borderTopColor === ink && s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0;
        if (bordered && s.backgroundColor === white) {
          return true;
        }
        node = node.parentElement;
      }
      return false;
    },
    { text, ink: INK, white: WHITE },
  );
}

/** The avatar of a member in the members list: whether it shows a photo, and whether it sits on Ink 2. */
async function memberAvatar(
  page: Page,
  name: string,
  others: string[],
): Promise<{ found: boolean; hasPhoto: boolean; onInk2: boolean }> {
  return page.evaluate(
    ({ name, others, ink2 }) => {
      const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
      const leaf = all.find((el) => {
        const own = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .trim();
        return own === name;
      });
      if (!leaf) {
        return { found: false, hasPhoto: false, onInk2: false };
      }
      let tile: HTMLElement = leaf;
      while (tile.parentElement) {
        const parentText = tile.parentElement.textContent ?? '';
        if (others.some((o) => parentText.includes(o))) {
          break;
        }
        tile = tile.parentElement;
      }
      const nodes = [tile, ...Array.from(tile.querySelectorAll<HTMLElement>('*'))];
      const hasPhoto =
        tile.querySelector('img') !== null ||
        nodes.some((el) => getComputedStyle(el).backgroundImage.startsWith('url('));
      const onInk2 = nodes.some((el) => getComputedStyle(el).backgroundColor === ink2);
      return { found: true, hasPhoto, onInk2 };
    },
    { name, others, ink2: INK_2 },
  );
}

test(
  'The private reveal hides photos until shown',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member of a confirmed private pod', locale: 'en' });
    const page = app.page;
    await page.getByText('Confirmed', { exact: true }).first().waitFor();

    const text = await pageText(page);
    expect(text).toContain('Confirmed');
    expect(text).toContain('gravid');
    expect(await page.getByLabel('Private interest').count()).toBeGreaterThan(0);
    expect(await inkOnWhite(page, 'Confirmed')).toBe(true);

    const names = ['Line', 'Mads', 'Sara', 'Nikolaj'];
    const line = await memberAvatar(page, 'Line', names.filter((n) => n !== 'Line'));
    expect(line.found).toBe(true);
    expect(line.hasPhoto).toBe(true);
    for (const name of ['Mads', 'Sara', 'Nikolaj']) {
      const avatar = await memberAvatar(page, name, names.filter((n) => n !== name));
      expect(avatar.found).toBe(true);
      expect(avatar.hasPhoto).toBe(false);
      expect(avatar.onInk2).toBe(true);
    }

    expect(await page.getByText('Show my photo to this pod', { exact: true }).first().isVisible()).toBe(true);
    expect(text).toContain(
      'In a pod about a private interest, photos stay hidden until each person chooses to show theirs. ' +
        'Yours shows once you turn this on.',
    );

    const sentence = 'Moved to Aarhus in the summer, always up for a walk by the water';
    expect(text).toContain('In their own words');
    expect(text).toContain(sentence);
    const ownWords = page
      .locator('div')
      .filter({ hasText: 'In their own words' })
      .filter({ hasText: sentence })
      .last();
    expect((await ownWords.innerText()).includes('Line')).toBe(true);

    expect(await page.getByText('Plan the meetup', { exact: true }).first().isVisible()).toBe(true);
    expect(text).toContain('Pick a time by Tuesday 18:00');

    await app.saveScreen('the-private-reveal-hides-photos-until-shown.png');
  },
  TIMEOUT,
);

test(
  'The private pod the day before its meetup',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member the day before a private meetup', locale: 'en' });
    const page = app.page;
    await page.getByText('5 people near Aarhus C').first().waitFor();

    const text = await pageText(page);
    expect(text).toContain('gravid');
    expect(text).toContain('5 people near Aarhus C');
    expect(await inkOnWhite(page, '5 people near Aarhus C')).toBe(true);
    // The band's private badge (the lock named Private interest is the reveal's).
    expect(await page.getByRole('img', { name: 'Private', exact: true }).count()).toBeGreaterThan(0);

    expect(text).toContain('The meetup chat is open');
    expect(await page.getByText('Open chat', { exact: true }).first().isVisible()).toBe(true);

    expect(text).toContain('Saturday 5 Dec, 14:00');
    expect(text).toContain("You're coming.");

    // The section header is drawn in capitals (CSS), so the page's innerText reads it as MEMBERS.
    expect(text.toLowerCase()).toContain('members');
    expect(text).toMatch(/Nikolaj\W{0,3}[^]{0,30}hasn['’]t confirmed/i);

    const membersAt = text.toLowerCase().indexOf('members');
    const notConfirmedAt = text.search(/hasn['’]t confirmed/i);
    const switchAt = text.lastIndexOf('Show my photo to this pod');
    expect(switchAt).toBeGreaterThan(membersAt);
    expect(switchAt).toBeGreaterThan(notConfirmedAt);

    await app.saveScreen('the-private-pod-the-day-before-its-meetup.png');
  },
  TIMEOUT,
);

test(
  'The private reveal in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member of a confirmed private pod', locale: 'da' });
    const page = app.page;
    await page.getByText('Bekræftet', { exact: true }).first().waitFor();

    const text = await pageText(page);
    expect(text).toContain('Bekræftet');
    expect(text).toContain('gravid');
    expect(await page.getByText('Vis mit billede i denne pod', { exact: true }).first().isVisible()).toBe(true);

    await app.saveScreen('the-private-reveal-in-danish.png');
  },
  TIMEOUT,
);
