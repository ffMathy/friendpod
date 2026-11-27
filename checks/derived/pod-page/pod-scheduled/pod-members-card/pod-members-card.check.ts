// ail-derived-from: PodMembersCard@cbc431539f892ab2
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const POD_ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 120_000;

/** A member row: a link named "<first name>, <status>, <sentence>", or "<first name> hasn't confirmed". */
const ROW_EN = /^(Mette|Jonas|Sofie|Ahmed)(,| hasn't confirmed|$)/;
const ROW_DA = /^(Mette|Jonas|Sofie|Ahmed)(,| har ikke bekræftet|$)/;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForCount(locator: Locator, count: number, timeoutMs = 15_000): Promise<number> {
  const start = Date.now();
  let current = await locator.count();
  while (current !== count && Date.now() - start < timeoutMs) {
    await sleep(200);
    current = await locator.count();
  }
  return current;
}

/** The members card: the innermost element holding both the section title and the member rows. */
async function membersRows(page: Page, title: string, rowName: RegExp): Promise<Locator> {
  const anyRow = page.getByRole('link', { name: rowName });
  await anyRow.first().waitFor({ state: 'visible', timeout: 30_000 });
  const card = page
    .locator('div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: anyRow })
    .last();
  await card.waitFor({ state: 'visible', timeout: 15_000 });
  return card.getByRole('link', { name: rowName });
}

async function rowTexts(rows: Locator): Promise<string[]> {
  const texts: string[] = [];
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    texts.push((await rows.nth(i).textContent()) ?? '');
  }
  return texts;
}

function firstNameOf(text: string): string | undefined {
  const match = /(Mette|Jonas|Sofie|Ahmed)/.exec(text);
  return match?.[1];
}

test(
  'Who is coming, the day before',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    const rows = await membersRows(page, 'Members', ROW_EN);
    expect(await waitForCount(rows, 4)).toBe(4);

    const texts = await rowTexts(rows);
    expect(texts.map(firstNameOf)).toEqual(['Mette', 'Jonas', 'Sofie', 'Ahmed']);

    const [mette, jonas, sofie, ahmed] = texts;
    for (const coming of [mette, jonas, ahmed]) {
      expect(coming).toBeDefined();
      expect(coming ?? '').toContain('Coming');
      expect(coming ?? '').not.toContain("Hasn't confirmed");
    }
    expect(sofie).toBeDefined();
    expect(sofie ?? '').toContain("Hasn't confirmed");
    expect(sofie ?? '').not.toContain('Coming');

    const sofieRow = page.getByRole('link', { name: "Sofie hasn't confirmed", exact: true });
    await sofieRow.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await sofieRow.isVisible()).toBe(true);

    await app.saveScreen('who-is-coming-the-day-before.png');
  },
  TIMEOUT,
);

test(
  "A member's row opens their sheet",
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    const rows = await membersRows(page, 'Members', ROW_EN);
    const metteRow = rows.filter({ hasText: 'Mette' }).first();
    await metteRow.click();

    await page.waitForURL(/\/pod\/braetspilpodaarhus46\/member\/[^/?#]+/, { timeout: 15_000 });
    const report = page.getByText('Report Mette', { exact: true });
    await report.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await report.isVisible()).toBe(true);

    await app.saveScreen('a-member-s-row-opens-their-sheet.png');
  },
  TIMEOUT,
);

test(
  'After the meetup, no statuses',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
    const page = app.page;

    const rows = await membersRows(page, 'Members', ROW_EN);
    expect(await waitForCount(rows, 4)).toBe(4);

    const texts = await rowTexts(rows);
    expect(texts.map(firstNameOf)).toEqual(['Mette', 'Jonas', 'Sofie', 'Ahmed']);
    for (const text of texts) {
      expect(text).not.toContain('Coming');
      expect(text).not.toContain("Hasn't confirmed");
    }

    await app.saveScreen('after-the-meetup-no-statuses.png');
  },
  TIMEOUT,
);

test(
  'Members in Danish',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'da' });
    const page = app.page;

    const rows = await membersRows(page, 'Medlemmer', ROW_DA);
    expect(await waitForCount(rows, 4)).toBe(4);

    const texts = await rowTexts(rows);
    expect(texts.filter((t) => t.includes('Kommer')).length).toBe(3);
    expect(texts.filter((t) => t.includes('Har ikke bekræftet')).length).toBe(1);

    await app.saveScreen('members-in-danish.png');
  },
  TIMEOUT,
);
