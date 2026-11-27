// ail-derived-from: NotificationSettings@d39869525c9fb015
// End-to-end check of NotificationSettings (ail/me/me-settings/notification-settings): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees: labels, roles and the
// copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const route = '/settings/notifications';
const shows = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('Notifications that are on', async () => {
  // In this world the phone has already allowed Friendpod's notifications.
  await using app = await openApp({ route, world: 'member this week', locale: 'en' });
  const { page } = app;
  await shows(page, 'Know when your drop arrives');
  await shows(page, 'Notifications only say things like “Your weekly drop is here”.');
  await shows(page, 'Notifications are on');
  await button(page, 'Turn off in phone settings').waitFor();
  await shows(page, 'What we notify you about');
  for (const line of [
    'Your weekly drop is here',
    'Your pod is confirmed or changes, or your meetup is coming up',
    "There's a new message in your pod's chat",
    "There's a message from Friendpod about your account",
  ]) {
    await shows(page, line);
  }
  await shows(page, 'What a notification never says');
  await shows(page, "Who is in a pod, what it's about, your interests or what anyone wrote.");
});

test('Turning notifications on', async () => {
  // In this world the phone has not asked about notifications yet; the preview's phone allows them when asked.
  await using app = await openApp({ route, world: 'new member with nothing yet', locale: 'en' });
  const { page } = app;
  await button(page, 'Turn on notifications').click();
  await shows(page, 'Notifications are on');
  await button(page, 'Turn off in phone settings').waitFor();
  expect(await button(page, 'Turn on notifications').count()).toBe(0);
});

test("When the phone's settings cannot be opened", async () => {
  // The web preview cannot open the phone's settings, which is this scenario's Given.
  await using app = await openApp({ route, world: 'member this week', locale: 'en' });
  const { page } = app;
  await button(page, 'Turn off in phone settings').click();
  await shows(page, "That did not work. You can change notifications in your phone's settings.");
  expect(await page.getByText('Notifications are on', { exact: true }).isVisible()).toBe(true);
});

test('Notifications in Danish', async () => {
  await using app = await openApp({ route, world: 'member this week', locale: 'da' });
  const { page } = app;
  await shows(page, 'Få besked, når dit drop lander');
  await shows(page, 'Notifikationer er slået til');
  await button(page, 'Slå fra i telefonens indstillinger').waitFor();
});
