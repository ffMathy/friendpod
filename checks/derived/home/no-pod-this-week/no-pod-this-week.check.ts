// ail-derived-from: NoPodThisWeek@69d3b8114b8fe271
import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

/** Waits until a text the user can read is visible on the page. */
async function seen(page: Page, text: string): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible', timeout: 15_000 });
}

/** The accessible names of the links on the page, in page order. */
async function linkNames(page: Page): Promise<string[]> {
  const names = await page.getByRole('link').allTextContents();
  return names.map((name) => name.trim());
}

/** The position of the first link whose text contains the given text, or -1. */
function indexOfLink(names: string[], text: string): number {
  return names.findIndex((name) => name.includes(text));
}

describe('NoPodThisWeek', () => {
  test(
    'No pod this week',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with no pod this week', locale: 'en' });
      const page = app.page;

      await seen(page, 'This week');
      await seen(page, 'Week 46');
      await seen(page, 'No pod for you this week');
      await seen(
        page,
        "Not enough people near you shared one of your interests and fit everyone's settings this time.",
      );
      await seen(page, "You'll get priority next week.");
      await seen(page, 'Things that often help');

      const interests = page.getByRole('link', { name: 'Add a few more interests' });
      await interests.first().waitFor({ state: 'visible', timeout: 15_000 });
      const tryKm = page.getByRole('link', { name: 'Try about 15 km' });
      await tryKm.first().waitFor({ state: 'visible', timeout: 15_000 });

      const names = await linkNames(page);
      const interestsAt = indexOfLink(names, 'Add a few more interests');
      const tryKmAt = indexOfLink(names, 'Try about 15 km');
      expect(interestsAt).toBeGreaterThanOrEqual(0);
      expect(tryKmAt).toBeGreaterThan(interestsAt);

      const openToAnyone = page.getByRole('switch', { name: 'Open to meeting anyone' });
      await openToAnyone.first().waitFor({ state: 'visible', timeout: 15_000 });
      await seen(page, 'A pod without a shared theme');

      await seen(page, 'Next drop: Thursday 18:00');

      await app.saveScreen('no-pod-this-week.png');
    },
    TIMEOUT,
  );

  test(
    'The reason names the setting',
    async () => {
      await using app = await openApp({ route: '/', world: 'member kept out by a setting', locale: 'en' });
      const page = app.page;

      await seen(page, 'Your distance setting leaves too few people near you to form a pod.');

      const tryKm = page.getByRole('link', { name: 'Try about 15 km' });
      await tryKm.first().waitFor({ state: 'visible', timeout: 15_000 });
      const interests = page.getByRole('link', { name: 'Add a few more interests' });
      await interests.first().waitFor({ state: 'visible', timeout: 15_000 });

      const names = await linkNames(page);
      const tryKmAt = indexOfLink(names, 'Try about 15 km');
      const interestsAt = indexOfLink(names, 'Add a few more interests');
      expect(tryKmAt).toBeGreaterThanOrEqual(0);
      expect(interestsAt).toBeGreaterThan(tryKmAt);

      await app.saveScreen('the-reason-names-the-setting.png');
    },
    TIMEOUT,
  );

  test(
    'A tip opens the setting',
    async () => {
      await using app = await openApp({ route: '/', world: 'member kept out by a setting', locale: 'en' });
      const page = app.page;

      const tryKm = page.getByRole('link', { name: 'Try about 15 km' }).first();
      await tryKm.waitFor({ state: 'visible', timeout: 15_000 });
      await tryKm.click();

      await page.waitForURL(/\/settings\/preferences/, { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe('/settings/preferences');

      await app.saveScreen('a-tip-opens-the-setting.png');
    },
    TIMEOUT,
  );

  test(
    'A tip opens the interests',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with no pod this week', locale: 'en' });
      const page = app.page;

      const interests = page.getByRole('link', { name: 'Add a few more interests' }).first();
      await interests.waitFor({ state: 'visible', timeout: 15_000 });
      await interests.click();

      await page.waitForURL(/\/interests/, { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe('/interests');

      await app.saveScreen('a-tip-opens-the-interests.png');
    },
    TIMEOUT,
  );

  test(
    'No pod in Danish',
    async () => {
      await using app = await openApp({ route: '/', world: 'member kept out by a setting', locale: 'da' });
      const page = app.page;

      await seen(page, 'Denne uge');
      await seen(page, 'Ingen pod i denne uge');
      await seen(page, 'Med den afstand, du har valgt, er der for få i nærheden til at samle en pod.');
      await seen(page, 'Du får forrang i næste uge.');
      await seen(page, 'Det hjælper ofte');

      await page.getByRole('link', { name: 'Prøv med ca. 15 km' }).first().waitFor({ state: 'visible', timeout: 15_000 });
      await page
        .getByRole('link', { name: 'Tilføj et par interesser mere' })
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('switch', { name: 'Åben for at møde alle' }).first().waitFor({ state: 'visible', timeout: 15_000 });

      await seen(page, 'Næste drop: torsdag kl. 18.00');

      await app.saveScreen('no-pod-in-danish.png');
    },
    TIMEOUT,
  );
});
