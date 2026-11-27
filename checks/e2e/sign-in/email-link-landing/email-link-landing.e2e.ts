// ail-derived-from: EmailLinkLanding@c2080a3b41ed3380
// End-to-end check of EmailLinkLanding (ail/sign-in/email-link-landing): each test is one of its scenarios, by name,
// played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

// The landing as a sign-in email's link opens it: a sign-in link carries a one-time code; one without is not a sign-in link.
const SIGN_IN_LINK = 'https://friendpod-staging.firebaseapp.com/__/auth/action?mode=signIn&oobCode=preview';
const NOT_A_SIGN_IN_LINK = 'https://friendpod-staging.firebaseapp.com/__/auth/action?mode=signIn';

const signInLinkRoute = `/auth/complete?link=${encodeURIComponent(SIGN_IN_LINK)}`;
const brokenLinkRoute = `/auth/complete?link=${encodeURIComponent(NOT_A_SIGN_IN_LINK)}`;

test('A link opened on the phone that asked for it signs in at once', async () => {
  await using app = await openApp({ route: signInLinkRoute, world: 'signed out, email link sent', locale: 'en' });
  const { page } = app;
  await page.getByText('Step 1 of 6', { exact: true }).waitFor();
  expect(await page.getByText('About you', { exact: true }).isVisible()).toBe(true);
});

test('A link that does not work offers a new one', async () => {
  await using app = await openApp({ route: brokenLinkRoute, world: 'signed out, email link sent', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'That link didn’t work' }).waitFor();
  expect(await page.getByText('This isn’t a valid sign-in link. Ask for a new one.', { exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Send a new link', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in with email' }).waitFor();
  await page.waitForFunction(() => document.querySelector('input')?.value === 'emil@example.com');
  expect(await page.getByLabel('Email address', { exact: true }).inputValue()).toBe('emil@example.com');
});

test('Back to the start from a link that does not work', async () => {
  await using app = await openApp({ route: brokenLinkRoute, world: 'signed out, email link sent', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'That link didn’t work' }).waitFor();
  await page.getByRole('link', { name: 'Back to the start', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
});

test('Opened without a link, the landing only waits', async () => {
  await using app = await openApp({ route: '/auth/complete', world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByText('This only takes a moment.', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Signing you in' }).isVisible()).toBe(true);
  expect(await page.getByRole('progressbar', { name: 'Signing you in' }).isVisible()).toBe(true);
  await page.waitForTimeout(1500);
  expect(await page.getByRole('button').count()).toBe(0);
  expect(await page.getByRole('link').count()).toBe(0);
  expect(await page.getByRole('textbox').count()).toBe(0);
});

test('A link that does not work, in Danish', async () => {
  await using app = await openApp({ route: brokenLinkRoute, world: 'signed out, email link sent', locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Linket virkede ikke' }).waitFor();
  expect(await page.getByText('Linket er ikke gyldigt. Bed om et nyt.', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Send et nyt link', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Tilbage til start', exact: true }).isVisible()).toBe(true);
});
