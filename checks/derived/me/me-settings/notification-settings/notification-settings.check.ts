// ail-derived-from: NotificationSettings@d39869525c9fb015
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/settings/notifications';
const TIMEOUT = 180_000;

describe('NotificationSettings', () => {
  test(
    'Notifications that are on',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      await page.getByText('Know when your drop arrives', { exact: true }).waitFor({ state: 'visible' });
      await page
        .getByText('Notifications only say things like “Your weekly drop is here”.', { exact: true })
        .waitFor({ state: 'visible' });

      await page.getByText('Notifications are on', { exact: true }).waitFor({ state: 'visible' });
      const turnOff = page.getByRole('button', { name: 'Turn off in phone settings' });
      await turnOff.waitFor({ state: 'visible' });
      expect(await turnOff.isVisible()).toBe(true);

      await page.getByText('What we notify you about', { exact: true }).waitFor({ state: 'visible' });
      for (const line of [
        'Your weekly drop is here',
        'Your pod is confirmed or changes, or your meetup is coming up',
        "There's a new message in your pod's chat",
        "There's a message from Friendpod about your account",
      ]) {
        const item = page.getByText(line, { exact: true });
        await item.waitFor({ state: 'visible' });
        expect(await item.isVisible()).toBe(true);
      }

      await page.getByText('What a notification never says', { exact: true }).waitFor({ state: 'visible' });
      const never = page.getByText("Who is in a pod, what it's about, your interests or what anyone wrote.", {
        exact: true,
      });
      await never.waitFor({ state: 'visible' });
      expect(await never.isVisible()).toBe(true);

      await app.saveScreen('notifications-that-are-on.png');
    },
    TIMEOUT,
  );

  test(
    'Turning notifications on',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'new member with nothing yet', locale: 'en' });
      const page = app.page;

      const turnOn = page.getByRole('button', { name: 'Turn on notifications' });
      await turnOn.waitFor({ state: 'visible' });
      expect(await turnOn.isVisible()).toBe(true);

      // The member allows notifications when the phone asks.
      await page.context().grantPermissions(['notifications']);
      await turnOn.click();

      const on = page.getByText('Notifications are on', { exact: true });
      await on.waitFor({ state: 'visible' });
      expect(await on.isVisible()).toBe(true);
      const turnOff = page.getByRole('button', { name: 'Turn off in phone settings' });
      await turnOff.waitFor({ state: 'visible' });
      expect(await turnOff.isVisible()).toBe(true);

      await app.saveScreen('turning-notifications-on.png');
    },
    TIMEOUT,
  );

  test(
    "When the phone's settings cannot be opened",
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      const turnOff = page.getByRole('button', { name: 'Turn off in phone settings' });
      await turnOff.waitFor({ state: 'visible' });
      await turnOff.click();

      const failed = page.getByText(
        "That did not work. You can change notifications in your phone's settings.",
        { exact: true },
      );
      await failed.waitFor({ state: 'visible' });
      expect(await failed.isVisible()).toBe(true);

      const on = page.getByText('Notifications are on', { exact: true });
      await on.waitFor({ state: 'visible' });
      expect(await on.isVisible()).toBe(true);

      await app.saveScreen('when-the-phone-s-settings-cannot-be-opened.png');
    },
    TIMEOUT,
  );

  test(
    'Notifications in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'da' });
      const page = app.page;

      for (const text of ['Få besked, når dit drop lander', 'Notifikationer er slået til']) {
        const el = page.getByText(text, { exact: true });
        await el.waitFor({ state: 'visible' });
        expect(await el.isVisible()).toBe(true);
      }
      const turnOff = page.getByRole('button', { name: 'Slå fra i telefonens indstillinger' });
      await turnOff.waitFor({ state: 'visible' });
      expect(await turnOff.isVisible()).toBe(true);

      await app.saveScreen('notifications-in-danish.png');
    },
    TIMEOUT,
  );
});
