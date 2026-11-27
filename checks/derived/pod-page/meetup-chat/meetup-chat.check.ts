// ail-derived-from: MeetupChat@2b810564f2949305
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;
const POD_ID = 'braetspilpodaarhus46';
const CHAT_ROUTE = `/pod/${POD_ID}/chat`;
const POD_ROUTE = `/pod/${POD_ID}`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function pageText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/\s+/g, ' ').trim();
}

/** Waits until the page's visible text contains `expected` (whitespace collapsed). */
async function expectPageText(page: Page, expected: string, timeout = 15_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let last = '';
  while (Date.now() < deadline) {
    last = await pageText(page);
    if (last.includes(expected)) {
      return;
    }
    await page.waitForTimeout(200);
  }
  expect(last).toContain(expected);
}

/** Waits until the page's visible text no longer contains `unexpected`. */
async function expectNoPageText(page: Page, unexpected: string, timeout = 15_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let last = '';
  while (Date.now() < deadline) {
    last = await pageText(page);
    if (!last.includes(unexpected)) {
      return;
    }
    await page.waitForTimeout(200);
  }
  expect(last).not.toContain(unexpected);
}

/** A chat message, found by its accessible name "<writer>, <time>: <text>". */
function message(page: Page, writer: string, text: string): Locator {
  return page.getByLabel(new RegExp(`^${escapeRegExp(writer)}, .+: ${escapeRegExp(text)}$`));
}

async function pressAndHold(page: Page, target: Locator): Promise<void> {
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded();
  await target.hover();
  await page.mouse.down();
  await page.waitForTimeout(1_200);
  await page.mouse.up();
}

test(
  'The chat just before the meetup',
  async () => {
    await using app = await openApp({ route: CHAT_ROUTE, world: 'member just before a meetup', locale: 'en' });
    const page = app.page;

    await expectPageText(page, 'brætspil');
    await expectPageText(page, 'Chat open until Sunday 14:00');
    await page.getByRole('button', { name: 'Back to pod' }).waitFor({ state: 'visible' });

    await expectPageText(
      page,
      'Only your pod can read this. Messages are deleted about 3 days after the meetup. ' +
        'Press and hold a message to report it.',
    );

    const field = page.getByPlaceholder('Write to your pod');
    await field.waitFor({ state: 'visible' });
    expect(await page.getByRole('button', { name: 'Send' }).isDisabled()).toBe(true);

    await app.saveScreen('the-chat-just-before-the-meetup.png');
  },
  TIMEOUT,
);

test(
  'Opening the chat clears its new messages',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    await expectPageText(page, '3 new');
    await page.getByText('Chat', { exact: true }).first().click();

    await message(
      page,
      'Jonas',
      "Count me in! I'll be there a few minutes early to grab a table.",
    ).waitFor({ state: 'visible', timeout: 15_000 });

    await page.getByRole('button', { name: 'Back to pod' }).click();

    await page.waitForURL((url) => url.pathname === POD_ROUTE, { timeout: 15_000 });
    await page.getByText('Chat', { exact: true }).first().waitFor({ state: 'visible' });
    await expectNoPageText(page, '3 new');

    await app.saveScreen('opening-the-chat-clears-its-new-messages.png');
  },
  TIMEOUT,
);

test(
  'Back from a chat opened on its own goes to the Pods tab',
  async () => {
    await using app = await openApp({ route: CHAT_ROUTE, world: 'member just before a meetup', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'Back to pod' }).click();

    await page.waitForURL((url) => !url.pathname.endsWith('/chat'), { timeout: 15_000 });
    await page.getByRole('tab', { name: /^Pods/, selected: true }).waitFor({ state: 'visible', timeout: 15_000 });

    await app.saveScreen('back-from-a-chat-opened-on-its-own-goes-to-the-pods-tab.png');
  },
  TIMEOUT,
);

test(
  'Press and hold a message to report it',
  async () => {
    await using app = await openApp({ route: CHAT_ROUTE, world: 'member just before a meetup', locale: 'en' });
    const page = app.page;

    await pressAndHold(page, message(page, 'Jonas', 'Running 10 min late, sorry! Save me a seat.'));

    await page.getByText('Report a message', { exact: true }).first().waitFor({ state: 'visible', timeout: 15_000 });

    await app.saveScreen('press-and-hold-a-message-to-report-it.png');
  },
  TIMEOUT,
);

test(
  'Your own message cannot be reported',
  async () => {
    await using app = await openApp({ route: CHAT_ROUTE, world: 'member just before a meetup', locale: 'en' });
    const page = app.page;

    const own = message(page, 'You', 'Me too, it will be fine. See you at 14!');
    await pressAndHold(page, own);
    await page.waitForTimeout(1_500);

    expect(new URL(page.url()).pathname).toBe(CHAT_ROUTE);
    expect(await own.isVisible()).toBe(true);
    expect(await page.getByText('Report a message', { exact: true }).count()).toBe(0);

    await app.saveScreen('your-own-message-cannot-be-reported.png');
  },
  TIMEOUT,
);

test(
  'Only members see the chat',
  async () => {
    await using app = await openApp({ route: CHAT_ROUTE, world: 'member with a pod proposal', locale: 'en' });
    const page = app.page;

    await expectPageText(page, 'Only current members of this pod can see its chat.');

    await app.saveScreen('only-members-see-the-chat.png');
  },
  TIMEOUT,
);

test(
  'The chat of a pod that is gone',
  async () => {
    await using app = await openApp({
      route: '/pod/neverapodofmine/chat',
      world: 'member just before a meetup',
      locale: 'en',
    });
    const page = app.page;

    await expectPageText(page, 'This pod no longer exists.');

    await app.saveScreen('the-chat-of-a-pod-that-is-gone.png');
  },
  TIMEOUT,
);

test(
  'The chat in Danish',
  async () => {
    await using app = await openApp({ route: CHAT_ROUTE, world: 'member just before a meetup', locale: 'da' });
    const page = app.page;

    await expectPageText(page, 'Åben til søndag kl. 14.00');
    await page.getByRole('button', { name: 'Tilbage til poden' }).waitFor({ state: 'visible' });
    await page.getByPlaceholder('Skriv til jeres pod').waitFor({ state: 'visible' });

    await app.saveScreen('the-chat-in-danish.png');
  },
  TIMEOUT,
);
