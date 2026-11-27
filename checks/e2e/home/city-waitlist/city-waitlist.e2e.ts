// ail-derived-from: CityWaitlist@96508150a7025f43
// End-to-end check of CityWaitlist (ail/home/city-waitlist): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const onWaitlist = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'member in a city on the waitlist', locale });

test('The waitlist instead of this week', async () => {
  await using app = await onWaitlist();
  const { page } = app;
  await heading(page, 'Odense opens soon').waitFor();
  for (const text of ["You're on the list", 'Odense waitlist', '186', 'of 250', 'friendpod.dk/c/odense']) {
    await shown(page, text).waitFor();
  }
  await page.getByRole('progressbar', { name: 'People on the Odense waitlist' }).waitFor();
  await heading(page, 'Help Odense open sooner').waitFor();
  await page.getByRole('button', { name: 'Share invite link' }).waitFor();
  await heading(page, 'While you wait').waitFor();
  await page.getByRole('link', { name: 'Add a few more interests' }).waitFor();
  const links = await page.getByRole('link').filter({ visible: true }).allTextContents();
  expect(links.at(-1)).toBe('Profile and settings');
  expect(await page.getByRole('tab').filter({ visible: true }).count()).toBe(0);
});

test('Copy copies the invite link', async () => {
  await using app = await onWaitlist();
  const { page } = app;
  await page.getByRole('button', { name: 'Copy invite link' }).click();
  await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
  expect(await shown(page, 'Copied').isVisible()).toBe(true);
});

test('The interests while you wait', async () => {
  await using app = await onWaitlist();
  const { page } = app;
  await page.getByRole('link', { name: 'Add a few more interests' }).click();
  await heading(page, 'Interests').waitFor();
  await page.getByRole('tab', { name: 'Interests', selected: true }).waitFor();
  expect(await page.getByRole('tab').filter({ visible: true }).count()).toBe(4);
});

test('Profile and settings opens Me', async () => {
  await using app = await onWaitlist();
  const { page } = app;
  await page.getByRole('link', { name: 'Profile and settings' }).click();
  await heading(page, 'Weekly drops').waitFor();
  await page.getByRole('tab', { name: 'Me', selected: true }).waitFor();
  expect(await page.getByRole('tab').filter({ visible: true }).count()).toBe(4);
});

test('The waitlist in Danish', async () => {
  await using app = await onWaitlist('da');
  const { page } = app;
  await heading(page, 'Odense åbner snart').waitFor();
  for (const text of ['Du er på listen', 'Venteliste for Odense', 'af 250', 'Kopiér', 'Profil og indstillinger']) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'Hjælp Odense med at åbne hurtigere').waitFor();
  await page.getByRole('button', { name: 'Del invitationslink' }).waitFor();
  await heading(page, 'Mens du venter').waitFor();
});
