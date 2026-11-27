// ail-derived-from: TermsAcceptance@eb6239a8077f17aa
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../../harness/preview';

const TIMEOUT = 300_000;

test(
  'Continue waits for the Terms',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await page.getByLabel('First name', { exact: true }).fill('Emil');
    await page.getByLabel('Date of birth, Day', { exact: true }).fill('14');
    await page.getByLabel('Date of birth, Month', { exact: true }).fill('03');
    await page.getByLabel('Date of birth, Year', { exact: true }).fill('1991');

    const box = page.getByRole('checkbox', { name: 'I accept the Terms', exact: true });
    await box.click();
    expect(await isTicked(box)).toBe(true);
    await box.click();
    expect(await isTicked(box)).toBe(false);

    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    expect(await continueButton.isDisabled()).toBe(true);

    await app.saveScreen('continue-waits-for-the-terms.png');
  },
  TIMEOUT,
);

test(
  'The Terms link opens the Terms',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await page.getByRole('link', { name: 'Terms', exact: true }).click();
    await page.waitForURL((url) => url.href.includes('terms'), { timeout: 15_000 });
    expect(page.url()).toContain('terms');
    expect(page.url()).not.toContain('privacy');

    await app.saveScreen('the-terms-link-opens-the-terms.png');
  },
  TIMEOUT,
);
