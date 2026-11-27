// End-to-end check of MeetupAttendance (ail/pod-page/pod-scheduled/meetup-attendance): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const BRAETSPIL = '/pod/braetspilpodaarhus46';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });

test('Saying yes moves the next step on to the chat', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await heading(page, 'Still coming tomorrow at 14:00?').waitFor();
  await button(page, "Yes, I'm coming").click();
  await heading(page, 'The meetup chat is open').waitFor();
  expect(await button(page, 'Open chat').isVisible()).toBe(true);
  expect(await page.getByText("You're coming.", { exact: true }).isVisible()).toBe(true);
  expect(await button(page, "Can't make it").isVisible()).toBe(true);
  expect(await heading(page, 'Still coming tomorrow at 14:00?').count()).toBe(0);
  expect(await button(page, "Yes, I'm coming").count()).toBe(0);
});

test('The viewer already said they are coming', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member just before a meetup', locale: 'en' });
  const { page } = app;
  await page.getByText("You're coming.", { exact: true }).waitFor();
  expect(await button(page, "Can't make it").isVisible()).toBe(true);
});

test('Still coming? in Danish', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member the day before a meetup', locale: 'da' });
  const { page } = app;
  await button(page, 'Ja, jeg kommer').click();
  await page.getByText('Du kommer.', { exact: true }).waitFor();
  expect(await button(page, 'Kan ikke komme').isVisible()).toBe(true);
});
