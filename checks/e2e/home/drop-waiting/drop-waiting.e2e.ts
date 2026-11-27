// ail-derived-from: DropWaiting@c6d59b6dbaa401c2
// End-to-end check of DropWaiting (ail/home/drop-waiting): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const waiting = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'member waiting for the others', locale });

test('Waiting for the others', async () => {
  await using app = await waiting();
  const { page } = app;
  await heading(page, 'Your weekly drop').waitFor();
  for (const text of [
    'Week 46',
    "You're in",
    'Open until Sat 18:00',
    'A pod around',
    '3 of 5 said yes',
    'You',
    '4 needed',
    "We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits.",
  ]) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'brætspil').waitFor();
  await page.getByRole('button', { name: 'Okay' }).waitFor();
  await page.getByRole('link', { name: 'Changed your mind? Leave this pod' }).waitFor();
  expect(await page.getByRole('button', { name: "I'm in" }).count()).toBe(0);
});

test('Okay moves the pod to Your pods', async () => {
  await using app = await waiting();
  const { page } = app;
  await page.getByRole('button', { name: 'Okay' }).click();
  await heading(page, 'This week').waitFor();
  await shown(page, 'Next drop').waitFor();
  await shown(page, 'in 6 days and 8 hours').waitFor();
  await heading(page, 'Your pods · 0 of 2 active').waitFor();
  await page.getByRole('link', { name: 'brætspil. Waiting for the others · 3 of 5 said yes' }).waitFor();
});

test('The waiting pod opens from Your pods', async () => {
  await using app = await waiting();
  const { page } = app;
  await page.getByRole('button', { name: 'Okay' }).click();
  await page.getByRole('link', { name: /^brætspil\. Waiting for the others/ }).click();
  await shown(page, '3 of 5 said yes').waitFor();
  expect(await heading(page, 'This week').count()).toBe(0);
});

test('Waiting in Danish', async () => {
  await using app = await waiting('da');
  const { page } = app;
  await heading(page, 'Ugens drop').waitFor();
  for (const text of ['Du er med', 'Åben til lør. kl. 18.00', '3 af 5 har sagt ja', '4 skal sige ja']) {
    await shown(page, text).waitFor();
  }
  await page.getByRole('button', { name: 'Okay' }).waitFor();
  await page.getByRole('link', { name: 'Fortrudt? Forlad poden' }).waitFor();
});
