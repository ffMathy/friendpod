// ail-derived-from: GivePrivateInterestConsent@20fd20e731a979b3
// End-to-end check of GivePrivateInterestConsent (ail/me/privacy-and-data/give-private-interest-consent): each test is
// one of its scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const TICK_EN = 'I explicitly consent to Friendpod processing interests that may reveal sensitive information about me, for the purposes above.';
const TICK_DA =
  'Jeg giver udtrykkeligt samtykke til, at Friendpod behandler interesser, der kan afsløre følsomme oplysninger om mig, til de formål, der er beskrevet ovenfor.';
const NOT_GIVEN = 'Private interests Not given, so nothing sensitive is saved';

const tick = (page: Page, name = TICK_EN) => page.getByRole('checkbox', { name, exact: true });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('The consent starts unticked and I agree waits', async () => {
  await using app = await openApp({ route: '/settings/sensitive-consent', world: 'member without private-interest consent', locale: 'en' });
  const { page } = app;
  await tick(page).waitFor();
  expect(await isTicked(tick(page))).toBe(false);
  expect(await button(page, 'I agree').isDisabled()).toBe(true);
  expect(await button(page, 'Not now').isDisabled()).toBe(false);
});

test('Agreeing returns to Privacy', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member without private-interest consent', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: NOT_GIVEN, exact: true }).click();
  await tick(page).click();
  expect(await isTicked(tick(page))).toBe(true);
  expect(await button(page, 'I agree').isDisabled()).toBe(false);
  await button(page, 'I agree').click();
  await page.getByRole('heading', { name: 'Privacy', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Sensitive interests', exact: true }).waitFor({ state: 'detached' });
});

test('Not now returns to Privacy with nothing given', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member without private-interest consent', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: NOT_GIVEN, exact: true }).click();
  await button(page, 'Not now').click();
  await page.getByRole('heading', { name: 'Sensitive interests', exact: true }).waitFor({ state: 'detached' });
  expect(await page.getByRole('link', { name: NOT_GIVEN, exact: true }).isVisible()).toBe(true);
});

test('Back with no earlier screen opens Privacy', async () => {
  await using app = await openApp({ route: '/settings/sensitive-consent', world: 'member without private-interest consent', locale: 'en' });
  const { page } = app;
  await button(page, 'Back').click();
  await page.getByRole('heading', { name: 'Privacy', exact: true }).waitFor();
  await page.getByRole('link', { name: NOT_GIVEN, exact: true }).waitFor();
});

test('Giving consent in Danish', async () => {
  await using app = await openApp({ route: '/settings/sensitive-consent', world: 'member without private-interest consent', locale: 'da' });
  const { page } = app;
  await tick(page, TICK_DA).waitFor();
  expect(await button(page, 'Jeg siger ja').isDisabled()).toBe(true);
  expect(await button(page, 'Ikke nu').isDisabled()).toBe(false);
  await tick(page, TICK_DA).click();
  expect(await button(page, 'Jeg siger ja').isDisabled()).toBe(false);
});
