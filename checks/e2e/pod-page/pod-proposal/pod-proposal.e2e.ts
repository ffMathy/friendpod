// ail-derived-from: PodProposal@7040940d8ab6fc2b
// End-to-end check of PodProposal (ail/pod-page/pod-proposal): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const BRAETSPIL = '/pod/braetspilpodaarhus46';

const visible = async (page: Page, text: string) => {
  await page.getByText(text, { exact: true }).first().waitFor();
  return page.getByText(text, { exact: true }).first().isVisible();
};
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('The proposal names the pod, never its people', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member with a pod proposal', locale: 'en' });
  const { page } = app;
  for (const text of [
    'Your weekly drop',
    'Week 46',
    'New pod',
    'Answer by Sat 18:00',
    'A pod around',
    'brætspil',
    'You',
    '5 people, ages 29–38',
    'Near Aarhus C · everyone within about 10 km of you',
    'Names and photos appear when 4 people have said yes.',
  ]) {
    expect(await visible(page, text)).toBe(true);
  }
  expect(await page.getByText('Some of you also share sourdough and trail running').isVisible()).toBe(true);
  expect(await button(page, 'Not this time').isVisible()).toBe(true);
  expect(await button(page, "I'm in").isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Why this pod?', exact: true }).isVisible()).toBe(true);
  for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) {
    expect(await page.getByText(name).count()).toBe(0);
  }
});

test("I'm in turns the proposal into the wait", async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member with a pod proposal', locale: 'en' });
  const { page } = app;
  await button(page, "I'm in").click();
  await page.getByText('3 of 5 said yes', { exact: true }).waitFor();
  for (const text of ["You're in", 'Open until Sat 18:00', '4 needed']) {
    expect(await visible(page, text)).toBe(true);
  }
  expect(
    await visible(page, "We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits."),
  ).toBe(true);
  expect(await page.getByRole('link', { name: 'Changed your mind? Leave this pod', exact: true }).isVisible()).toBe(true);
  for (const name of ["I'm in", 'Not this time', 'Okay']) {
    expect(await button(page, name).count()).toBe(0);
  }
});

test('Waiting for the others', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member waiting for the others', locale: 'en' });
  const { page } = app;
  for (const text of ["You're in", '3 of 5 said yes', '4 needed']) {
    expect(await visible(page, text)).toBe(true);
  }
});

test('Saying no on the pod page', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member with a pod proposal', locale: 'en' });
  const { page } = app;
  await button(page, 'Not this time').click();
  await page.getByRole('radio', { name: 'Too far', exact: true }).click();
  await button(page, 'Decline this pod').click();
  await page.getByText('You said no', { exact: true }).waitFor();
  expect(await page.getByText('brætspil', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Your weekly drop', { exact: true }).isVisible()).toBe(true);
  for (const name of ["I'm in", 'Not this time']) {
    expect(await button(page, name).count()).toBe(0);
  }
  expect(await page.getByRole('link', { name: 'Why this pod?', exact: true }).count()).toBe(0);
});

test('Why this pod? gives the reasons', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member with a pod proposal', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Why this pod?', exact: true }).click();
  await page.getByRole('heading', { name: 'Why this pod', exact: true }).waitFor();
  expect(await visible(page, 'Everyone added brætspil, or something that means the same.')).toBe(true);
});

test('The proposal in Danish', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member with a pod proposal', locale: 'da' });
  const { page } = app;
  for (const text of ['Ugens drop', 'Uge 46', 'Ny pod', 'Svar senest lør. kl. 18.00', 'En pod om']) {
    expect(await visible(page, text)).toBe(true);
  }
  expect(await button(page, 'Ikke nu').isVisible()).toBe(true);
  expect(await button(page, 'Jeg er med').isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Hvorfor denne pod?', exact: true }).isVisible()).toBe(true);
});
