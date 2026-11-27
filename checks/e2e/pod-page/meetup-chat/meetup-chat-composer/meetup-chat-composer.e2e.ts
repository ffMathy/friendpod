// ail-derived-from: MeetupChatComposer@c2d021146aac2123
// End-to-end check of MeetupChatComposer (ail/pod-page/meetup-chat/meetup-chat-composer): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const inChat = (locale: 'en' | 'da' = 'en') =>
  openApp({ route: '/pod/braetspilpodaarhus46/chat', world: 'member just before a meetup', locale });
const field = (page: Page, name = 'Message') => page.getByRole('textbox', { name });
const send = (page: Page) => page.getByRole('button', { name: 'Send', exact: true });
/** The screen's text as shown, top to bottom: each message's writer line, then its text. */
const thread = (page: Page) => page.locator('body').innerText();

const CPR = "This looks like a CPR number, so it wasn't saved. Never share CPR numbers on Friendpod.";
const BLOCKLIST = "This contains words that aren't allowed on Friendpod, so it wasn't saved.";

test('A message is sent and the field empties', async () => {
  await using app = await inChat();
  const { page } = app;
  await field(page).fill('On my way!');
  await send(page).click();
  await page.getByText('You · 13:58', { exact: true }).waitFor();
  const text = await thread(page);
  expect(text.indexOf('You · 13:58')).toBeGreaterThan(text.indexOf("I'm here, table by the window, green jacket."));
  expect(text.indexOf('On my way!')).toBeGreaterThan(text.indexOf('You · 13:58'));
  expect(await field(page).inputValue()).toBe('');
});

test('Only spaces cannot be sent', async () => {
  await using app = await inChat();
  const { page } = app;
  await field(page).fill('   ');
  expect(await send(page).isDisabled()).toBe(true);
});

test('The counter shows near the limit', async () => {
  await using app = await inChat();
  const { page } = app;
  await field(page).fill('a'.repeat(399));
  await page.waitForTimeout(200);
  expect(await page.getByText(/^\d+\/500$/).count()).toBe(0);
  await field(page).press('End');
  await field(page).pressSequentially('a');
  await page.getByText('400/500', { exact: true }).waitFor();
});

test('A message stops at 500 characters', async () => {
  await using app = await inChat();
  const { page } = app;
  await field(page).fill('a'.repeat(520));
  await page.waitForTimeout(200);
  expect((await field(page).inputValue()).length).toBe(500);
  expect(await page.getByText('500/500', { exact: true }).isVisible()).toBe(true);
  expect(await send(page).isDisabled()).toBe(false);
});

test('A CPR number is never sent', async () => {
  await using app = await inChat();
  const { page } = app;
  const before = await page.getByText(/ · /).count();
  await field(page).fill('010190-1234');
  await send(page).click();
  await page.getByText(CPR, { exact: true }).waitFor();
  expect(await page.getByText(/ · /).count()).toBe(before);
  expect(await field(page).inputValue()).toBe('010190-1234');
});

test('Words that are not allowed are refused', async () => {
  await using app = await inChat();
  const { page } = app;
  await field(page).fill('sugar daddy');
  await send(page).click();
  await page.getByText(BLOCKLIST, { exact: true }).waitFor();
  await field(page).fill('fine');
  await page.waitForTimeout(300);
  expect(await page.getByText(BLOCKLIST, { exact: true }).isVisible()).toBe(true);
});

test('A CPR number in Danish', async () => {
  await using app = await inChat('da');
  const { page } = app;
  await field(page, 'Besked').fill('010190-1234');
  await send(page).click();
  await page.getByText('Det ligner et CPR-nummer, så det blev ikke gemt. Del aldrig CPR-numre på Friendpod.', { exact: true }).waitFor();
});
