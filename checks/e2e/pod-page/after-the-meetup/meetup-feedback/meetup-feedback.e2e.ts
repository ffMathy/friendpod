// End-to-end check of MeetupFeedback (ail/pod-page/after-the-meetup/meetup-feedback): each test is one of its scenarios,
// by name, played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { World } from '../../../data.ts';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onFeedback = (locale: 'en' | 'da' = 'en', world: World = 'member the morning after a meetup') =>
  openApp({ route: '/pod/braetspilpodaarhus46/feedback', world, locale });

test('Not there myself leaves only the pod question', async () => {
  await using app = await onFeedback();
  const { page } = app;
  await page.getByRole('checkbox', { name: "I wasn't there myself" }).click();
  await page.getByText('Then you can skip who came and who to meet again. Just tell us about the pod below.', { exact: true }).waitFor();
  for (const text of ['Mette', 'Was there', 'Meet again', 'How was it overall?']) {
    expect(await page.getByText(text, { exact: true }).count()).toBe(0);
  }
  expect(await page.getByRole('checkbox', { name: 'Mette was there' }).count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Keep pod', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Not for me', exact: true }).isVisible()).toBe(true);
});

test('Keep pod sends the answers and returns to the pod', async () => {
  await using app = await onFeedback();
  const { page } = app;
  await page.getByRole('radio', { name: '4 of 5', exact: true }).click();
  await page.getByRole('button', { name: 'Keep pod', exact: true }).click();
  await page.getByText('The meetup chat is open', { exact: true }).waitFor();
  expect(await page.getByText('brætspil', { exact: true }).first().isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Give feedback', exact: true }).count()).toBe(0);
});

test('Not for me also sends the answers', async () => {
  await using app = await onFeedback();
  const { page } = app;
  await page.getByRole('button', { name: 'Not for me', exact: true }).click();
  await page.getByText('The meetup chat is open', { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Give feedback', exact: true }).count()).toBe(0);
});

test('A pod the member is not in', async () => {
  await using app = await onFeedback('en', 'member this week');
  const { page } = app;
  await page.getByText('This pod no longer exists.', { exact: true }).waitFor();
  expect(await page.getByText('Who was there?', { exact: true }).count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Keep pod', exact: true }).count()).toBe(0);
});

test('The form in Danish', async () => {
  await using app = await onFeedback('da');
  const { page } = app;
  await page.getByText('Hvem var der?', { exact: true }).waitFor();
  for (const text of ['Hvordan gik det?', 'Hvem var der?', 'Var der', 'Ses igen', 'Hvordan var det alt i alt?']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
  expect(await page.getByRole('button', { name: 'Behold poden', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Nej tak', exact: true }).isVisible()).toBe(true);
});
