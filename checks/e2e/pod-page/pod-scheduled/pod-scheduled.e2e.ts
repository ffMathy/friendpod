// End-to-end check of PodScheduled (ail/pod-page/pod-scheduled): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const BRAETSPIL = '/pod/braetspilpodaarhus46';

const visible = async (page: Page, text: string) => {
  await page.getByText(text, { exact: true }).first().waitFor();
  return page.getByText(text, { exact: true }).first().isVisible();
};
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });

test('The day before the meetup', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await heading(page, 'Still coming tomorrow at 14:00?').waitFor();
  expect(await heading(page, 'brætspil').isVisible()).toBe(true);
  expect(await visible(page, '5 people near Aarhus C')).toBe(true);
  expect(await button(page, "Yes, I'm coming").isVisible()).toBe(true);
  expect(await button(page, "Can't make it").isVisible()).toBe(true);
  expect(await heading(page, 'Plan').isVisible()).toBe(true);
  expect(await visible(page, 'Saturday 21 Nov, 14:00')).toBe(true);
  expect(await visible(page, '[Board game café] · Aarhus C')).toBe(true);
  const chat = page.getByRole('link', { name: 'Chat, Open until Sunday 14:00, 3 new', exact: true });
  expect(await chat.isVisible()).toBe(true);
  expect(await chat.getByText('Open until Sunday 14:00', { exact: true }).isVisible()).toBe(true);
  expect(await chat.getByText('3 new', { exact: true }).isVisible()).toBe(true);
  expect(await heading(page, 'Members').isVisible()).toBe(true);
  for (const name of [/^Mette/, /^Jonas/, /^Sofie/, /^Ahmed/]) {
    expect(await page.getByRole('link', { name }).isVisible()).toBe(true);
  }
  expect(await page.getByText('Confirmed', { exact: true }).count()).toBe(0);
  expect(await page.getByText('More than one of you also likes', { exact: true }).count()).toBe(0);
});

test('Just before the meetup the next step is the chat', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member just before a meetup', locale: 'en' });
  const { page } = app;
  await heading(page, 'The meetup chat is open').waitFor();
  await button(page, 'Open chat').click();
  await page.getByRole('textbox', { name: 'Message', exact: true }).waitFor();
});

test('The morning after the meetup', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the morning after a meetup', locale: 'en' });
  const { page } = app;
  await heading(page, 'How did it go?').waitFor();
  expect(await button(page, 'Give feedback').isVisible()).toBe(true);
  const chat = page.getByRole('link', { name: 'Chat, Open until Sunday 14:00, 2 new', exact: true });
  expect(await chat.isVisible()).toBe(true);
  await button(page, 'Give feedback').click();
  await heading(page, 'Who was there?').waitFor();
});

test('The Chat row opens the chat', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: /^Chat, / }).click();
  await page.getByRole('textbox', { name: 'Message', exact: true }).waitFor();
});

test('The pod band in Danish', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'da' });
  const { page } = app;
  for (const text of ['5 personer i nærheden af Aarhus C', 'Næste skridt']) {
    expect(await visible(page, text)).toBe(true);
  }
  expect(await heading(page, 'Kommer du stadig i morgen kl. 14.00?').isVisible()).toBe(true);
  expect(await heading(page, 'Medlemmer').isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Chat, Åben til søndag kl. 14.00, 3 nye', exact: true }).isVisible()).toBe(true);
});
