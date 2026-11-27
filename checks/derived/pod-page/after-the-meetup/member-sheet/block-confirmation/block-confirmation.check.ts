// ail-derived-from: BlockConfirmation@249997988c0e3f48
import { describe, expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { isTicked, openApp } from '../../../../../harness/preview';

const TIMEOUT = 300_000;

const JONAS_ROUTE = '/pod/braetspilpodaarhus46/member/u_jonas';
const METTE_ROUTE = '/pod/braetspilpodaarhus46/member/u_mette';
const SOFIE_ROUTE = '/pod/climbingpodaarhus42a/member/u_sofie';
const RASMUS_ROUTE = '/pod/climbingpodaarhus42a/member/u_rasmus';

const BLOCK_BODY = "You'll never be matched again, and photos are hidden both ways.";

async function visible(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible' });
}

async function gone(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'hidden' });
  expect(await locator.count()).toBe(0);
}

describe('BlockConfirmation', () => {
  test(
    'Block asks first and takes the member out by default',
    async () => {
      await using app = await openApp({ route: JONAS_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Block Jonas', exact: true }).click();

      await visible(page.getByText('Block Jonas?', { exact: true }));
      await visible(page.getByText(BLOCK_BODY, { exact: true }));

      await visible(page.getByText('What should happen to the pod?', { exact: true }));
      const removeThem = page.getByRole('radio', { name: 'Take Jonas out of the pod', exact: true });
      await visible(removeThem);
      await visible(page.getByRole('radio', { name: 'Leave the pod myself instead', exact: true }));
      expect(await isTicked(removeThem)).toBe(true);
      expect(await page.getByRole('radio', { name: 'Take them out and re-plan the meetup', exact: true }).count()).toBe(0);
      expect(await page.getByText('Take them out and re-plan the meetup', { exact: true }).count()).toBe(0);

      await visible(page.getByText('The others only see that the pod changed.', { exact: true }));

      await gone(page.getByRole('button', { name: 'Report Jonas', exact: true }));
      await visible(page.getByRole('button', { name: 'Block Jonas', exact: true }));
      await visible(page.getByRole('button', { name: 'Cancel', exact: true }));

      await app.saveScreen('block-asks-first-and-takes-the-member-out-by-default.png');
    },
    TIMEOUT,
  );

  test(
    'Leaving instead keeps the member in the pod',
    async () => {
      await using app = await openApp({ route: JONAS_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Block Jonas', exact: true }).click();
      await visible(page.getByText('Block Jonas?', { exact: true }));

      await page.getByRole('radio', { name: 'Leave the pod myself instead', exact: true }).click();

      await visible(page.getByText('Jonas stays in the pod. The others only see “A member left”.', { exact: true }));

      await app.saveScreen('leaving-instead-keeps-the-member-in-the-pod.png');
    },
    TIMEOUT,
  );

  test(
    'A scheduled meetup can be re-planned',
    async () => {
      await using app = await openApp({ route: METTE_ROUTE, world: 'member the day before a meetup', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Block Mette', exact: true }).click();
      await page.getByRole('radio', { name: 'Take them out and re-plan the meetup', exact: true }).click();

      await visible(
        page.getByText(
          "They already know where and when you're meeting. Re-planning picks a new time and place within 48 hours.",
          { exact: true },
        ),
      );

      await app.saveScreen('a-scheduled-meetup-can-be-re-planned.png');
    },
    TIMEOUT,
  );

  test(
    'In a past pod, Block asks without choices',
    async () => {
      await using app = await openApp({ route: SOFIE_ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      await visible(page.getByRole('button', { name: 'Block Sofie', exact: true }));
      await visible(page.getByText(BLOCK_BODY, { exact: true }));
      expect(
        await page
          .getByText('You\'ll never be matched again. Sofie is taken out of this pod and only sees that the pod changed.', {
            exact: true,
          })
          .count(),
      ).toBe(0);
      expect(await page.getByText('Sofie stays in the pod. The others only see “A member left”.', { exact: true }).count()).toBe(
        0,
      );

      await page.getByRole('button', { name: 'Block Sofie', exact: true }).click();

      await visible(page.getByText('Block Sofie?', { exact: true }));
      expect(await page.getByText('What should happen to the pod?', { exact: true }).count()).toBe(0);
      expect(await page.getByRole('radio').count()).toBe(0);
      await gone(page.getByRole('button', { name: 'Report Sofie', exact: true }));
      await visible(page.getByRole('button', { name: 'Block Sofie', exact: true }));
      await visible(page.getByRole('button', { name: 'Cancel', exact: true }));

      await app.saveScreen('in-a-past-pod-block-asks-without-choices.png');
    },
    TIMEOUT,
  );

  test(
    'Cancel returns to the sheet',
    async () => {
      await using app = await openApp({ route: JONAS_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Block Jonas', exact: true }).click();
      await visible(page.getByText('Block Jonas?', { exact: true }));

      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      await gone(page.getByText('Block Jonas?', { exact: true }));
      await visible(page.getByRole('button', { name: 'Block Jonas', exact: true }));
      await visible(page.getByRole('button', { name: 'Report Jonas', exact: true }));

      await app.saveScreen('cancel-returns-to-the-sheet.png');
    },
    TIMEOUT,
  );

  test(
    'Confirming the block closes the sheet',
    async () => {
      await using app = await openApp({ route: JONAS_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Block Jonas', exact: true }).click();
      await visible(page.getByText('Block Jonas?', { exact: true }));

      await page.getByRole('button', { name: 'Block Jonas', exact: true }).click();

      await page.waitForURL((url) => url.pathname.replace(/\/$/, '') === '/pod/braetspilpodaarhus46');
      await gone(page.getByText('Block Jonas?', { exact: true }));
      await gone(page.getByRole('button', { name: 'Block Jonas', exact: true }));
      await gone(page.getByRole('button', { name: 'Report Jonas', exact: true }));

      await app.saveScreen('confirming-the-block-closes-the-sheet.png');
    },
    TIMEOUT,
  );

  test(
    'Someone already blocked can be unblocked',
    async () => {
      await using app = await openApp({ route: RASMUS_ROUTE, world: 'member this week', locale: 'en' });
      const page = app.page;

      await visible(page.getByText('Former member', { exact: true }));
      await visible(page.getByRole('button', { name: 'Unblock this person', exact: true }));
      await visible(page.getByText("You've blocked this person.", { exact: true }));

      await page.getByRole('button', { name: 'Unblock this person', exact: true }).click();

      await visible(page.getByRole('button', { name: 'Block this person', exact: true }));

      await app.saveScreen('someone-already-blocked-can-be-unblocked.png');
    },
    TIMEOUT,
  );

  test(
    'The confirmation in Danish',
    async () => {
      await using app = await openApp({ route: JONAS_ROUTE, world: 'member the morning after a meetup', locale: 'da' });
      const page = app.page;

      await page.getByRole('button', { name: 'Bloker Jonas', exact: true }).click();

      await visible(page.getByText('Bloker Jonas?', { exact: true }));
      await visible(page.getByText('Hvad skal der ske med poden?', { exact: true }));
      await visible(page.getByRole('radio', { name: 'Tag Jonas ud af poden', exact: true }));
      await visible(page.getByRole('radio', { name: 'Forlad hellere selv poden', exact: true }));
      await visible(page.getByRole('button', { name: 'Annullér', exact: true }));

      await app.saveScreen('the-confirmation-in-danish.png');
    },
    TIMEOUT,
  );
});
