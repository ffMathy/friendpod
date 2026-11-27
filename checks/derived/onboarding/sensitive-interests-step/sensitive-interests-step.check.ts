// ail-derived-from: SensitiveInterestsStep@f0bcea13cfe78ab3
import { test, expect } from 'bun:test';

import { openApp, isTicked } from '../../../harness/preview.ts';

const ROUTE = '/sensitive-consent';
const WORLD = 'member choosing about private interests';
const TICK_TEXT =
  'I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, ' +
  'for the purposes above.';
const TIMEOUT = 180_000;

test(
  'The consent starts unticked and I agree waits',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    await page.getByText('Step 3 of 6').first().waitFor();
    await page.getByText('Private interests', { exact: true }).first().waitFor();
    await page.getByText('Sensitive interests', { exact: true }).first().waitFor();
    expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);

    const box = page.getByRole('checkbox', { name: TICK_TEXT });
    await box.waitFor();
    expect(await isTicked(box)).toBe(false);

    const agree = page.getByRole('button', { name: 'I agree', exact: true });
    const notNow = page.getByRole('button', { name: 'Not now', exact: true });
    await agree.waitFor();
    await notNow.waitFor();
    expect(await agree.isDisabled()).toBe(true);
    expect(await notNow.isDisabled()).toBe(false);

    await app.saveScreen('the-consent-starts-unticked-and-i-agree-waits.png');
  },
  TIMEOUT,
);

test(
  'I agree gives the consent and opens the interests',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const box = page.getByRole('checkbox', { name: TICK_TEXT });
    await box.waitFor();
    await box.click();

    const agree = page.getByRole('button', { name: 'I agree', exact: true });
    await agree.waitFor();
    expect(await agree.isDisabled()).toBe(false);

    await agree.click();

    await page.getByText('What are you into?').first().waitFor();
    await page.getByText('Step 4 of 6').first().waitFor();

    await app.saveScreen('i-agree-gives-the-consent-and-opens-the-interests.png');
  },
  TIMEOUT,
);

test(
  'Not now carries on without the consent',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const notNow = page.getByRole('button', { name: 'Not now', exact: true });
    await notNow.waitFor();
    await notNow.click();

    await page.getByText('What are you into?').first().waitFor();

    await app.saveScreen('not-now-carries-on-without-the-consent.png');
  },
  TIMEOUT,
);

test(
  'Asked for from the interests, it returns there',
  async () => {
    // Given: on step 3, carry on to What are you into? without the consent.
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    const page = app.page;

    const notNowFirst = page.getByRole('button', { name: 'Not now', exact: true });
    await notNowFirst.waitFor();
    await notNowFirst.click();
    await page.getByText('What are you into?').first().waitFor();

    // Given: the interest diabetes was refused as sensitive.
    const field = page.getByRole('textbox').first();
    await field.waitFor();
    await field.fill('diabetes');
    await field.press('Enter');
    const giveConsent = page.getByRole('button', { name: 'Sensitive interests: give consent' });
    const shown = await giveConsent
      .first()
      .waitFor({ timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!shown) {
      await page.getByRole('button', { name: /^add/i }).first().click();
      await giveConsent.first().waitFor();
    }

    // When they press Sensitive interests: give consent
    await giveConsent.first().click();

    // Then the private-interests step opens, with Back
    await page.getByRole('checkbox', { name: TICK_TEXT }).waitFor();
    await page.getByRole('button', { name: 'Back', exact: true }).first().waitFor();

    // When they press Not now
    await page.getByRole('button', { name: 'Not now', exact: true }).click();

    // Then What are you into? shows again, still saying the interest may be sensitive
    await page.getByText('What are you into?').first().waitFor();
    await page.getByText('diabetes').first().waitFor();
    await page.getByRole('button', { name: 'Sensitive interests: give consent' }).first().waitFor();
    expect(await page.getByRole('checkbox', { name: TICK_TEXT }).count()).toBe(0);

    await app.saveScreen('asked-for-from-the-interests-it-returns-there.png');
  },
  TIMEOUT,
);

test(
  'The step in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    const page = app.page;

    await page.getByText('Trin 3 af 6').first().waitFor();
    await page.getByText('Følsomme interesser', { exact: true }).first().waitFor();

    const agree = page.getByRole('button', { name: 'Jeg siger ja', exact: true });
    const notNow = page.getByRole('button', { name: 'Ikke nu', exact: true });
    await agree.waitFor();
    await notNow.waitFor();
    expect(await agree.isDisabled()).toBe(true);
    expect(await notNow.isDisabled()).toBe(false);

    await app.saveScreen('the-step-in-danish.png');
  },
  TIMEOUT,
);
