// ail-derived-from: PrivateInterestsCard@24a315b876034aef
// End-to-end check of PrivateInterestsCard (ail/interests/private-interests-card): each test is one of its scenarios,
// by name, played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

async function onInterests(locale: 'en' | 'da' = 'en') {
  const app = await openApp({ route: '/interests', world: 'member this week', locale });
  await app.page.getByText(locale === 'en' ? '5 of 20' : '5 af 20', { exact: true }).waitFor();
  return app;
}

test('The private interest is shown quietly', async () => {
  await using app = await onInterests();
  const { page } = app;
  expect(await page.getByRole('heading', { name: 'Private interests', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('gravid', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Consent given 4 Nov 2026', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Remove gravid and withdraw consent for it', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Remove & withdraw', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: "This isn't sensitive for me", exact: true }).isVisible()).toBe(true);
  expect(
    await page.getByText('Only used to form pods about this interest. Never on a profile, never in a notification.', { exact: true }).isVisible(),
  ).toBe(true);
});

test('Remove and withdraw takes the private interest away', async () => {
  await using app = await onInterests();
  const { page } = app;
  await page.getByRole('button', { name: 'Remove gravid and withdraw consent for it', exact: true }).click();
  await page.getByText('4 of 20', { exact: true }).waitFor();
  expect(await page.getByText('gravid', { exact: true }).count()).toBe(0);
  expect(await page.getByRole('heading', { name: 'Private interests', exact: true }).count()).toBe(0);
  expect(await page.getByRole('link', { name: 'How private interests work' }).isVisible()).toBe(true);
});

test('The private card in Danish', async () => {
  await using app = await onInterests('da');
  const { page } = app;
  expect(await page.getByRole('heading', { name: 'Private interesser', exact: true }).isVisible()).toBe(true);
  for (const text of ['gravid', 'Du sagde ja 4. nov. 2026', 'Fjern og tilbagekald', 'Den er ikke følsom for mig']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
});
