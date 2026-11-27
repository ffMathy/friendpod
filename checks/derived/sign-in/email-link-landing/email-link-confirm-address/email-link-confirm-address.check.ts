// ail-derived-from: EmailLinkConfirmAddress@7815a53493aab7b4
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const SIGN_IN_LINK =
  '/auth/complete?link=https%3A%2F%2Ffriendpod-staging.firebaseapp.com%2F__%2Fauth%2Faction%3Fmode%3DsignIn%26oobCode%3Dpreview';
const BROKEN_LINK =
  '/auth/complete?link=https%3A%2F%2Ffriendpod-staging.firebaseapp.com%2F__%2Fauth%2Faction%3Fmode%3DsignIn';

const TIMEOUT = 180_000;

test(
  'A link opened on another phone asks for the address',
  async () => {
    await using app = await openApp({ route: SIGN_IN_LINK, world: 'signed out', locale: 'en' });
    const page = app.page;

    await page.getByText('Finish signing in', { exact: true }).waitFor();
    await page
      .getByText('Enter the email address the link was sent to, and we’ll sign you in.', { exact: true })
      .waitFor();

    const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
    await signIn.waitFor();
    expect(await signIn.isDisabled()).toBe(true);
    await page.getByRole('link', { name: 'Back to the start', exact: true }).waitFor();

    await page.getByLabel('Email address', { exact: true }).fill('emil@example.com');
    await signIn.click();

    await page.getByText('About you', { exact: true }).first().waitFor();
    await page.getByLabel('First name', { exact: true }).waitFor();

    await app.saveScreen('a-link-opened-on-another-phone-asks-for-the-address.png');
  },
  TIMEOUT,
);

test(
  'A link that does not work, on another phone',
  async () => {
    await using app = await openApp({ route: BROKEN_LINK, world: 'signed out', locale: 'en' });
    const page = app.page;

    await page.getByText('Finish signing in', { exact: true }).waitFor();
    await page.getByLabel('Email address', { exact: true }).fill('emil@example.com');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    const alert = page.getByRole('alert');
    await alert.waitFor();
    const message = (await alert.textContent()) ?? '';
    expect(message).toContain('This isn’t a valid sign-in link. Ask for a new one.');

    await page.getByText('Finish signing in', { exact: true }).waitFor();
    await page.getByLabel('Email address', { exact: true }).waitFor();

    await app.saveScreen('a-link-that-does-not-work-on-another-phone.png');
  },
  TIMEOUT,
);

test(
  'Back to the start instead of the address',
  async () => {
    await using app = await openApp({ route: SIGN_IN_LINK, world: 'signed out', locale: 'en' });
    const page = app.page;

    await page.getByText('Finish signing in', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Back to the start', exact: true }).click();

    await page.getByText('Continue with email', { exact: true }).waitFor();

    await app.saveScreen('back-to-the-start-instead-of-the-address.png');
  },
  TIMEOUT,
);

test(
  'Confirming the address in Danish',
  async () => {
    await using app = await openApp({ route: SIGN_IN_LINK, world: 'signed out', locale: 'da' });
    const page = app.page;

    await page.getByText('Gør dit login færdigt', { exact: true }).waitFor();
    await page.getByLabel('E-mailadresse', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Log ind', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Tilbage til start', exact: true }).waitFor();

    await app.saveScreen('confirming-the-address-in-danish.png');
  },
  TIMEOUT,
);
