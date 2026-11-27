// ail-derived-from: PodScheduled@78bcb427260e4f4a
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const POD_ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 120_000;

/** Visible text of the page, with whitespace collapsed. */
async function visibleText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/\s+/g, ' ');
}

/** Waits until the visible page text contains `text`, failing with the page text otherwise. */
async function expectText(page: Page, text: string, timeout = 15_000): Promise<void> {
  const wanted = text.replace(/\s+/g, ' ');
  const end = Date.now() + timeout;
  let seen = '';
  while (Date.now() < end) {
    seen = await visibleText(page);
    if (seen.includes(wanted)) {
      return;
    }
    await page.waitForTimeout(100);
  }
  expect(seen).toContain(wanted);
}

/** Asserts that no visible element shows exactly `text`. */
async function expectNoExactText(page: Page, text: string): Promise<void> {
  const matches = page.getByText(text, { exact: true });
  const count = await matches.count();
  let visible = 0;
  for (let i = 0; i < count; i += 1) {
    if (await matches.nth(i).isVisible()) {
      visible += 1;
    }
  }
  expect(visible).toBe(0);
}

test(
  'The day before the meetup',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    await expectText(page, 'brætspil');
    await expectText(page, '5 people near Aarhus C');

    await expectText(page, 'Still coming tomorrow at 14:00?');
    await page.getByRole('button', { name: "Yes, I'm coming" }).first().waitFor({ state: 'visible' });
    await page.getByRole('button', { name: "Can't make it" }).first().waitFor({ state: 'visible' });

    await expectText(page, 'Saturday 21 Nov, 14:00');
    await expectText(page, '[Board game café] · Aarhus C');

    await page
      .getByRole('link', { name: 'Chat, Open until Sunday 14:00, 3 new', exact: true })
      .waitFor({ state: 'visible' });
    await expectText(page, 'Open until Sunday 14:00');
    await expectText(page, '3 new');

    // The section header is drawn in capitals (CSS), so it is found by its text, not the page's innerText.
    await page.getByText('Members', { exact: true }).first().waitFor({ state: 'visible' });
    for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) {
      await page.getByRole('link', { name: new RegExp(`^${name}\\b`) }).first().waitFor({ state: 'visible' });
    }

    await expectNoExactText(page, 'Confirmed');
    expect(await visibleText(page)).not.toContain('More than one of you also likes');

    await app.saveScreen('the-day-before-the-meetup.png');
  },
  TIMEOUT,
);

test(
  'Just before the meetup the next step is the chat',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member just before a meetup', locale: 'en' });
    const page = app.page;

    await expectText(page, 'The meetup chat is open');
    const openChat = page.getByRole('button', { name: 'Open chat' }).first();
    await openChat.waitFor({ state: 'visible' });
    await openChat.click();

    await page.getByRole('textbox', { name: 'Message' }).first().waitFor({ state: 'visible' });

    await app.saveScreen('just-before-the-meetup-the-next-step-is-the-chat.png');
  },
  TIMEOUT,
);

test(
  'The morning after the meetup',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
    const page = app.page;

    await expectText(page, 'How did it go?');
    const giveFeedback = page.getByRole('button', { name: 'Give feedback' }).first();
    await giveFeedback.waitFor({ state: 'visible' });

    await page
      .getByRole('link', { name: 'Chat, Open until Sunday 14:00, 2 new', exact: true })
      .waitFor({ state: 'visible' });
    await expectText(page, 'Open until Sunday 14:00');
    await expectText(page, '2 new');

    await giveFeedback.click();
    await expectText(page, 'Who was there?');

    await app.saveScreen('the-morning-after-the-meetup.png');
  },
  TIMEOUT,
);

test(
  'The Chat row opens the chat',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
    const page = app.page;

    const chatRow = page.getByRole('link', { name: /^Chat, / }).first();
    await chatRow.waitFor({ state: 'visible' });
    await chatRow.click();

    await page.getByRole('textbox', { name: 'Message' }).first().waitFor({ state: 'visible' });

    await app.saveScreen('the-chat-row-opens-the-chat.png');
  },
  TIMEOUT,
);

test(
  'The pod band in Danish',
  async () => {
    await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'da' });
    const page = app.page;

    await expectText(page, '5 personer i nærheden af Aarhus C');
    await expectText(page, 'Næste skridt');
    await expectText(page, 'Kommer du stadig i morgen kl. 14.00?');
    // The section header is drawn in capitals (CSS), so it is found by its text, not the page's innerText.
    await page.getByText('Medlemmer', { exact: true }).first().waitFor({ state: 'visible' });

    await page.getByRole('link', { name: /^Chat, / }).first().waitFor({ state: 'visible' });
    await expectText(page, 'Åben til søndag kl. 14.00');
    await expectText(page, '3 nye');

    await app.saveScreen('the-pod-band-in-danish.png');
  },
  TIMEOUT,
);
