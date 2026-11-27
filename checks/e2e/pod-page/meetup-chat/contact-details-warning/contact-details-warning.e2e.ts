// End-to-end check of ContactDetailsWarning (ail/pod-page/meetup-chat/contact-details-warning): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';
import type { World } from '../../../data.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const WARNING = "You haven't met yet. It's fine to wait until after the meetup before sharing your number or profile.";

const inChat = (world: World = 'member just before a meetup', locale: 'en' | 'da' = 'en') =>
  openApp({ route: '/pod/braetspilpodaarhus46/chat', world, locale });
const field = (page: Page, name = 'Message') => page.getByRole('textbox', { name });
const send = (page: Page) => page.getByRole('button', { name: 'Send', exact: true });
const warning = (page: Page) => page.getByRole('alert');
/** The screen's text as shown, top to bottom: each message's writer line, then its text. */
const screenText = (page: Page) => page.locator('body').innerText();
const writerLines = (page: Page) => page.getByText(/^(You|Mette|Sofie|Jonas|Ahmed) · /).count();

async function write(page: Page, text: string) {
  await field(page).fill(text);
  await send(page).click();
}

test('A phone number before the meetup needs a second tap', async () => {
  await using app = await inChat();
  const { page } = app;
  const before = await writerLines(page);
  await write(page, '20 30 40 50');
  await warning(page).waitFor();
  expect(await warning(page).innerText()).toBe(WARNING);
  expect(await page.getByRole('button', { name: 'Send anyway' }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Edit', exact: true }).isVisible()).toBe(true);
  expect(await send(page).isDisabled()).toBe(true);
  expect(await writerLines(page)).toBe(before);
});

test('Send anyway sends it', async () => {
  await using app = await inChat();
  const { page } = app;
  await write(page, '20 30 40 50');
  await warning(page).waitFor();
  await page.getByRole('button', { name: 'Send anyway' }).click();
  await page.getByText('You · 13:58', { exact: true }).waitFor();
  const text = await screenText(page);
  expect(text.indexOf('20 30 40 50')).toBeGreaterThan(text.indexOf('You · 13:58'));
  expect(await warning(page).count()).toBe(0);
  expect(await field(page).inputValue()).toBe('');
});

test('Edit keeps the text to change', async () => {
  await using app = await inChat();
  const { page } = app;
  await write(page, 'emil@example.com');
  await warning(page).waitFor();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await warning(page).waitFor({ state: 'detached' });
  expect(await field(page).inputValue()).toBe('emil@example.com');
  expect(await field(page).evaluate((el) => el === document.activeElement)).toBe(true);
  expect(await send(page).isDisabled()).toBe(false);
});

test('Changing the text hides the warning', async () => {
  await using app = await inChat();
  const { page } = app;
  await write(page, 'emil@example.com');
  await warning(page).waitFor();
  await field(page).fill('emil@example.co');
  await warning(page).waitFor({ state: 'detached' });
  await field(page).fill('emil@example.com');
  await warning(page).waitFor();
});

test('A map link is not contact details', async () => {
  await using app = await inChat();
  const { page } = app;
  await write(page, 'https://maps.app.goo.gl/abc123');
  await page.getByText('You · 13:58', { exact: true }).waitFor();
  const text = await screenText(page);
  expect(text.trimEnd().split('\n').slice(-3, -1)).toEqual(['You · 13:58', 'https://maps.app.goo.gl/abc123']);
  expect(await warning(page).count()).toBe(0);
});

test('After the meetup there is no warning', async () => {
  await using app = await inChat('member the morning after a meetup');
  const { page } = app;
  await write(page, '20 30 40 50');
  await page.getByText('You · 10:05', { exact: true }).waitFor();
  const text = await screenText(page);
  expect(text.trimEnd().split('\n').slice(-3, -1)).toEqual(['You · 10:05', '20 30 40 50']);
  expect(await warning(page).count()).toBe(0);
});

test('The warning in Danish', async () => {
  await using app = await inChat('member just before a meetup', 'da');
  const { page } = app;
  await field(page, 'Besked').fill('20 30 40 50');
  await send(page).click();
  await warning(page).waitFor();
  expect(await warning(page).innerText()).toBe(
    'I har ikke mødt hinanden endnu. Det er helt i orden at vente til efter mødet med at dele dit nummer eller din profil.',
  );
  expect(await page.getByRole('button', { name: 'Send alligevel' }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Ret', exact: true }).isVisible()).toBe(true);
});
