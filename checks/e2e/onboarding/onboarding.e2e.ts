// ail-derived-from: Onboarding@6c68a77d9fe44adf
// End-to-end check of Onboarding (ail/onboarding): each test is one of its scenarios, by name, played through the
// running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

test('A new member starts at About you', async () => {
  await using app = await openApp({ route: '/', world: 'new member', locale: 'en' });
  const { page } = app;
  await page.getByText('About you', { exact: true }).waitFor();
  expect(await page.getByText('Step 1 of 6', { exact: true }).isVisible()).toBe(true);
});

test('A member who sent the basics resumes at the interests', async () => {
  await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'en' });
  const { page } = app;
  await page.getByText('What are you into?', { exact: true }).waitFor();
  expect(await page.getByText('Step 4 of 6', { exact: true }).isVisible()).toBe(true);
});

test('Back from resumed interests opens the private-interests step', async () => {
  await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'en' });
  const { page } = app;
  await page.getByText('What are you into?', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByText('Step 3 of 6', { exact: true }).waitFor();
  expect(await page.getByText('Sensitive interests', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await page.getByText('What are you into?', { exact: true }).waitFor();
  expect(await page.getByText('Step 4 of 6', { exact: true }).isVisible()).toBe(true);
});

test('Resuming in Danish', async () => {
  await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'da' });
  const { page } = app;
  await page.getByText('Hvad går du op i?', { exact: true }).waitFor();
  expect(await page.getByText('Trin 4 af 6', { exact: true }).isVisible()).toBe(true);
});
