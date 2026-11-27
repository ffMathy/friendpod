// ail-derived-from: PodPreferences@5e85b452102426f9
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { isTicked, openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

const TIME_SLOTS = [
  'Weekdays, daytime',
  'Weekdays, evening',
  'Saturday, daytime',
  'Saturday, evening',
  'Sunday, daytime',
  'Sunday, evening',
] as const;

function normalize(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function pathOf(url: URL | string): string {
  return new URL(url.toString()).pathname;
}

async function waitForPreferences(page: Page): Promise<void> {
  await page.getByRole('radiogroup', { name: "How far would you travel?" }).waitFor({ state: 'visible' });
}

function timeSlot(page: Page, name: string): Locator {
  return page.getByLabel(name, { exact: true }).first();
}

test(
  'The page shows what is saved',
  async () => {
    await using app = await openApp({ route: '/settings/preferences', world: 'member this week', locale: 'en' });
    const page = app.page;
    await waitForPreferences(page);

    const title = page.getByText('Pod preferences', { exact: true }).first();
    await title.waitFor({ state: 'visible' });
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();

    const eyebrows = page.getByText('Me', { exact: true });
    const count = await eyebrows.count();
    let eyebrowAbove = false;
    for (let i = 0; i < count; i += 1) {
      const box = await eyebrows.nth(i).boundingBox();
      if (box !== null && titleBox !== null && box.y + box.height <= titleBox.y + 2) {
        eyebrowAbove = true;
      }
    }
    expect(eyebrowAbove).toBe(true);

    await page
      .getByText("Who you'd like to meet and when you're free. Changes count from the next drop.", { exact: true })
      .first()
      .waitFor({ state: 'visible' });

    const bodyText = normalize(await page.locator('body').innerText());
    expect(bodyText).toContain('Ages');
    expect(bodyText).toContain('28–42');

    expect(await isTicked(page.getByRole('radio', { name: 'about 10 km' }))).toBe(true);
    expect(await isTicked(page.getByRole('checkbox', { name: 'Danish' }))).toBe(true);
    expect(await isTicked(page.getByRole('checkbox', { name: 'English' }))).toBe(true);

    expect(await isTicked(timeSlot(page, 'Weekdays, evening'))).toBe(true);
    expect(await isTicked(timeSlot(page, 'Saturday, daytime'))).toBe(true);
    expect(await isTicked(timeSlot(page, 'Sunday, daytime'))).toBe(true);
    expect(await isTicked(timeSlot(page, 'Weekdays, daytime'))).toBe(false);
    expect(await isTicked(timeSlot(page, 'Saturday, evening'))).toBe(false);
    expect(await isTicked(timeSlot(page, 'Sunday, evening'))).toBe(false);

    await app.saveScreen('the-page-shows-what-is-saved.png');
  },
  TIMEOUT,
);

test(
  'Saved changes show on Me',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    const rowText = page.getByText('Pod preferences', { exact: true }).first();
    await rowText.waitFor({ state: 'visible' });
    await rowText.click();

    await page.waitForURL((url) => pathOf(url) === '/settings/preferences');
    await waitForPreferences(page);

    await page.getByRole('radio', { name: 'about 15 km' }).click();
    await page.getByRole('checkbox', { name: 'Danish' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL((url) => pathOf(url) === '/me');

    const row = page
      .locator('[role="button"], [role="link"], a', { hasText: 'Pod preferences' })
      .filter({ hasText: 'about 15 km' })
      .first();
    await row.waitFor({ state: 'visible' });
    const text = normalize(await row.textContent());
    expect(text).toContain('Ages 28–42 · about 15 km');
    expect(text).toContain('English');

    await app.saveScreen('saved-changes-show-on-me.png');
  },
  TIMEOUT,
);

test(
  'Save needs a language and a time',
  async () => {
    await using app = await openApp({ route: '/settings/preferences', world: 'member this week', locale: 'en' });
    const page = app.page;
    await waitForPreferences(page);

    for (const name of ['Danish', 'English']) {
      const box = page.getByRole('checkbox', { name });
      if (await isTicked(box)) {
        await box.click();
      }
      expect(await isTicked(box)).toBe(false);
    }
    for (const name of TIME_SLOTS) {
      const slot = timeSlot(page, name);
      if (await isTicked(slot)) {
        await slot.click();
      }
      expect(await isTicked(slot)).toBe(false);
    }

    await page.getByRole('button', { name: 'Save' }).click();

    await page.getByText('Pick at least one language.', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Pick at least one time.', { exact: true }).first().waitFor({ state: 'visible' });

    expect(pathOf(page.url())).toBe('/settings/preferences');
    expect(await page.getByText('Pod preferences', { exact: true }).first().isVisible()).toBe(true);

    await page.getByRole('checkbox', { name: 'English' }).click();
    await page.getByText('Pick at least one language.', { exact: true }).first().waitFor({ state: 'hidden' });
    expect(await page.getByText('Pick at least one language.', { exact: true }).count()).toBe(0);

    await app.saveScreen('save-needs-a-language-and-a-time.png');
  },
  TIMEOUT,
);

test(
  'Pod preferences in Danish',
  async () => {
    await using app = await openApp({ route: '/settings/preferences', world: 'member this week', locale: 'da' });
    const page = app.page;

    for (const text of ['Ønsker til pods', 'Alder', 'Hvor langt vil du rejse for at mødes?', 'Sprog til møderne']) {
      await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible' });
    }
    expect(await page.getByRole('checkbox', { name: 'Dansk' }).isVisible()).toBe(true);
    expect(await page.getByRole('checkbox', { name: 'Engelsk' }).isVisible()).toBe(true);
    expect(await page.getByRole('button', { name: 'Gem' }).isVisible()).toBe(true);

    await app.saveScreen('pod-preferences-in-danish.png');
  },
  TIMEOUT,
);
