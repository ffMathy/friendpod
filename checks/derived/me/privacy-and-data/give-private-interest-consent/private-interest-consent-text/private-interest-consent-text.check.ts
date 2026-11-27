// ail-derived-from: PrivateInterestConsentText@fe1869a23f68347d
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../../harness/preview';

const ROUTE = '/settings/sensitive-consent';
const WORLD = 'member without private-interest consent';
const TIMEOUT = 300_000;

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const topOf = async (locator: Locator): Promise<number> => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
};

/** The innermost element that holds both the start and the end of the consent text. */
const consentBox = (page: Page, start: string, end: string): Locator =>
  page.locator('div').filter({ hasText: start }).filter({ hasText: end }).last();

test(
  'The consent text is shown word for word',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const intro = 'Some interests can reveal your health, religion or beliefs';
    const withdraw =
      'You can withdraw your consent at any time in Settings → Privacy. We then delete all your sensitive interests at ' +
      'once and take you out of pods built around them. Your other interests are not affected.';
    const readMore = 'Read more about sensitive interests';

    const eyebrow = page.getByText(/^\s*private interests\s*$/i).first();
    const title = page.getByText('Sensitive interests', { exact: true }).first();
    await eyebrow.waitFor({ state: 'visible' });
    await title.waitFor({ state: 'visible' });
    expect(await topOf(eyebrow)).toBeLessThan(await topOf(title));

    const box = consentBox(page, intro, withdraw);
    await box.waitFor({ state: 'attached' });
    const boxText = normalize((await box.textContent()) ?? '');
    expect(boxText.startsWith(intro)).toBe(true);
    const withoutLink = normalize(boxText.replace(new RegExp(`${escapeRegExp(readMore)}\\s*$`), ''));
    expect(withoutLink.endsWith(withdraw)).toBe(true);

    const link = page.getByRole('link', { name: readMore });
    await link.waitFor({ state: 'attached' });
    const withdrawStart = page.getByText(/You can withdraw your consent at any time/).last();
    expect(await topOf(withdrawStart)).toBeLessThan(await topOf(link));

    await app.saveScreen('the-consent-text-is-shown-word-for-word.png');
  },
  TIMEOUT,
);

test(
  'Read more opens the page on private interests',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const link = page.getByRole('link', { name: 'Read more about sensitive interests' });
    await link.waitFor({ state: 'attached' });
    await link.scrollIntoViewIfNeeded();
    await link.click();

    const lede = 'Some interests say more about you than others. This is how we look after them.';
    await page.waitForFunction(
      (expected: string) => (document.body.textContent ?? '').replace(/\s+/g, ' ').includes(expected),
      lede,
    );
    await page.getByText(/^\s*private interests\s*$/i).first().waitFor({ state: 'visible' });
    expect(normalize((await page.locator('body').textContent()) ?? '')).toContain(lede);

    await app.saveScreen('read-more-opens-the-page-on-private-interests.png');
  },
  TIMEOUT,
);

test(
  'The consent text in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    const intro = 'Nogle interesser kan afsløre noget om dit helbred';
    const readMore = 'Læs mere om følsomme interesser';

    const eyebrow = page.getByText(/^\s*private interesser\s*$/i).first();
    const title = page.getByText('Følsomme interesser', { exact: true }).first();
    await eyebrow.waitFor({ state: 'visible' });
    await title.waitFor({ state: 'visible' });
    expect(await topOf(eyebrow)).toBeLessThan(await topOf(title));

    const introText = page.getByText(new RegExp(`^\\s*${escapeRegExp(intro)}`)).last();
    await introText.waitFor({ state: 'attached' });
    const box = page.locator('div').filter({ hasText: intro }).filter({ hasText: /Vær opmærksom på:/ }).last();
    await box.waitFor({ state: 'attached' });
    expect(normalize((await box.textContent()) ?? '').startsWith(intro)).toBe(true);

    const link = page.getByRole('link', { name: readMore });
    await link.waitFor({ state: 'attached' });
    expect(await topOf(introText)).toBeLessThan(await topOf(link));

    await app.saveScreen('the-consent-text-in-danish.png');
  },
  TIMEOUT,
);
