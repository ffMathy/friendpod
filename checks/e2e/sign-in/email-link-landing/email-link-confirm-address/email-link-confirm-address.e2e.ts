// ail-derived-from: EmailLinkConfirmAddress@e4f1391897927f49
// End-to-end check of EmailLinkConfirmAddress (ail/sign-in/email-link-landing/email-link-confirm-address): each test
// is one of its scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

// The landing as a sign-in email's link opens it: a sign-in link carries a one-time code; one without is not a sign-in link.
const SIGN_IN_LINK = 'https://friendpod-staging.firebaseapp.com/__/auth/action?mode=signIn&oobCode=preview';
const NOT_A_SIGN_IN_LINK = 'https://friendpod-staging.firebaseapp.com/__/auth/action?mode=signIn';

const signInLinkRoute = `/auth/complete?link=${encodeURIComponent(SIGN_IN_LINK)}`;
const brokenLinkRoute = `/auth/complete?link=${encodeURIComponent(NOT_A_SIGN_IN_LINK)}`;

test('A link opened on another phone asks for the address', async () => {
  await using app = await openApp({ route: signInLinkRoute, world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Finish signing in' }).waitFor();
  const lede = 'Enter the email address the link was sent to, and we’ll sign you in.';
  expect(await page.getByText(lede, { exact: true }).isVisible()).toBe(true);
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  expect(await signIn.isDisabled()).toBe(true);
  expect(await page.getByRole('link', { name: 'Back to the start', exact: true }).isVisible()).toBe(true);
  await page.getByLabel('Email address', { exact: true }).fill('emil@example.com');
  await signIn.click();
  await page.getByText('Step 1 of 6', { exact: true }).waitFor();
  expect(await page.getByText('About you', { exact: true }).isVisible()).toBe(true);
});

test('A link that does not work, on another phone', async () => {
  await using app = await openApp({ route: brokenLinkRoute, world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByLabel('Email address', { exact: true }).fill('emil@example.com');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByText('This isn’t a valid sign-in link. Ask for a new one.', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Finish signing in' }).isVisible()).toBe(true);
});

test('Back to the start instead of the address', async () => {
  await using app = await openApp({ route: signInLinkRoute, world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Back to the start', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
});

test('Confirming the address in Danish', async () => {
  await using app = await openApp({ route: signInLinkRoute, world: 'signed out', locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Gør dit login færdigt' }).waitFor();
  expect(await page.getByLabel('E-mailadresse', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Log ind', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Tilbage til start', exact: true }).isVisible()).toBe(true);
});
