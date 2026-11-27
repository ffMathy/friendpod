// ail-derived-from: YourAreaCard@7a3399cd6afdb09c
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { isTicked, openApp } from '../../../../harness/preview';

const TIMEOUT = 240_000;

type Locale = 'en' | 'da';

const ABOUT_TITLE: Record<Locale, string> = { en: 'About you', da: 'Om dig' };
const AREA_TITLE: Record<Locale, string> = { en: 'Where do you live?', da: 'Hvor bor du?' };
const CONTINUE: Record<Locale, RegExp> = { en: /^Continue$/, da: /^Fortsæt$/ };

/** Waits until the locator's whole text contains every one of the given texts, and returns that text. */
async function waitForText(locator: Locator, parts: string[], timeoutMs = 15_000): Promise<string> {
  const end = Date.now() + timeoutMs;
  let text = '';
  while (Date.now() < end) {
    text = (await locator.textContent()) ?? '';
    if (parts.every((p) => text.includes(p))) return text;
    await new Promise((r) => setTimeout(r, 200));
  }
  return text;
}

/** Fills About you with Emil's details and continues to Where do you live?. */
async function continueFromAboutYou(page: Page, locale: Locale): Promise<void> {
  await page.getByText(ABOUT_TITLE[locale], { exact: true }).first().waitFor();
  if (locale === 'en') {
    await page.getByLabel('First name', { exact: true }).fill('Emil');
    await page.getByLabel('Date of birth, Day', { exact: true }).fill('14');
    await page.getByLabel('Date of birth, Month', { exact: true }).fill('3');
    await page.getByLabel('Date of birth, Year', { exact: true }).fill('1991');
  } else {
    const boxes = page.getByRole('textbox');
    await boxes.nth(0).fill('Emil');
    await boxes.nth(1).fill('14');
    await boxes.nth(2).fill('3');
    await boxes.nth(3).fill('1991');
  }
  const terms =
    locale === 'en' ? page.getByRole('checkbox', { name: 'I accept the Terms' }) : page.getByRole('checkbox').first();
  if ((await terms.count()) > 0 && !(await isTicked(terms))) {
    await terms.click();
  }
  await page.getByRole('button', { name: CONTINUE[locale] }).click();
  await page.getByText(AREA_TITLE[locale], { exact: true }).first().waitFor();
}

/** Enters a postcode on Where do you live?. */
async function enterPostcode(page: Page, postcode: string): Promise<void> {
  const field = page.getByRole('textbox', { name: /post/i }).first();
  await field.fill(postcode);
}

test(
  'A postcode in another launch city',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    await continueFromAboutYou(app.page, 'en');
    await enterPostcode(app.page, '5000');

    const card = app.page.getByLabel('Your area', { exact: true }).first();
    await card.waitFor();
    const note =
      'We store only this area, never your address or exact location. Nobody is ever shown how far away you live.';
    const text = await waitForText(card, ['Your area', 'Odense C', 'Odense opens soon', note]);
    expect(text).toContain('Your area');
    expect(text).toContain('Odense C');
    expect(text).toContain('Odense opens soon');
    expect(text).toContain(note);

    await app.saveScreen('a-postcode-in-another-launch-city.png');
  },
  TIMEOUT,
);

test(
  'A postcode outside every launch area',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    await continueFromAboutYou(app.page, 'en');
    await enterPostcode(app.page, '9990');

    const card = app.page.getByLabel('Your area', { exact: true }).first();
    await card.waitFor();
    const hint = "You can still sign up; we'll tell you when we open near you.";
    const note =
      'We store only this area, never your address or exact location. Nobody is ever shown how far away you live.';
    const text = await waitForText(card, ['Skagen', 'Not open here yet', hint, note]);
    expect(text).toContain('Skagen');
    expect(text).toContain('Not open here yet');
    expect(text).toContain(hint);
    expect(text).toContain(note);
    expect(text.indexOf(hint)).toBeLessThan(text.indexOf(note));

    await app.saveScreen('a-postcode-outside-every-launch-area.png');
  },
  TIMEOUT,
);

test(
  'The card in Danish',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
    await continueFromAboutYou(app.page, 'da');
    await enterPostcode(app.page, '2100');

    const card = app.page.getByLabel('Dit område', { exact: true }).first();
    await card.waitFor();
    const text = await waitForText(card, ['Dit område', 'København Ø', 'København åbner snart']);
    expect(text).toContain('Dit område');
    expect(text).toContain('København Ø');
    expect(text).toContain('København åbner snart');

    await app.saveScreen('the-card-in-danish.png');
  },
  TIMEOUT,
);
