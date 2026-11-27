// ail-derived-from: PreferencesStep@2308df55283d58be
import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { isTicked, openApp } from '../../../harness/preview';

const ROUTE = '/pod-preferences';
const WORLD = 'member adding interests';
const TIMEOUT_MS = 15_000;

/** The whole visible text of the page, with whitespace collapsed, so text composed from parts can be read as one. */
async function screenText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/\s+/g, ' ').trim();
}

/** Waits until the page's visible text contains the given text, and fails with what it shows otherwise. */
async function waitForText(page: Page, wanted: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let last = '';
  while (Date.now() < deadline) {
    last = await screenText(page);
    if (last.includes(wanted)) {
      return;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Expected the screen to show "${wanted}", but it shows: ${last.slice(0, 600)}`);
}

/** Waits for the step's title, which shows once the profile has loaded. */
async function waitForStep(page: Page, title: string): Promise<void> {
  await page.getByText(title, { exact: true }).first().waitFor({ state: 'visible', timeout: TIMEOUT_MS });
}

describe('PreferencesStep', () => {
  test("The step starts from the profile's preferences", async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await waitForStep(page, 'Who would you like to meet?');

    await waitForText(page, 'Step 5 of 6');
    await page.getByText('Ages', { exact: true }).first().waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await waitForText(page, '28–42');

    const distances = page.getByRole('radiogroup', { name: 'How far would you travel?' });
    const tenKm = distances.getByRole('radio', { name: 'about 10 km', exact: true });
    await tenKm.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    expect(await isTicked(tenKm)).toBe(true);

    for (const language of ['Danish', 'English']) {
      const box = page.getByRole('checkbox', { name: language, exact: true });
      await box.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
      expect(await isTicked(box)).toBe(true);
    }

    for (const time of ['Weekdays, evening', 'Saturday, daytime', 'Sunday, daytime']) {
      const box = page.getByRole('checkbox', { name: time, exact: true });
      await box.waitFor({ state: 'visible', timeout: TIMEOUT_MS });
      expect(await isTicked(box)).toBe(true);
    }

    const sameGender = page.getByRole('switch', { name: 'Same-gender pods only' });
    await sameGender.first().waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    expect(await sameGender.count()).toBeGreaterThan(0);

    expect(await page.getByText('Open to meeting anyone').count()).toBe(0);
    expect(await page.getByRole('switch', { name: 'Open to meeting anyone' }).count()).toBe(0);

    await app.saveScreen('the-step-starts-from-the-profile-s-preferences.png');
  });

  test('Continue saves and opens step 6', async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await waitForStep(page, 'Who would you like to meet?');

    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await page.getByText('Almost done').first().waitFor({ state: 'visible', timeout: TIMEOUT_MS });
    await waitForText(page, 'Step 6 of 6');
    expect(await screenText(page)).toContain('Almost done');

    await app.saveScreen('continue-saves-and-opens-step-6.png');
  });

  test('A language is needed', async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await waitForStep(page, 'Who would you like to meet?');

    for (const language of ['Danish', 'English']) {
      const box = page.getByRole('checkbox', { name: language, exact: true });
      await box.click();
      expect(await isTicked(box)).toBe(false);
    }

    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await waitForText(page, 'Pick at least one language.');
    await page.waitForTimeout(500);
    expect(await page.getByText('Who would you like to meet?', { exact: true }).first().isVisible()).toBe(true);
    expect(await screenText(page)).toContain('Step 5 of 6');

    await app.saveScreen('a-language-is-needed.png');
  });

  test('A free time is needed', async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await waitForStep(page, 'Who would you like to meet?');

    for (const time of ['Weekdays, evening', 'Saturday, daytime', 'Sunday, daytime']) {
      const box = page.getByRole('checkbox', { name: time, exact: true });
      await box.click();
      expect(await isTicked(box)).toBe(false);
    }

    await page.getByRole('button', { name: 'Continue', exact: true }).click();

    await waitForText(page, 'Pick at least one time.');
    await page.waitForTimeout(500);
    expect(await page.getByText('Who would you like to meet?', { exact: true }).first().isVisible()).toBe(true);
    expect(await screenText(page)).toContain('Step 5 of 6');

    await app.saveScreen('a-free-time-is-needed.png');
  });

  test('The step in Danish', async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    await waitForStep(page, 'Hvem vil du gerne møde?');

    await waitForText(page, 'Trin 5 af 6');
    const text = await screenText(page);
    expect(text).toContain('Alder');
    expect(text).toContain('Hvor langt vil du rejse for at mødes?');
    expect(text).toContain('Sprog til møderne');
    expect(text).toContain('Hvornår har du typisk tid?');

    await app.saveScreen('the-step-in-danish.png');
  });
});
