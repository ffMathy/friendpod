// ail-derived-from: SignIn@047b740aa9500377
// End-to-end check of SignIn (ail/sign-in): each test is one of its scenarios, by name, played through the running
// app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

test('Signed out, the app opens on the welcome screen', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Small groups. Real meetups.' }).waitFor();
  expect(await page.getByRole('button', { name: 'Continue with email', exact: true }).isVisible()).toBe(true);
});

test("Signed out, a member's screen shows the welcome screen instead", async () => {
  await using app = await openApp({ route: '/pods', world: 'signed out', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Continue with email', exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Small groups. Real meetups.' }).isVisible()).toBe(true);
});

test('A new member opens on step 1 of onboarding', async () => {
  await using app = await openApp({ route: '/', world: 'new member', locale: 'en' });
  const { page } = app;
  await page.getByText('Step 1 of 6', { exact: true }).waitFor();
  expect(await page.getByText('About you', { exact: true }).isVisible()).toBe(true);
});

test('Partway through onboarding, the app resumes at the interests step', async () => {
  await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'en' });
  const { page } = app;
  await page.getByText('Step 4 of 6', { exact: true }).waitFor();
  expect(await page.getByText('What are you into?', { exact: true }).isVisible()).toBe(true);
});

test('An onboarded member opens on This week', async () => {
  await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByText('Week 46', { exact: true }).waitFor();
  expect(await page.getByText('This week', { exact: true }).first().isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Continue with email' }).count()).toBe(0);
});

test('A member does not see the sign-in screens', async () => {
  await using app = await openApp({ route: '/email', world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByText('Week 46', { exact: true }).waitFor();
  expect(await page.getByText('Sign in with email', { exact: true }).count()).toBe(0);
});
