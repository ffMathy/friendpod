// ail-derived-from: FinalStep@fa7cd2d64a47f5a7
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../harness/preview';

const ROUTE = '/almost-done';
const WORLD = 'member on the last onboarding step';
const PLEDGE =
  "I'll meet in public places, treat people with respect, and use Report if something feels wrong.";

test('Finish waits for the safety pledge', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;

  await page.getByText('Almost done', { exact: true }).first().waitFor();
  const body = await page.locator('body').innerText();
  expect(body).toContain('Step 6 of 6');
  expect(body).toContain('Almost done');

  const pledge = page.getByRole('checkbox', { name: PLEDGE });
  await pledge.waitFor();
  expect(await isTicked(pledge)).toBe(false);

  const finish = page.getByRole('button', { name: 'Finish', exact: true });
  expect(await finish.isDisabled()).toBe(true);

  await pledge.click();
  await page.waitForFunction(
    () => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
      const b = buttons.find((el) => (el.textContent ?? '').trim() === 'Finish');
      if (b === undefined) return false;
      return b.getAttribute('aria-disabled') !== 'true' && !(b as HTMLButtonElement).disabled;
    },
    undefined,
    { timeout: 5000 },
  ).catch(() => undefined);
  expect(await finish.isDisabled()).toBe(false);

  await app.saveScreen('finish-waits-for-the-safety-pledge.png');
});

test('Finishing opens Home', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;

  await page.getByText('Almost done', { exact: true }).first().waitFor();
  const pledge = page.getByRole('checkbox', { name: PLEDGE });
  await pledge.waitFor();
  await pledge.click();

  const finish = page.getByRole('button', { name: 'Finish', exact: true });
  await finish.click();

  await page.getByText('This week', { exact: true }).first().waitFor({ timeout: 15000 });
  await page.getByRole('checkbox', { name: PLEDGE }).waitFor({ state: 'detached', timeout: 15000 });
  expect(page.url()).not.toContain('almost-done');
  expect(await page.getByText('This week', { exact: true }).first().isVisible()).toBe(true);

  await app.saveScreen('finishing-opens-home.png');
});

test('The step in Danish', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
  const page = app.page;

  await page.getByText('Næsten færdig', { exact: true }).first().waitFor();
  const body = await page.locator('body').innerText();
  expect(body).toContain('Næsten færdig');
  expect(body).toContain('Trin 6 af 6');

  const finish = page.getByRole('button', { name: 'Færdig', exact: true });
  await finish.waitFor();
  expect(await finish.isDisabled()).toBe(true);

  await app.saveScreen('the-step-in-danish.png');
});
