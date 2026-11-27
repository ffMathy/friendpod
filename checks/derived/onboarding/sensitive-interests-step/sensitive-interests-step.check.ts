// ail-derived-from: SensitiveInterestsStep@faf8e832d7783fa4
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

const TICK_TEXT =
  'I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, ' +
  'for the purposes above.';

test(
  'The consent starts unticked and I agree waits',
  async () => {
    await using app = await openApp({
      route: '/sensitive-consent',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    const page = app.page;

    await page.getByText('Step 3 of 6', { exact: false }).first().waitFor();
    await page.getByText('Private interests', { exact: true }).first().waitFor();
    await page.getByText('Sensitive interests', { exact: true }).first().waitFor();
    expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);

    const box = page.getByRole('checkbox', { name: TICK_TEXT });
    await box.waitFor();
    expect(await isTicked(box)).toBe(false);

    const agree = page.getByRole('button', { name: 'I agree', exact: true });
    const notNow = page.getByRole('button', { name: 'Not now', exact: true });
    expect(await agree.isDisabled()).toBe(true);
    expect(await notNow.isDisabled()).toBe(false);

    await app.saveScreen('the-consent-starts-unticked-and-i-agree-waits.png');
  },
  TIMEOUT,
);

test(
  'I agree gives the consent and opens the interests',
  async () => {
    await using app = await openApp({
      route: '/sensitive-consent',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    const page = app.page;

    const box = page.getByRole('checkbox', { name: TICK_TEXT });
    await box.waitFor();
    await box.click();

    const agree = page.getByRole('button', { name: 'I agree', exact: true });
    await expect.poll(async () => await agree.isDisabled()).toBe(false);

    await agree.click();

    await page.getByText('What are you into?', { exact: true }).first().waitFor();
    await page.getByText('Step 4 of 6', { exact: false }).first().waitFor();

    await app.saveScreen('i-agree-gives-the-consent-and-opens-the-interests.png');
  },
  TIMEOUT,
);

test(
  'Not now carries on without the consent',
  async () => {
    await using app = await openApp({
      route: '/sensitive-consent',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    const page = app.page;

    const notNow = page.getByRole('button', { name: 'Not now', exact: true });
    await notNow.waitFor();
    await notNow.click();

    await page.getByText('What are you into?', { exact: true }).first().waitFor();

    await app.saveScreen('not-now-carries-on-without-the-consent.png');
  },
  TIMEOUT,
);

test(
  'Asked for from the interests, it returns there',
  async () => {
    await using app = await openApp({
      route: '/add-interests',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    const page = app.page;

    await page.getByText('What are you into?', { exact: true }).first().waitFor();

    // The interest diabetes is entered and refused as sensitive.
    const field = page.getByRole('textbox').first();
    await field.waitFor();
    await field.fill('diabetes');
    await field.press('Enter');

    const giveConsent = page.getByRole('button', { name: 'Sensitive interests: give consent', exact: true });
    await giveConsent.waitFor();
    await giveConsent.click();

    const box = page.getByRole('checkbox', { name: TICK_TEXT });
    await box.waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).first().waitFor();

    const notNow = page.getByRole('button', { name: 'Not now', exact: true });
    await notNow.click();

    await page.getByText('What are you into?', { exact: true }).first().waitFor();
    await page.getByText(/may be sensitive/i).first().waitFor();

    await app.saveScreen('asked-for-from-the-interests-it-returns-there.png');
  },
  TIMEOUT,
);

test(
  'The step in Danish',
  async () => {
    await using app = await openApp({
      route: '/sensitive-consent',
      world: 'member choosing about private interests',
      locale: 'da',
    });
    const page = app.page;

    await page.getByText('Trin 3 af 6', { exact: false }).first().waitFor();
    await page.getByText('Følsomme interesser', { exact: true }).first().waitFor();

    const agree = page.getByRole('button', { name: 'Jeg siger ja', exact: true });
    const notNow = page.getByRole('button', { name: 'Ikke nu', exact: true });
    await agree.waitFor();
    expect(await agree.isDisabled()).toBe(true);
    expect(await notNow.isDisabled()).toBe(false);

    await app.saveScreen('the-step-in-danish.png');
  },
  TIMEOUT,
);
