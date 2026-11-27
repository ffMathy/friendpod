// ail-derived-from: PrivatePodProposal@0fe381d46fc8b6d6
// End-to-end check of PrivatePodProposal (ail/home/private-pod-proposal): each test is one of its scenarios, by name,
// played through the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const count = (page: Page, text: string | RegExp) => page.getByText(text).filter({ visible: true }).count();
const privateProposal = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'member with a private pod proposal', locale });

test('A private proposal shows less', async () => {
  await using app = await privateProposal();
  const { page } = app;
  await heading(page, 'Your weekly drop').waitFor();
  for (const text of [
    'Week 48',
    'Private interest',
    'Answer by Sat 18:00',
    'A pod around',
    '5 people',
    'Near Aarhus C',
    'Everyone invited added this interest themselves and gave consent. We show less here on purpose, so that people who say no can\'t work out who you are.',
    'Once the pod is confirmed, members see first names. Your photo stays hidden unless you choose to show it in this pod.',
  ]) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'gravid').waitFor();
  await page.getByRole('button', { name: 'Not this time' }).waitFor();
  await page.getByRole('button', { name: "I'm in" }).waitFor();
  await page.getByRole('link', { name: 'How private interests are protected' }).waitFor();
  expect(await page.getByText('New pod', { exact: true }).filter({ visible: true }).count()).toBe(0);
  expect(await page.getByText('You', { exact: true }).filter({ visible: true }).count()).toBe(0); // no seats
  expect(await count(page, /ages \d/)).toBe(0);
  expect(await count(page, /within about/)).toBe(0);
  expect(await count(page, /also share/)).toBe(0);
  expect(await page.getByRole('link', { name: 'Why this pod?' }).count()).toBe(0);
});

test('How private interests are protected', async () => {
  await using app = await privateProposal();
  const { page } = app;
  await page.getByRole('link', { name: 'How private interests are protected' }).click();
  await heading(page, 'Private interests').waitFor();
  await heading(page, 'What counts as private').waitFor();
});

test('A private proposal in Danish', async () => {
  await using app = await privateProposal('da');
  const { page } = app;
  await heading(page, 'Ugens drop').waitFor();
  for (const text of ['Uge 48', 'Privat interesse', 'Svar senest lør. kl. 18.00', 'En pod om', '5 personer', 'Tæt på Aarhus C']) {
    await shown(page, text).waitFor();
  }
  await heading(page, 'gravid').waitFor();
  await page.getByRole('button', { name: 'Ikke nu' }).waitFor();
  await page.getByRole('button', { name: 'Jeg er med' }).waitFor();
  await page.getByRole('link', { name: 'Sådan beskytter vi private interesser' }).waitFor();
});
