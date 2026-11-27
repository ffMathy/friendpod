// ail-derived-from: GivePrivateInterestConsent@20fd20e731a979b3
import { expect, test } from 'bun:test';
import { isTicked, openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

const TICK_EN =
  'I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, ' +
  'for the purposes above.';
const TICK_DA =
  'Jeg giver udtrykkeligt samtykke til, at Friendpod behandler interesser, der kan afsløre følsomme oplysninger ' +
  'om mig, til de formål, der er beskrevet ovenfor.';

const PRIVACY_URL = /\/settings\/privacy(\?.*)?$/;

test(
  'The consent starts unticked and I agree waits',
  async () => {
    await using app = await openApp({
      route: '/settings/sensitive-consent',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;
    const box = page.getByRole('checkbox', { name: TICK_EN });
    await box.waitFor();
    const agree = page.getByRole('button', { name: 'I agree', exact: true });
    const notNow = page.getByRole('button', { name: 'Not now', exact: true });

    expect(await isTicked(box)).toBe(false);
    expect(await agree.isDisabled()).toBe(true);
    expect(await notNow.isDisabled()).toBe(false);

    await app.saveScreen('the-consent-starts-unticked-and-i-agree-waits.png');
  },
  TIMEOUT,
);

test(
  'Agreeing returns to Privacy',
  async () => {
    await using app = await openApp({
      route: '/settings/privacy',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;
    const row = page.getByRole('link', { name: /Private interests/ }).first();
    await row.waitFor();
    await row.click();

    const box = page.getByRole('checkbox', { name: TICK_EN });
    await box.waitFor();
    await box.click();

    const agree = page.getByRole('button', { name: 'I agree', exact: true });
    expect(await agree.isDisabled()).toBe(false);

    await agree.click();
    await page.waitForURL(PRIVACY_URL);
    await page.getByRole('link', { name: /Private interests/ }).first().waitFor();
    expect(PRIVACY_URL.test(page.url())).toBe(true);

    await app.saveScreen('agreeing-returns-to-privacy.png');
  },
  TIMEOUT,
);

test(
  'Not now returns to Privacy with nothing given',
  async () => {
    await using app = await openApp({
      route: '/settings/privacy',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;
    const row = page.getByRole('link', { name: /Private interests/ }).first();
    await row.waitFor();
    await row.click();

    const notNow = page.getByRole('button', { name: 'Not now', exact: true });
    await notNow.waitFor();
    await notNow.click();

    await page.waitForURL(PRIVACY_URL);
    const rowAgain = page.getByRole('link', { name: /Private interests/ }).first();
    await rowAgain.waitFor();
    expect(PRIVACY_URL.test(page.url())).toBe(true);
    const rowText = (await rowAgain.textContent()) ?? '';
    expect(rowText).toContain('Not given');

    await app.saveScreen('not-now-returns-to-privacy-with-nothing-given.png');
  },
  TIMEOUT,
);

test(
  'Back with no earlier screen opens Privacy',
  async () => {
    await using app = await openApp({
      route: '/settings/sensitive-consent',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;
    const back = page.getByRole('button', { name: 'Back', exact: true });
    await back.waitFor();
    await back.click();

    await page.waitForURL(PRIVACY_URL);
    await page.getByRole('link', { name: /Private interests/ }).first().waitFor();
    expect(PRIVACY_URL.test(page.url())).toBe(true);

    await app.saveScreen('back-with-no-earlier-screen-opens-privacy.png');
  },
  TIMEOUT,
);

test(
  'Giving consent in Danish',
  async () => {
    await using app = await openApp({
      route: '/settings/sensitive-consent',
      world: 'member without private-interest consent',
      locale: 'da',
    });
    const page = app.page;
    const box = page.getByRole('checkbox', { name: TICK_DA });
    await box.waitFor();
    const agree = page.getByRole('button', { name: 'Jeg siger ja', exact: true });
    const notNow = page.getByRole('button', { name: 'Ikke nu', exact: true });

    expect(await agree.isDisabled()).toBe(true);
    expect(await notNow.isDisabled()).toBe(false);

    await box.click();
    expect(await agree.isDisabled()).toBe(false);

    await app.saveScreen('giving-consent-in-danish.png');
  },
  TIMEOUT,
);
