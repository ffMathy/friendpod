// ail-derived-from: DropProposal@217cbca0949f8ff5
// End-to-end check of DropProposal (ail/home/drop-proposal): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const count = (page: Page, text: string | RegExp) => page.getByText(text).filter({ visible: true }).count();
const withProposal = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'member with a pod proposal', locale });

test('The proposal on Home', async () => {
  await using app = await withProposal();
  const { page } = app;
  await heading(page, 'Your weekly drop').waitFor();
  for (const text of [
    'Week 46',
    'New pod',
    'Answer by Sat 18:00',
    'A pod around',
    'You',
    '5 people, ages 29–38',
    'Near Aarhus C · everyone within about 10 km of you',
    'Some of you also share sourdough and trail running',
    'Names and photos appear when 4 people have said yes.',
  ]) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'brætspil').waitFor();
  await page.getByRole('button', { name: 'Not this time' }).waitFor();
  await page.getByRole('button', { name: "I'm in" }).waitFor();
  await page.getByRole('link', { name: 'Why this pod?' }).waitFor();
  for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) expect(await count(page, name)).toBe(0);
});

test('Saying yes shows the wait for the others', async () => {
  await using app = await withProposal();
  const { page } = app;
  await page.getByRole('button', { name: "I'm in" }).click();
  await shown(page, '3 of 5 said yes').waitFor();
  await shown(page, "You're in").waitFor();
  await shown(page, '4 needed').waitFor();
  expect(await page.getByRole('button', { name: "I'm in" }).count()).toBe(0);
});

test('An open pod proposal', async () => {
  await using app = await openApp({ route: '/', world: 'member with an open pod proposal' });
  const { page } = app;
  await shown(page, 'A pod without a shared theme').waitFor();
  await heading(page, 'Open to anyone').waitFor();
});

test('The proposal in Danish', async () => {
  await using app = await withProposal('da');
  const { page } = app;
  await heading(page, 'Ugens drop').waitFor();
  for (const text of [
    'Uge 46',
    'Ny pod',
    'Svar senest lør. kl. 18.00',
    'En pod om',
    '5 personer, 29–38 år',
    'Tæt på Aarhus C · alle bor højst ca. 10 km fra dig',
    'Nogle af jer deler også sourdough og trail running',
    'Navne og billeder vises, når 4 har sagt ja.',
  ]) {
    await shown(page, text).waitFor();
  }
  await page.getByRole('button', { name: 'Ikke nu' }).waitFor();
  await page.getByRole('button', { name: 'Jeg er med' }).waitFor();
  await page.getByRole('link', { name: 'Hvorfor denne pod?' }).waitFor();
});
