// ail-derived-from: Welcome@7bae2b57d6883110
// End-to-end check of Welcome (ail/sign-in/welcome): each test is one of its scenarios, by name, played through the
// running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onWelcome = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'signed out', locale });

test('Signing in with Apple leads to onboarding', async () => {
  await using app = await onWelcome();
  const { page } = app;
  await page.getByRole('button', { name: 'Continue with Apple', exact: true }).click();
  await page.getByText('Step 1 of 6', { exact: true }).waitFor();
  expect(await page.getByText('About you', { exact: true }).isVisible()).toBe(true);
});

test('A sign-in that fails says so', async () => {
  await using app = await onWelcome();
  const { page } = app;
  const google = page.getByRole('button', { name: 'Continue with Google', exact: true });
  await google.click();
  await page.getByText('Sign-in didn’t work. Please try again.', { exact: true }).waitFor();
  expect(await google.isVisible()).toBe(true);
  expect(await google.isDisabled()).toBe(false);
});

test('Continue with email opens the email step', async () => {
  await using app = await onWelcome();
  const { page } = app;
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in with email' }).waitFor();
  expect(await page.getByLabel('Email address', { exact: true }).isVisible()).toBe(true);
});

test('A failed sign-in in Danish', async () => {
  await using app = await onWelcome('da');
  const { page } = app;
  await page.getByRole('button', { name: 'Fortsæt med Google', exact: true }).click();
  await page.getByText('Det lykkedes ikke at logge ind. Prøv igen.', { exact: true }).waitFor();
});
