// ail-derived-from: PlanOption@57aab761f5117470
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { isTicked, openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/plan';
const WORLD = 'member planning a meetup';
const TIMEOUT = 240_000;

const SATURDAY = 'Saturday 21 Nov, 14:00';
const SUNDAY = 'Sunday 22 Nov, 11:00';

/** Polls an async condition until it holds or the time runs out. */
async function eventually(check: () => Promise<boolean>, what: string, ms = 10_000): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    if (await check()) {
      return;
    }
    if (Date.now() > until) {
      throw new Error(`Timed out waiting for: ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function timeHeading(page: Page, when: string): Locator {
  return page.getByRole('heading', { name: when, exact: true });
}

function yesButton(page: Page, when: string): Locator {
  return page.getByRole('button', { name: `Yes to ${when}`, exact: true });
}

function noButton(page: Page, when: string): Locator {
  return page.getByRole('button', { name: `No to ${when}`, exact: true });
}

/** The innermost element holding both the option's time and its Yes button: the option card. */
function optionCard(page: Page, when: string): Locator {
  return page
    .locator('div')
    .filter({ has: timeHeading(page, when) })
    .filter({ has: yesButton(page, when) })
    .last();
}

async function cardText(card: Locator): Promise<string> {
  return ((await card.textContent()) ?? '').replace(/\s+/g, ' ');
}

function hasYesCount(text: string, count: number): boolean {
  return new RegExp(`(^|\\D)${count} yes`).test(text);
}

describe('PlanOption', () => {
  test(
    'An option shows its time, its place and who said yes',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      await timeHeading(page, SATURDAY).waitFor({ state: 'visible' });
      const card = optionCard(page, SATURDAY);
      await card.waitFor({ state: 'visible' });

      const text = await cardText(card);
      expect(text).toContain(SATURDAY);
      expect(text).toMatch(/\[?Board game café\]?, Aarhus C/);
      expect(text).toContain('Open map');

      const mapLink = card.getByRole('link', { name: /^Open .*Board game café.* in Maps$/ });
      expect(await mapLink.count()).toBe(1);
      expect(await mapLink.first().isVisible()).toBe(true);

      expect(await card.getByText('M', { exact: true }).first().isVisible()).toBe(true);
      expect(await card.getByText('J', { exact: true }).first().isVisible()).toBe(true);
      expect(await card.getByText('You', { exact: true }).first().isVisible()).toBe(true);
      expect(hasYesCount(text, 3)).toBe(true);

      expect(await isTicked(yesButton(page, SATURDAY))).toBe(true);
      expect(await isTicked(noButton(page, SATURDAY))).toBe(false);

      await app.saveScreen('an-option-shows-its-time-its-place-and-who-said-yes.png');
    },
    TIMEOUT,
  );

  test(
    'A second press takes the vote back',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      const yes = yesButton(page, SATURDAY);
      const no = noButton(page, SATURDAY);
      await yes.waitFor({ state: 'visible' });
      await eventually(() => isTicked(yes), 'the member’s yes on Saturday to show');

      await yes.click();

      const card = optionCard(page, SATURDAY);
      await eventually(async () => !(await isTicked(yes)), 'Yes to be unticked');
      await eventually(async () => hasYesCount(await cardText(card), 2), 'the option to have 2 yes');
      expect(await isTicked(yes)).toBe(false);
      expect(await isTicked(no)).toBe(false);
      expect(hasYesCount(await cardText(card), 2)).toBe(true);

      await app.saveScreen('a-second-press-takes-the-vote-back.png');
    },
    TIMEOUT,
  );

  test(
    'No replaces Yes',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      const yes = yesButton(page, SUNDAY);
      const no = noButton(page, SUNDAY);
      await no.waitFor({ state: 'visible' });

      await no.click();
      await eventually(() => isTicked(no), 'No to be ticked');
      await yes.click();

      const card = optionCard(page, SUNDAY);
      await eventually(() => isTicked(yes), 'Yes to be ticked');
      await eventually(async () => hasYesCount(await cardText(card), 3), 'the option to have 3 yes');
      expect(await isTicked(yes)).toBe(true);
      expect(await isTicked(no)).toBe(false);
      expect(hasYesCount(await cardText(card), 3)).toBe(true);

      await app.saveScreen('no-replaces-yes.png');
    },
    TIMEOUT,
  );

  test(
    "Pressing and holding another member's option reports it",
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
      const page = app.page;

      const heading = timeHeading(page, SUNDAY);
      await heading.waitFor({ state: 'visible' });
      await heading.scrollIntoViewIfNeeded();
      const box = await heading.boundingBox();
      if (box === null) {
        throw new Error('The Sunday option has no box on screen');
      }

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(800);
      await page.mouse.up();

      const sheet = page.getByText('Report a suggestion').first();
      await sheet.waitFor({ state: 'visible', timeout: 10_000 });
      expect(await sheet.isVisible()).toBe(true);

      await app.saveScreen('pressing-and-holding-another-member-s-option-reports-it.png');
    },
    TIMEOUT,
  );
});
