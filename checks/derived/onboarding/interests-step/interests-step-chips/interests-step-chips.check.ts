// ail-derived-from: InterestsStepChips@121f1cd52af142bd
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/interests';
const WORLD = 'member adding interests';
const TIMEOUT = 180_000;

test(
  'Tapping a private interest offers to make it ordinary',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const chip = page.getByRole('button', { name: 'gravid, private', exact: true });
    await chip.waitFor({ state: 'visible' });
    await chip.click();

    const question = page.getByText(
      '“gravid” is private and only used as a pod\'s theme. If it isn\'t sensitive for you, make it an ordinary interest.',
      { exact: true },
    );
    await question.waitFor({ state: 'visible' });
    expect(await question.isVisible()).toBe(true);

    const action = page.getByText('This isn\'t sensitive for me', { exact: true });
    await action.waitFor({ state: 'visible' });
    expect(await action.isVisible()).toBe(true);

    await app.saveScreen('tapping-a-private-interest-offers-to-make-it-ordinary.png');
  },
  TIMEOUT,
);

test(
  'Tapping an ordinary interest offers to keep it private',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const chip = page.getByRole('button', { name: 'brætspil', exact: true });
    await chip.waitFor({ state: 'visible' });
    await chip.click();

    const question = page.getByText(
      'Does “brætspil” say something sensitive about you? Keep it private and it\'s only used as a pod\'s theme.',
      { exact: true },
    );
    await question.waitFor({ state: 'visible' });
    expect(await question.isVisible()).toBe(true);

    const action = page.getByText('Keep this private', { exact: true });
    await action.waitFor({ state: 'visible' });
    expect(await action.isVisible()).toBe(true);

    await app.saveScreen('tapping-an-ordinary-interest-offers-to-keep-it-private.png');
  },
  TIMEOUT,
);

test(
  'The nudge stays until five interests',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const nudge = page.getByText('Add at least 3. 5 or more gives better pods.', { exact: true });
    await nudge.waitFor({ state: 'visible' });
    expect(await nudge.isVisible()).toBe(true);

    const field = page.getByRole('textbox').first();
    await field.fill('kayak');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await page.getByRole('button', { name: 'kayak', exact: true }).waitFor({ state: 'visible' });
    await nudge.waitFor({ state: 'hidden' });
    expect(await nudge.count()).toBe(0);

    await app.saveScreen('the-nudge-stays-until-five-interests.png');
  },
  TIMEOUT,
);

test(
  'The chips in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    const hint = page.getByText('Tryk på en interesse for at ændre, om den er privat.', { exact: true });
    await hint.waitFor({ state: 'visible' });
    expect(await hint.isVisible()).toBe(true);

    const chip = page.getByRole('button', { name: 'gravid, privat', exact: true });
    await chip.waitFor({ state: 'visible' });
    await chip.click();

    const action = page.getByText('Den er ikke følsom for mig', { exact: true });
    await action.waitFor({ state: 'visible' });
    expect(await action.isVisible()).toBe(true);

    await app.saveScreen('the-chips-in-danish.png');
  },
  TIMEOUT,
);
