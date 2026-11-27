// ail-derived-from: PrivateInterestsCard@24a315b876034aef
import { describe, expect, test } from 'bun:test';
import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

describe('PrivateInterestsCard', () => {
  test(
    'The private interest is shown quietly',
    async () => {
      await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
      const page = app.page;

      await page.getByText('Private interests', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('gravid', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('Consent given 4 Nov 2026', { exact: true }).first().waitFor({ state: 'visible' });

      const remove = page.getByRole('button', { name: 'Remove gravid and withdraw consent for it' });
      await remove.first().waitFor({ state: 'visible' });
      expect(await remove.count()).toBe(1);

      await page.getByText("This isn't sensitive for me", { exact: true }).first().waitFor({ state: 'visible' });
      await page
        .getByText('Only used to form pods about this interest. Never on a profile, never in a notification.', {
          exact: true,
        })
        .first()
        .waitFor({ state: 'visible' });

      await app.saveScreen('the-private-interest-is-shown-quietly.png');
    },
    TIMEOUT,
  );

  test(
    'Remove and withdraw takes the private interest away',
    async () => {
      await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
      const page = app.page;

      const remove = page.getByRole('button', { name: 'Remove gravid and withdraw consent for it' });
      await remove.first().waitFor({ state: 'visible' });
      await remove.first().click();

      await remove.first().waitFor({ state: 'detached' });
      await page.getByText('gravid', { exact: true }).first().waitFor({ state: 'detached' });
      await page.getByText('Private interests', { exact: true }).first().waitFor({ state: 'detached' });
      expect(await page.getByText('gravid', { exact: true }).count()).toBe(0);
      expect(await page.getByText('Private interests', { exact: true }).count()).toBe(0);
      expect(await page.getByText('Consent given 4 Nov 2026', { exact: true }).count()).toBe(0);

      await page.getByText(/\b4 of 20\b/).first().waitFor({ state: 'visible' });
      const bodyText = (await page.locator('body').textContent()) ?? '';
      expect(/(^|[^0-9])4 of 20/.test(bodyText.replace(/\s+/g, ' '))).toBe(true);

      await page.getByText('How private interests work').first().waitFor({ state: 'visible' });

      await app.saveScreen('remove-and-withdraw-takes-the-private-interest-away.png');
    },
    TIMEOUT,
  );

  test(
    'The private card in Danish',
    async () => {
      await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'da' });
      const page = app.page;

      await page.getByText('Private interesser', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('gravid', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('Du sagde ja 4. nov. 2026', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('Fjern og tilbagekald', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('Den er ikke følsom for mig', { exact: true }).first().waitFor({ state: 'visible' });

      await app.saveScreen('the-private-card-in-danish.png');
    },
    TIMEOUT,
  );
});
