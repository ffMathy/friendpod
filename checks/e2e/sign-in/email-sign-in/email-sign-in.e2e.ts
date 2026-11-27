// ail-derived-from: EmailSignIn@ad1f6fe3dcfafc4c
// End-to-end check of EmailSignIn (ail/sign-in/email-sign-in): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onEmail = (locale: 'en' | 'da' = 'en') => openApp({ route: '/email', world: 'signed out', locale });
const field = (page: Page) => page.getByLabel('Email address', { exact: true });
const send = (page: Page) => page.getByRole('button', { name: 'Send me a sign-in link', exact: true });

test('Send waits for a whole address', async () => {
  await using app = await onEmail();
  const { page } = app;
  await field(page).fill('emil@example');
  expect(await send(page).isDisabled()).toBe(true);
  await field(page).fill('emil@example.com');
  expect(await send(page).isDisabled()).toBe(false);
});

test('Sending the link', async () => {
  await using app = await onEmail();
  const { page } = app;
  await field(page).fill('  emil@example.com  ');
  await send(page).click();
  await page.getByText('Check your inbox', { exact: true }).waitFor();
  expect(await page.getByText('We sent a link to emil@example.com. Open it on this phone to sign in.', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Send a new link', exact: true }).isVisible()).toBe(true);
});

test('The return key sends the link', async () => {
  await using app = await onEmail();
  const { page } = app;
  await field(page).fill('emil@example.com');
  await field(page).press('Enter');
  await page.getByText('Check your inbox', { exact: true }).waitFor();
});

test('An address kept from an earlier link fills the field', async () => {
  await using app = await openApp({ route: '/email', world: 'signed out, email link sent', locale: 'en' });
  const { page } = app;
  await page.waitForFunction(() => document.querySelector('input')?.value === 'emil@example.com');
  expect(await field(page).inputValue()).toBe('emil@example.com');
});

test('Back returns to the welcome screen', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Continue with email', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in with email' }).waitFor();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
  expect(await page.getByText('Sign in with email', { exact: true }).count()).toBe(0);
});

test('The email step in Danish', async () => {
  await using app = await onEmail('da');
  const { page } = app;
  await page.getByRole('heading', { name: 'Log ind med e-mail' }).waitFor();
  await page.getByLabel('E-mailadresse', { exact: true }).fill('emil@example.com');
  await page.getByRole('button', { name: 'Send mig et login-link', exact: true }).click();
  await page.getByText('Tjek din indbakke', { exact: true }).waitFor();
  const sent = 'Vi har sendt et link til emil@example.com. Åbn det på denne telefon for at logge ind.';
  expect(await page.getByText(sent, { exact: true }).isVisible()).toBe(true);
});
