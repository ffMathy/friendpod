// ail-derived-from: MeetupChatComposer@c2d021146aac2123
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/chat';
const WORLD = 'member just before a meetup';
const TIMEOUT = 180_000;
const WAIT = 10_000;

/** Polls `check` until it holds or the time runs out; returns whether it held. */
async function eventually(check: () => Promise<boolean>, timeout = WAIT): Promise<boolean> {
  const end = Date.now() + timeout;
  for (;;) {
    if (await check()) {
      return true;
    }
    if (Date.now() > end) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function messageField(page: Page, name = 'Message'): Locator {
  return page.getByRole('textbox', { name });
}

function sendButton(page: Page, name = 'Send'): Locator {
  return page.getByRole('button', { name, exact: true });
}

/** A counter such as 400/500, as its visible text. */
function anyCounter(page: Page): Locator {
  return page.getByText(/^\s*\d+\s*\/\s*500\s*$/);
}

test('A message is sent and the field empties', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;
  const field = messageField(page);
  await field.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('On my way!');
  await sendButton(page).click();

  const message = page.getByText('On my way!', { exact: true });
  await message.last().waitFor({ state: 'visible', timeout: WAIT });
  expect(await message.count()).toBe(1);

  // The message's own bubble (the deepest element holding both the text and its time) reads You · 13:58.
  const bubble = page.locator('div').filter({ has: message }).filter({ hasText: '13:58' }).last();
  const bubbleText = (await bubble.textContent()) ?? '';
  expect(bubbleText).toContain('You');
  expect(bubbleText).toContain('13:58');
  expect(bubbleText).toContain('On my way!');

  // It is the last message: after it, at most its own time follows, no other message's.
  const body = await page.locator('body').innerText();
  const after = body.slice(body.lastIndexOf('On my way!') + 'On my way!'.length);
  const timesAfter = after.match(/\b\d{1,2}[:.]\d{2}\b/g) ?? [];
  expect(timesAfter.length).toBeLessThanOrEqual(1);
  for (const time of timesAfter) {
    expect(time.replace('.', ':')).toBe('13:58');
  }

  expect(await eventually(async () => (await field.inputValue()) === '')).toBe(true);

  await app.saveScreen('a-message-is-sent-and-the-field-empties.png');
}, TIMEOUT);

test('Only spaces cannot be sent', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;
  const field = messageField(page);
  await field.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('   ');
  expect(await field.inputValue()).toBe('   ');

  expect(await eventually(async () => sendButton(page).isDisabled())).toBe(true);

  await app.saveScreen('only-spaces-cannot-be-sent.png');
}, TIMEOUT);

test('The counter shows near the limit', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;
  const field = messageField(page);
  await field.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('a'.repeat(399));
  expect(await field.inputValue()).toHaveLength(399);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(await anyCounter(page).count()).toBe(0);

  await field.press('End');
  await field.pressSequentially('a');
  expect(await field.inputValue()).toHaveLength(400);

  await page.getByText('400/500', { exact: true }).waitFor({ state: 'visible', timeout: WAIT });

  await app.saveScreen('the-counter-shows-near-the-limit.png');
}, TIMEOUT);

test('A message stops at 500 characters', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;
  const field = messageField(page);
  await field.waitFor({ state: 'visible', timeout: WAIT });

  const pasted = 'abcdefghij'.repeat(52);
  expect(pasted).toHaveLength(520);
  await field.focus();
  await page.keyboard.insertText(pasted);

  expect(await eventually(async () => (await field.inputValue()).length === 500)).toBe(true);
  expect(await field.inputValue()).toBe(pasted.slice(0, 500));

  await page.getByText('500/500', { exact: true }).waitFor({ state: 'visible', timeout: WAIT });
  expect(await sendButton(page).isDisabled()).toBe(false);

  await app.saveScreen('a-message-stops-at-500-characters.png');
}, TIMEOUT);

test('A CPR number is never sent', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;
  const field = messageField(page);
  await field.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('010190-1234');
  await sendButton(page).click();

  await page
    .getByText('This looks like a CPR number, so it wasn\'t saved. Never share CPR numbers on Friendpod.', { exact: true })
    .waitFor({ state: 'visible', timeout: WAIT });

  await new Promise((resolve) => setTimeout(resolve, 1000));
  expect(await page.getByText('010190-1234').count()).toBe(0);
  expect(await field.inputValue()).toBe('010190-1234');

  await app.saveScreen('a-cpr-number-is-never-sent.png');
}, TIMEOUT);

test('Words that are not allowed are refused', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;
  const field = messageField(page);
  await field.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('sugar daddy');
  await sendButton(page).click();

  const refusal = page.getByText(
    'This contains words that aren\'t allowed on Friendpod, so it wasn\'t saved.',
    { exact: true },
  );
  await refusal.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('fine');
  expect(await field.inputValue()).toBe('fine');
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(await refusal.isVisible()).toBe(true);

  await app.saveScreen('words-that-are-not-allowed-are-refused.png');
}, TIMEOUT);

test('A CPR number in Danish', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
  const page = app.page;
  const field = messageField(page, 'Besked');
  await field.waitFor({ state: 'visible', timeout: WAIT });

  await field.fill('010190-1234');
  await sendButton(page, 'Send').click();

  await page
    .getByText('Det ligner et CPR-nummer, så det blev ikke gemt. Del aldrig CPR-numre på Friendpod.', { exact: true })
    .waitFor({ state: 'visible', timeout: WAIT });

  await app.saveScreen('a-cpr-number-in-danish.png');
}, TIMEOUT);
