// ail-derived-from: WhoWasThere@0d6f1ab3f52b8dec
// End-to-end check of WhoWasThere (ail/pod-page/after-the-meetup/meetup-feedback/who-was-there): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Locator } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onFeedback = (locale: 'en' | 'da' = 'en') =>
  openApp({ route: '/pod/braetspilpodaarhus46/feedback', world: 'member the morning after a meetup', locale });

/** A chosen Yes / No is drawn in ink (#18211D), an unchosen one in white. */
const isChosen = async (answer: Locator) => (await answer.evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(24, 33, 29)';

test('Everyone starts ticked and no one has a meet-again answer', async () => {
  await using app = await onFeedback();
  const { page } = app;
  await page.getByText('Who was there?', { exact: true }).waitFor();
  for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) {
    expect(await page.getByText(name, { exact: true }).isVisible()).toBe(true);
    expect(await isTicked(page.getByRole('checkbox', { name: `${name} was there` }))).toBe(true);
    const yes = page.getByRole('radio', { name: `Yes, meet ${name} again` });
    const no = page.getByRole('radio', { name: `No, don't meet ${name} again` });
    expect(await yes.isVisible()).toBe(true);
    expect(await no.isVisible()).toBe(true);
    expect(await isChosen(yes)).toBe(false);
    expect(await isChosen(no)).toBe(false);
  }
  expect(await page.getByText('Emil', { exact: true }).count()).toBe(0);
  expect(await isTicked(page.getByRole('checkbox', { name: "I wasn't there myself" }))).toBe(false);
});

test('Unticking someone takes away their meet-again question', async () => {
  await using app = await onFeedback();
  const { page } = app;
  const jonas = page.getByRole('checkbox', { name: 'Jonas was there' });
  await jonas.click();
  await page.getByRole('radio', { name: 'Yes, meet Jonas again' }).waitFor({ state: 'detached' });
  expect(await isTicked(jonas)).toBe(false);
  expect(await page.getByRole('radio', { name: "No, don't meet Jonas again" }).count()).toBe(0);
  for (const name of ['Mette', 'Sofie', 'Ahmed']) {
    expect(await page.getByRole('radio', { name: `Yes, meet ${name} again` }).isVisible()).toBe(true);
  }
  await jonas.click();
  await page.getByRole('radio', { name: 'Yes, meet Jonas again' }).waitFor();
  expect(await page.getByRole('radio', { name: "No, don't meet Jonas again" }).isVisible()).toBe(true);
});

test('A meet-again answer can be taken back', async () => {
  await using app = await onFeedback();
  const { page } = app;
  const yes = page.getByRole('radio', { name: 'Yes, meet Mette again' });
  const no = page.getByRole('radio', { name: "No, don't meet Mette again" });
  await yes.click();
  await page.waitForTimeout(200);
  expect(await isChosen(yes)).toBe(true);
  expect(await isChosen(no)).toBe(false);
  await yes.click();
  await page.waitForTimeout(200);
  expect(await isChosen(yes)).toBe(false);
  expect(await isChosen(no)).toBe(false);
});

test('The card in Danish', async () => {
  await using app = await onFeedback('da');
  const { page } = app;
  await page.getByText('Hvem var der?', { exact: true }).waitFor();
  for (const text of ['Hvem var der?', 'Var der', 'Ses igen']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
  expect(await page.getByText('Ja', { exact: true }).count()).toBe(4);
  expect(await page.getByText('Nej', { exact: true }).count()).toBe(4);
  expect(await isTicked(page.getByRole('checkbox', { name: 'Mette var der' }))).toBe(true);
});
