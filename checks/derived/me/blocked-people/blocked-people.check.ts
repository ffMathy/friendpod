// ail-derived-from: BlockedPeople@86027c2540fea8be
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const ROUTE = '/settings/blocked';
const TIMEOUT = 180_000;

describe('BlockedPeople', () => {
  test(
    'One blocked person',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      const lede = page.getByText("You're never matched with someone you've blocked.").first();
      await lede.waitFor({ state: 'visible' });

      await page.getByText('Rasmus', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('Blocked 31 Oct').first().waitFor({ state: 'visible' });

      const unblock = page.getByRole('button', { name: 'Unblock Rasmus' });
      await unblock.waitFor({ state: 'visible' });
      expect(await unblock.count()).toBe(1);

      const howTo = page.getByText('To block someone, tap their name in a pod.').first();
      await howTo.waitFor({ state: 'visible' });

      const unblockBox = await unblock.boundingBox();
      const howToBox = await howTo.boundingBox();
      expect(unblockBox).not.toBeNull();
      expect(howToBox).not.toBeNull();
      if (unblockBox !== null && howToBox !== null) {
        expect(howToBox.y).toBeGreaterThan(unblockBox.y);
      }

      await app.saveScreen('one-blocked-person.png');
    },
    TIMEOUT,
  );

  test(
    'Unblocking takes the block away at once',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      const unblock = page.getByRole('button', { name: 'Unblock Rasmus' });
      await unblock.waitFor({ state: 'visible' });
      await unblock.click();

      await page.getByText("You haven't blocked anyone.").first().waitFor({ state: 'visible' });
      expect(await page.getByRole('button', { name: 'Unblock Rasmus' }).count()).toBe(0);

      await app.saveScreen('unblocking-takes-the-block-away-at-once.png');
    },
    TIMEOUT,
  );

  test(
    'Nobody blocked',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'new member with nothing yet', locale: 'en' });
      const page = app.page;

      await page.getByText("You haven't blocked anyone.").first().waitFor({ state: 'visible' });
      await page.getByText('To block someone, tap their name in a pod.').first().waitFor({ state: 'visible' });

      await app.saveScreen('nobody-blocked.png');
    },
    TIMEOUT,
  );

  test(
    'Blocked people in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'da' });
      const page = app.page;

      await page.getByText('Blokerede personer').first().waitFor({ state: 'visible' });
      await page.getByText('Rasmus', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('Blokeret 31. okt.').first().waitFor({ state: 'visible' });

      const unblock = page.getByRole('button', { name: 'Fjern blokering af Rasmus' });
      await unblock.waitFor({ state: 'visible' });
      const label = (await unblock.textContent()) ?? '';
      expect(label).toContain('Fjern blokering');

      await app.saveScreen('blocked-people-in-danish.png');
    },
    TIMEOUT,
  );
});
