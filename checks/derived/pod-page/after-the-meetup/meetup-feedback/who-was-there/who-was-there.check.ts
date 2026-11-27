// ail-derived-from: WhoWasThere@2a6f97200d9a6095
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { isTicked, openApp } from '../../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/feedback';
const WORLD = 'member the morning after a meetup';
const OTHERS = ['Mette', 'Jonas', 'Sofie', 'Ahmed'] as const;
const TIMEOUT = 180_000;

const INK = 'rgb(24, 33, 29)';

function wasThere(page: Page, name: string): Locator {
  return page.getByRole('checkbox', { name: `${name} was there`, exact: true });
}

function yesFor(page: Page, name: string): Locator {
  return page.getByRole('radio', { name: `Yes, meet ${name} again`, exact: true });
}

function noFor(page: Page, name: string): Locator {
  return page.getByRole('radio', { name: `No, don't meet ${name} again`, exact: true });
}

/** The first non-transparent background colour on the element or inside it: how a chosen answer is drawn. */
async function drawnBackground(locator: Locator): Promise<string> {
  return locator.evaluate((root) => {
    const nodes: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const node of nodes) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
        return bg;
      }
    }
    return 'transparent';
  });
}

async function isChosen(locator: Locator): Promise<boolean> {
  return (await drawnBackground(locator)) === INK;
}

/** Waits until the answer is drawn as chosen (or not): the redraw follows the press. */
async function untilChosen(page: Page, locator: Locator, chosen: boolean): Promise<void> {
  const handle = await locator.elementHandle();
  await page.waitForFunction(
    ([root, ink, want]) => {
      if (!root) return false;
      const nodes: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
      const bg = nodes
        .map((node) => getComputedStyle(node).backgroundColor)
        .find((c) => c && c !== 'transparent' && c !== 'rgba(0, 0, 0, 0)');
      return (bg === ink) === want;
    },
    [handle, INK, chosen] as const,
  );
}

describe('WhoWasThere', () => {
  test(
    'Everyone starts ticked and no one has a meet-again answer',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      await page.getByText('Who was there?', { exact: true }).first().waitFor();
      await wasThere(page, 'Mette').waitFor();

      for (const name of OTHERS) {
        const box = wasThere(page, name);
        expect(await box.count()).toBe(1);
        expect(await isTicked(box)).toBe(true);

        const yes = yesFor(page, name);
        const no = noFor(page, name);
        expect(await yes.count()).toBe(1);
        expect(await no.count()).toBe(1);
        expect(await isChosen(yes)).toBe(false);
        expect(await isChosen(no)).toBe(false);
      }

      // The member themself (Emil) is not listed.
      expect(await wasThere(page, 'Emil').count()).toBe(0);
      expect(await page.getByRole('checkbox', { name: /^.+ was there$/ }).count()).toBe(OTHERS.length);

      const myself = page.getByRole('checkbox', { name: "I wasn't there myself", exact: true });
      expect(await myself.count()).toBe(1);
      expect(await isTicked(myself)).toBe(false);

      await app.saveScreen('everyone-starts-ticked-and-no-one-has-a-meet-again-answer.png');
    },
    TIMEOUT,
  );

  test(
    'Unticking someone takes away their meet-again question',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      const jonas = wasThere(page, 'Jonas');
      await jonas.waitFor();
      await yesFor(page, 'Jonas').waitFor();

      await jonas.click();
      await yesFor(page, 'Jonas').waitFor({ state: 'detached' });
      expect(await yesFor(page, 'Jonas').count()).toBe(0);
      expect(await noFor(page, 'Jonas').count()).toBe(0);
      for (const name of ['Mette', 'Sofie', 'Ahmed']) {
        expect(await yesFor(page, name).count()).toBe(1);
        expect(await noFor(page, name).count()).toBe(1);
      }

      await jonas.click();
      await yesFor(page, 'Jonas').waitFor();
      expect(await yesFor(page, 'Jonas').count()).toBe(1);
      expect(await noFor(page, 'Jonas').count()).toBe(1);

      await app.saveScreen('unticking-someone-takes-away-their-meet-again-question.png');
    },
    TIMEOUT,
  );

  test(
    'A meet-again answer can be taken back',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      const yes = yesFor(page, 'Mette');
      const no = noFor(page, 'Mette');
      await yes.waitFor();

      await yes.click();
      await untilChosen(page, yes, true);
      expect(await isChosen(yes)).toBe(true);
      expect(await isChosen(no)).toBe(false);

      await yes.click();
      await untilChosen(page, yes, false);
      expect(await isChosen(yes)).toBe(false);
      expect(await isChosen(no)).toBe(false);

      await app.saveScreen('a-meet-again-answer-can-be-taken-back.png');
    },
    TIMEOUT,
  );

  test(
    'The card in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
      const page = app.page;

      await page.getByText('Hvem var der?', { exact: true }).first().waitFor();
      expect(await page.getByText('Var der', { exact: true }).count()).toBeGreaterThan(0);
      expect(await page.getByText('Ses igen', { exact: true }).count()).toBeGreaterThan(0);

      for (const name of OTHERS) {
        const ja = page.getByRole('radio', { name: `Ja, jeg vil gerne ses med ${name} igen`, exact: true });
        const nej = page.getByRole('radio', { name: `Nej, jeg vil ikke ses med ${name} igen`, exact: true });
        expect(await ja.count()).toBe(1);
        expect(await nej.count()).toBe(1);
        expect((await ja.innerText()).trim()).toBe('Ja');
        expect((await nej.innerText()).trim()).toBe('Nej');
      }

      const mette = page.getByRole('checkbox', { name: 'Mette var der', exact: true });
      expect(await mette.count()).toBe(1);
      expect(await isTicked(mette)).toBe(true);

      await app.saveScreen('the-card-in-danish.png');
    },
    TIMEOUT,
  );
});
