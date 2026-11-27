// ail-derived-from: ProposalDecline@9de36baa7ac35ad5
// End-to-end check of ProposalDecline (ail/home/drop-proposal/proposal-decline): each test is one of its scenarios, by
// name, played through the running app as a user would, with what the user sees: roles, labels and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const shown = (page: Page, text: string) => page.getByText(text, { exact: true }).filter({ visible: true }).first();
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true }).filter({ visible: true }).first();
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const withProposal = (locale: 'en' | 'da' = 'en') => openApp({ route: '/', world: 'member with a pod proposal', locale });

test('Declining asks why, optionally', async () => {
  await using app = await withProposal();
  const { page } = app;
  await button(page, 'Not this time').click();
  await shown(page, 'Optional: why? (used only for anonymous statistics)').waitFor();
  for (const reason of ['Not this week', 'Not this interest', 'Too far', 'Group size', 'Other']) {
    await page.getByRole('radio', { name: reason, exact: true }).waitFor();
  }
  await button(page, 'Cancel').waitFor();
  await button(page, 'Decline this pod').waitFor();
  expect(await button(page, "I'm in").count()).toBe(0);
});

test('Cancel keeps the proposal', async () => {
  await using app = await withProposal();
  const { page } = app;
  await button(page, 'Not this time').click();
  await button(page, 'Cancel').click();
  await button(page, 'Not this time').waitFor();
  await button(page, "I'm in").waitFor();
  expect(await button(page, 'Decline this pod').count()).toBe(0);
});

test('Declining leaves the proposal behind', async () => {
  await using app = await withProposal();
  const { page } = app;
  await button(page, 'Not this time').click();
  await page.getByRole('radio', { name: 'Too far', exact: true }).click();
  await button(page, 'Decline this pod').click();
  await heading(page, 'This week').waitFor();
  await shown(page, 'Next drop').waitFor();
  await shown(page, 'in 6 days and 23 hours').waitFor();
  expect(await page.getByText('brætspil', { exact: true }).filter({ visible: true }).count()).toBe(1); // the interest chip only
  expect(await heading(page, 'brætspil').count()).toBe(0);
});

test('Declining in Danish', async () => {
  await using app = await withProposal('da');
  const { page } = app;
  await button(page, 'Ikke nu').click();
  await shown(page, 'Valgfrit: hvorfor? (bruges kun til anonym statistik)').waitFor();
  for (const reason of ['Ikke i denne uge', 'Ikke denne interesse', 'For langt væk', 'Gruppens størrelse', 'Andet']) {
    await page.getByRole('radio', { name: reason, exact: true }).waitFor();
  }
  await button(page, 'Annullér').waitFor();
  await button(page, 'Sig nej tak til poden').waitFor();
});
