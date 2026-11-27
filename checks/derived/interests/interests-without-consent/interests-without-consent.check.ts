// ail-derived-from: InterestsWithoutConsent@7b2184d078643403
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const WORLD = 'member without private-interest consent';
const ROUTE = '/interests';
const TIMEOUT = 180_000;

const EN = {
  cardTitle: 'Private interests',
  offBadge: 'Off',
  giveConsent: 'Agree to sensitive interests',
  openSensitiveConsent: 'Sensitive interests: give consent',
  refusal:
    "This interest may be sensitive, so we only save it if you've agreed to sensitive interests. " +
    'Nothing was sent or saved. You can give consent in Settings → Privacy.',
  notice:
    'Tip: interests that say something about your health, beliefs, sexuality, politics, ethnic origin or union ' +
    'membership are only saved if you have agreed to sensitive interests (Settings → Privacy). We then keep them ' +
    "private and use them only as a pod's theme. Only add things about yourself.",
  add: 'Add',
};

const DA = {
  cardTitle: 'Private interesser',
  offBadge: 'Slået fra',
  giveConsent: 'Sig ja til følsomme interesser',
  refusal:
    'Interessen kan være følsom, så vi gemmer den kun, hvis du har sagt ja til følsomme interesser. ' +
    'Intet blev sendt eller gemt. Du kan give samtykke under Indstillinger → Privatliv.',
  add: 'Tilføj',
};

const CONSENT_URL = /\/settings\/sensitive-consent(\?|#|$)/;

/** The innermost element holding both the private card's title and its Off badge: the Off card. */
function offCard(page: Page, title: string, badge: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByText(badge, { exact: true }) })
    .last();
}

/** A pressable found by its accessible name, whether it is exposed as a link or as a button. */
function pressable(scope: Page | Locator, name: string): Locator {
  return scope
    .getByRole('link', { name, exact: true })
    .or(scope.getByRole('button', { name, exact: true }))
    .first();
}

/** The add row's field on the Interests tab. */
function interestField(page: Page): Locator {
  return page.getByRole('textbox').first();
}

async function addInterest(page: Page, text: string, addLabel: string): Promise<void> {
  const field = interestField(page);
  await field.waitFor({ state: 'visible' });
  await field.fill(text);
  await page.getByRole('button', { name: addLabel, exact: true }).first().click();
}

async function normalizedText(locator: Locator): Promise<string> {
  const text = (await locator.textContent()) ?? '';
  return text.replace(/\s+/g, ' ').trim();
}

async function bodyText(page: Page): Promise<string> {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ');
}

test(
  'The private card is Off',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const card = offCard(page, EN.cardTitle, EN.offBadge);
    await card.waitFor({ state: 'visible' });
    await card.getByText(EN.offBadge, { exact: true }).waitFor({ state: 'visible' });

    const text = await normalizedText(card);
    expect(text).toContain(EN.notice);
    await pressable(card, EN.giveConsent).waitFor({ state: 'visible' });
    expect(text.endsWith(EN.giveConsent)).toBe(true);

    expect(await page.getByText('How private interests work').count()).toBe(0);

    await app.saveScreen('the-private-card-is-off.png');
  },
  TIMEOUT,
);

test(
  'A sensitive interest is refused on the phone',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await interestField(page).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.body.innerText.replace(/\s+/g, ' ').includes('4 of 20'));

    await addInterest(page, 'gravid', EN.add);

    await page.getByText(EN.refusal, { exact: true }).waitFor({ state: 'visible' });
    await pressable(page, EN.openSensitiveConsent).waitFor({ state: 'visible' });

    expect(await interestField(page).inputValue()).toBe('gravid');
    expect(await bodyText(page)).toContain('4 of 20');

    await app.saveScreen('a-sensitive-interest-is-refused-on-the-phone.png');
  },
  TIMEOUT,
);

test(
  'Keep this private is refused without the consent',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const moreButtonName = { name: 'More', exact: true } as const;
    const more = page
      .getByRole('button', { name: /^More\b.*sourdough/i })
      .or(
        page
          .locator('div')
          .filter({ hasText: 'sourdough' })
          .filter({ has: page.getByRole('button', moreButtonName) })
          .last()
          .getByRole('button', moreButtonName),
      )
      .first();
    await more.waitFor({ state: 'visible' });
    await more.click();

    const keepPrivate = page
      .getByRole('button', { name: 'Keep this private', exact: true })
      .or(page.getByRole('menuitem', { name: 'Keep this private', exact: true }))
      .first();
    await keepPrivate.waitFor({ state: 'visible' });
    await keepPrivate.click();

    await page.getByText(EN.refusal, { exact: true }).waitFor({ state: 'visible' });

    await page.getByText('sourdough', { exact: true }).first().waitFor({ state: 'visible' });
    const card = offCard(page, EN.cardTitle, EN.offBadge);
    if ((await card.count()) > 0) {
      expect(await normalizedText(card)).not.toContain('sourdough');
    }
    const privateCards = page
      .locator('div')
      .filter({ has: page.getByText(EN.cardTitle, { exact: true }) })
      .filter({ has: page.getByText('sourdough', { exact: true }) })
      .filter({ hasNot: page.getByText('Interests', { exact: true }) });
    expect(await privateCards.count()).toBe(0);

    await app.saveScreen('keep-this-private-is-refused-without-the-consent.png');
  },
  TIMEOUT,
);

test(
  'The refusal leads to the consent',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await addInterest(page, 'gravid', EN.add);
    await page.getByText(EN.refusal, { exact: true }).waitFor({ state: 'visible' });

    await pressable(page, EN.openSensitiveConsent).click();
    await page.waitForURL(CONSENT_URL);
    expect(new URL(page.url()).pathname).toBe('/settings/sensitive-consent');

    await app.saveScreen('the-refusal-leads-to-the-consent.png');
  },
  TIMEOUT,
);

test(
  'Agree to sensitive interests leads to the consent',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const card = offCard(page, EN.cardTitle, EN.offBadge);
    await card.waitFor({ state: 'visible' });
    await pressable(card, EN.giveConsent).click();

    await page.waitForURL(CONSENT_URL);
    expect(new URL(page.url()).pathname).toBe('/settings/sensitive-consent');

    await app.saveScreen('agree-to-sensitive-interests-leads-to-the-consent.png');
  },
  TIMEOUT,
);

test(
  'Without consent in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    const card = offCard(page, DA.cardTitle, DA.offBadge);
    await card.waitFor({ state: 'visible' });
    await card.getByText(DA.offBadge, { exact: true }).waitFor({ state: 'visible' });
    await pressable(card, DA.giveConsent).waitFor({ state: 'visible' });
    expect((await normalizedText(card)).endsWith(DA.giveConsent)).toBe(true);

    await addInterest(page, 'gravid', DA.add);
    await page.getByText(DA.refusal, { exact: true }).waitFor({ state: 'visible' });

    await app.saveScreen('without-consent-in-danish.png');
  },
  TIMEOUT,
);
