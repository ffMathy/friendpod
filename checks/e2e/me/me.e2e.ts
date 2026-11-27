// ail-derived-from: Me@918d46ff9bc0d626
// End-to-end check of Me (ail/me): each test is one of its scenarios, by name, played through the running app as a
// user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });
const shows = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor();
/** A row of a list card: a link whose name starts with its label (the detail lines follow). */
const row = (page: Page, label: string) => page.getByRole('link', { name: new RegExp(`^${label}`) });

test('Me shows the member and their account', async () => {
  await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
  const { page } = app;
  await heading(page, 'Me').waitFor();
  for (const text of ['Emil', 'Aarhus C', 'Attended 2 of 2 meetups']) await shows(page, text);
  await heading(page, 'Your account').waitFor();
  await row(page, 'Pod preferences').waitFor();
  const prefs = (await row(page, 'Pod preferences').innerText()).replace(/\u00a0/g, ' ');
  expect(prefs).toContain('Ages 28–42 · about 10 km');
  expect(prefs).toContain('Danish, English');
  for (const label of ['Privacy', 'Messages from Friendpod', 'Settings']) expect(await row(page, label).count()).toBe(1);
  await heading(page, 'Good to know').waitFor();
  for (const label of ['How matching works', 'Meeting safely', 'Private interests']) {
    expect(await page.getByRole('link', { name: label, exact: true }).count()).toBe(1);
  }
});

test('A setting that kept a new member out is named', async () => {
  await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'en' });
  const { page } = app;
  await page.getByText('Your distance is short for your area. Going a little further would help.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Change preferences', exact: true }).click();
  await heading(page, 'Pod preferences').waitFor();
  expect(await page.getByRole('button', { name: 'Save', exact: true }).isVisible()).toBe(true);
});

test('The account rows open their pages', async () => {
  await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
  const { page } = app;
  const pages: [string, string][] = [
    ['Pod preferences', 'Pod preferences'],
    ['Messages from Friendpod', 'Messages from Friendpod'],
    ['Settings', 'Settings'],
    ['Privacy', 'Privacy'],
  ];
  for (const [label, title] of pages) {
    await row(page, label).click();
    await heading(page, title).waitFor();
    // Me's own title is gone: this is the page, not Me.
    await heading(page, 'Me').waitFor({ state: 'detached' });
    // Back is a chevron button named Back; on Privacy it is the "Me" above the title, named "Back: Me".
    await page.getByRole('button', { name: /^Back/ }).click();
    await heading(page, 'Me').waitFor();
    await heading(page, 'Your account').waitFor();
  }
});

test('Me in Danish', async () => {
  await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'da' });
  const { page } = app;
  await heading(page, 'Mig').waitFor();
  await shows(page, 'Ingen møder endnu');
  await heading(page, 'Din konto').waitFor();
  const prefs = (await row(page, 'Ønsker til pods').innerText()).replace(/\u00a0/g, ' ');
  expect(prefs).toContain('28–42 år · ca. 10 km');
  expect(prefs).toContain('Dansk, Engelsk');
});
