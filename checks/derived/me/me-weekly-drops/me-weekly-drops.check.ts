// ail-derived-from: MeWeeklyDrops@f9e8d616f0bf7176
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 15_000;

describe('MeWeeklyDrops', () => {
  test(
    'In every week',
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
      const page = app.page;

      await page.getByText('Weekly drops', { exact: true }).first().waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.getByText("You're in this week", { exact: true }).waitFor({ state: 'visible', timeout: TIMEOUT });

      const everyWeek = page.getByRole('radio', { name: 'Every week' });
      const whenIOptIn = page.getByRole('radio', { name: 'When I opt in' });
      const skip = page.getByRole('button', { name: 'Skip this week' });
      const pause = page.getByRole('button', { name: 'Pause matching' });

      await everyWeek.waitFor({ state: 'visible', timeout: TIMEOUT });
      await whenIOptIn.waitFor({ state: 'visible', timeout: TIMEOUT });
      await skip.waitFor({ state: 'visible', timeout: TIMEOUT });
      await pause.waitFor({ state: 'visible', timeout: TIMEOUT });

      expect(await page.getByRole('button', { name: 'Join this week' }).count()).toBe(0);

      // The choices come first, then the actions under them.
      const choiceBox = await everyWeek.boundingBox();
      const optInBox = await whenIOptIn.boundingBox();
      const skipBox = await skip.boundingBox();
      const pauseBox = await pause.boundingBox();
      expect(choiceBox).not.toBeNull();
      expect(optInBox).not.toBeNull();
      expect(skipBox).not.toBeNull();
      expect(pauseBox).not.toBeNull();
      if (choiceBox && optInBox && skipBox && pauseBox) {
        expect(skipBox.y).toBeGreaterThanOrEqual(choiceBox.y + choiceBox.height - 1);
        expect(skipBox.y).toBeGreaterThanOrEqual(optInBox.y + optInBox.height - 1);
        expect(skipBox.x).toBeLessThan(pauseBox.x);
      }

      await app.saveScreen('in-every-week.png');
    },
    120_000,
  );

  test(
    "Opting in week by week leaves this week's drop",
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
      const page = app.page;

      const whenIOptIn = page.getByRole('radio', { name: 'When I opt in' });
      await whenIOptIn.waitFor({ state: 'visible', timeout: TIMEOUT });
      await whenIOptIn.click();

      await page
        .getByText("You're not in this week's drop", { exact: true })
        .waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.getByText('Applies from week 46', { exact: true }).waitFor({ state: 'visible', timeout: TIMEOUT });

      await page.getByRole('button', { name: 'Join this week' }).waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.getByRole('button', { name: 'Skip this week' }).waitFor({ state: 'detached', timeout: TIMEOUT });
      expect(await page.getByRole('button', { name: 'Skip this week' }).count()).toBe(0);

      await app.saveScreen('opting-in-week-by-week-leaves-this-week-s-drop.png');
    },
    120_000,
  );

  test(
    'Skipping a week says when it applies',
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
      const page = app.page;

      const skip = page.getByRole('button', { name: 'Skip this week' });
      await skip.waitFor({ state: 'visible', timeout: TIMEOUT });
      await skip.click();

      await page.getByText('Applies from week 46', { exact: true }).waitFor({ state: 'visible', timeout: TIMEOUT });

      await app.saveScreen('skipping-a-week-says-when-it-applies.png');
    },
    120_000,
  );

  test(
    'Weekly drops in Danish',
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'da' });
      const page = app.page;

      const manual = page.getByRole('radio', { name: 'Når jeg melder mig til' });
      await manual.waitFor({ state: 'visible', timeout: TIMEOUT });
      await manual.click();

      await page
        .getByText('Du er ikke med i denne uges drop', { exact: true })
        .waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.getByRole('button', { name: 'Vær med i denne uge' }).waitFor({ state: 'visible', timeout: TIMEOUT });
      await page.getByText('Gælder fra uge 46', { exact: true }).waitFor({ state: 'visible', timeout: TIMEOUT });

      await app.saveScreen('weekly-drops-in-danish.png');
    },
    120_000,
  );
});
