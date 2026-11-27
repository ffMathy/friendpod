// ail-derived-from: InterestsStepChips@1fc4edaab38932e6
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

/** The options card's action: an underlined link, found by its name whether it is exposed as a link or a button. */
function action(page: Page, name: string): Locator {
  return page
    .getByRole('link', { name, exact: true })
    .or(page.getByRole('button', { name, exact: true }))
    .first();
}

test(
  'Tapping a private interest offers to make it ordinary',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
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

    const offer = action(page, 'This isn\'t sensitive for me');
    await offer.waitFor({ state: 'visible' });
    expect(await offer.isVisible()).toBe(true);

    await app.saveScreen('tapping-a-private-interest-offers-to-make-it-ordinary.png');
  },
  TIMEOUT,
);

test(
  'Tapping an ordinary interest offers to keep it private',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
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

    const offer = action(page, 'Keep this private');
    await offer.waitFor({ state: 'visible' });
    expect(await offer.isVisible()).toBe(true);

    await app.saveScreen('tapping-an-ordinary-interest-offers-to-keep-it-private.png');
  },
  TIMEOUT,
);

test(
  'The nudge stays until five interests',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
    const page = app.page;

    // The world's member has four interests: three ordinary ones and the private gravid.
    const removeButtons = page.getByRole('button', { name: /^Remove / });
    await removeButtons.first().waitFor({ state: 'visible' });
    expect(await removeButtons.count()).toBe(4);

    const nudge = page.getByText('Add at least 3. 5 or more gives better pods.', { exact: true });
    await nudge.waitFor({ state: 'visible' });
    expect(await nudge.isVisible()).toBe(true);

    const field = page.getByRole('textbox').first();
    await field.fill('kayak');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await page.getByRole('button', { name: 'Remove kayak', exact: true }).waitFor({ state: 'visible' });
    await nudge.waitFor({ state: 'hidden' });
    expect(await nudge.count()).toBe(0);

    await app.saveScreen('the-nudge-stays-until-five-interests.png');
  },
  TIMEOUT,
);

test(
  'The chips in Danish',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'da' });
    const page = app.page;

    const hint = page.getByText('Tryk på en interesse for at ændre, om den er privat.', { exact: true });
    await hint.waitFor({ state: 'visible' });
    expect(await hint.isVisible()).toBe(true);

    const chip = page.getByRole('button', { name: 'gravid, privat', exact: true });
    await chip.waitFor({ state: 'visible' });
    await chip.click();

    const offer = action(page, 'Den er ikke følsom for mig');
    await offer.waitFor({ state: 'visible' });
    expect(await offer.isVisible()).toBe(true);

    await app.saveScreen('the-chips-in-danish.png');
  },
  TIMEOUT,
);
