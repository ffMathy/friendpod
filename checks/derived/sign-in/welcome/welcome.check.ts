// ail-derived-from: Welcome@7bae2b57d6883110
import { expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

test(
  'Signing in with Apple leads to onboarding',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    const apple = page.getByRole('button', { name: 'Continue with Apple' });
    await apple.waitFor();
    await apple.click();

    const aboutYou = page.getByText('About you', { exact: true }).first();
    await aboutYou.waitFor();
    expect(await aboutYou.isVisible()).toBe(true);

    const step = page.getByText(/Step 1 of 6/).first();
    await step.waitFor();
    expect(await step.isVisible()).toBe(true);

    await app.saveScreen('signing-in-with-apple-leads-to-onboarding.png');
  },
  TIMEOUT,
);

test(
  'A sign-in that fails says so',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    const google = page.getByRole('button', { name: 'Continue with Google' });
    await google.waitFor();
    await google.click();

    const alert = page.getByRole('alert').filter({ hasText: 'Sign-in didn’t work. Please try again.' }).first();
    await alert.waitFor();
    const message = (await alert.textContent()) ?? '';
    expect(message).toContain('Sign-in didn’t work. Please try again.');

    const googleAgain = page.getByRole('button', { name: 'Continue with Google' });
    await googleAgain.waitFor();
    expect(await googleAgain.isVisible()).toBe(true);
    expect(await googleAgain.isDisabled()).toBe(false);

    await app.saveScreen('a-sign-in-that-fails-says-so.png');
  },
  TIMEOUT,
);

test(
  'Continue with email opens the email step',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    const email = page.getByRole('button', { name: 'Continue with email' });
    await email.waitFor();
    await email.click();

    const title = page.getByText('Sign in with email', { exact: true }).first();
    await title.waitFor();
    expect(await title.isVisible()).toBe(true);

    const field = page.getByLabel('Email address').first();
    await field.waitFor();
    expect(await field.isVisible()).toBe(true);

    await app.saveScreen('continue-with-email-opens-the-email-step.png');
  },
  TIMEOUT,
);

test(
  'A failed sign-in in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'da' });
    const page = app.page;

    const google = page.getByRole('button', { name: 'Fortsæt med Google' });
    await google.waitFor();
    await google.click();

    const alert = page.getByRole('alert').filter({ hasText: 'Det lykkedes ikke at logge ind. Prøv igen.' }).first();
    await alert.waitFor();
    const message = (await alert.textContent()) ?? '';
    expect(message).toContain('Det lykkedes ikke at logge ind. Prøv igen.');

    await app.saveScreen('a-failed-sign-in-in-danish.png');
  },
  TIMEOUT,
);
