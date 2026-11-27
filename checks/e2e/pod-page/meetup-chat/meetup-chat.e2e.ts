// ail-derived-from: MeetupChat@955e57436a66d168
// End-to-end check of MeetupChat (ail/pod-page/meetup-chat): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const BRAETSPIL_CHAT = '/pod/braetspilpodaarhus46/chat';
const PRIVACY_NOTE =
  'Only your pod can read this. Messages are deleted about 3 days after the meetup. Press and hold a message to report it.';

const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).isVisible();

/** Press and hold, as a finger does: the app reports a message on a long press. */
async function pressAndHold(target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error('nothing to press');
  await target.page().mouse.move(box.x + 10, box.y + box.height / 2);
  await target.page().mouse.down();
  await target.page().waitForTimeout(900);
  await target.page().mouse.up();
}

test('The chat just before the meetup', async () => {
  await using app = await openApp({ route: BRAETSPIL_CHAT, world: 'member just before a meetup' });
  const { page } = app;
  expect(await page.getByRole('heading', { name: 'brætspil' }).isVisible()).toBe(true);
  expect(await visible(page, 'Chat open until Sunday 14:00')).toBe(true);
  expect(await page.getByRole('button', { name: 'Back to pod' }).isVisible()).toBe(true);
  expect(await visible(page, PRIVACY_NOTE)).toBe(true);
  const field = page.getByRole('textbox', { name: 'Message' });
  expect(await field.getAttribute('placeholder')).toBe('Write to your pod');
  expect(await page.getByRole('button', { name: 'Send', exact: true }).isDisabled()).toBe(true);
});

test('Opening the chat clears its new messages', async () => {
  await using app = await openApp({ route: '/pod/braetspilpodaarhus46', world: 'member the day before a meetup' });
  const { page } = app;
  const chatRow = page.getByRole('link', { name: /^Chat,/ });
  expect(await chatRow.getAttribute('aria-label')).toContain('3 new');
  await chatRow.click();
  await page.getByText("Count me in! I'll be there a few minutes early to grab a table.", { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back to pod' }).click();
  await page.getByRole('link', { name: /^Chat,/ }).waitFor();
  expect(await page.getByRole('heading', { name: 'brætspil' }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: /^Chat,/ }).getAttribute('aria-label')).not.toContain('new');
});

test('Back from a chat opened on its own goes to the Pods tab', async () => {
  await using app = await openApp({ route: BRAETSPIL_CHAT, world: 'member just before a meetup' });
  const { page } = app;
  await page.getByRole('button', { name: 'Back to pod' }).click();
  await page.getByRole('tab', { name: 'Pods', selected: true }).waitFor();
  expect(await page.getByRole('textbox', { name: 'Message' }).count()).toBe(0);
});

test('Press and hold a message to report it', async () => {
  await using app = await openApp({ route: BRAETSPIL_CHAT, world: 'member just before a meetup' });
  const { page } = app;
  await pressAndHold(page.getByText('Running 10 min late, sorry! Save me a seat.', { exact: true }));
  await page.getByText('Report a message', { exact: true }).waitFor();
});

test('Your own message cannot be reported', async () => {
  await using app = await openApp({ route: BRAETSPIL_CHAT, world: 'member just before a meetup' });
  const { page } = app;
  await pressAndHold(page.getByText('Me too, it will be fine. See you at 14!', { exact: true }));
  await page.waitForTimeout(1000);
  expect(await page.getByText('Report a message', { exact: true }).count()).toBe(0);
  expect(await page.getByRole('textbox', { name: 'Message' }).isVisible()).toBe(true);
});

test('Only members see the chat', async () => {
  await using app = await openApp({ route: BRAETSPIL_CHAT, world: 'member with a pod proposal' });
  const { page } = app;
  await page.getByText('Only current members of this pod can see its chat.', { exact: true }).waitFor();
  expect(await page.getByRole('textbox', { name: 'Message' }).count()).toBe(0);
});

test('The chat of a pod that is gone', async () => {
  await using app = await openApp({ route: '/pod/neverapodofmine/chat', world: 'member just before a meetup' });
  const { page } = app;
  await page.getByText('This pod no longer exists.', { exact: true }).waitFor();
  expect(await page.getByRole('textbox', { name: 'Message' }).count()).toBe(0);
});

test('The chat in Danish', async () => {
  await using app = await openApp({ route: BRAETSPIL_CHAT, world: 'member just before a meetup', locale: 'da' });
  const { page } = app;
  expect(await visible(page, 'Åben til søndag kl. 14.00')).toBe(true);
  expect(await page.getByRole('button', { name: 'Tilbage til poden' }).isVisible()).toBe(true);
  expect(await page.getByRole('textbox', { name: 'Besked' }).getAttribute('placeholder')).toBe('Skriv til jeres pod');
});
