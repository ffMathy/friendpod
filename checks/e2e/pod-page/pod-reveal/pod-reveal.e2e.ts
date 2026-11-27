// ail-derived-from: PodReveal@44b0bbae907a83a5
// End-to-end check of PodReveal (ail/pod-page/pod-reveal): each test is one of its scenarios, by name, played through
// the running app as a user would, with what the user sees: labels, roles and the copy texts.
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

test('The reveal names everyone', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  for (const text of ['Confirmed', '5 people near Aarhus C', 'You', 'Emil', 'More than one of you also likes', 'sourdough', 'coffee', 'hiking']) {
    expect(await visible(page, text)).toBe(true);
  }
  expect(await page.getByRole('heading', { name: 'brætspil', exact: true }).isVisible()).toBe(true);
  for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) {
    expect(await page.getByRole('link', { name, exact: true }).isVisible()).toBe(true);
  }
  expect(await page.getByRole('link', { name: 'Emil', exact: true }).count()).toBe(0);
  expect(await button(page, 'Meeting safely').isVisible()).toBe(true);
  expect(await button(page, 'Plan the meetup').isVisible()).toBe(true);
  expect(await visible(page, 'Pick a time by Tuesday 18:00')).toBe(true);
});

test('A member opens their sheet', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Jonas', exact: true }).click();
  await page.getByRole('button', { name: 'Block Jonas', exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Jonas', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Report Jonas', exact: true }).isVisible()).toBe(true);
});

test('Meeting safely unfolds the tips', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  expect(await page.getByText(/Meet in a public place in daytime or early evening\./).count()).toBe(0);
  await button(page, 'Meeting safely').click();
  const tips = page.getByText(/Meet in a public place in daytime or early evening\./);
  await tips.waitFor();
  expect(await tips.innerText()).toContain('In an emergency, call 112.');
  await page.getByText('All safety tips', { exact: true }).click();
  await page.getByText('Before you go', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Meeting safely' }).first().isVisible()).toBe(true);
});

test('Plan the meetup opens the planner', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'en' });
  const { page } = app;
  await button(page, 'Plan the meetup').click();
  await page.getByRole('heading', { name: 'Plan the meetup', exact: true }).waitFor();
  expect(await page.getByText('Confirmed', { exact: true }).isVisible()).toBe(false);
});

test("An option waiting for the viewer's vote", async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  expect(await visible(page, 'Vote by Tuesday 18:00')).toBe(true);
  expect(await page.getByText('Pick a time by Tuesday 18:00', { exact: true }).count()).toBe(0);
});

test('The extra planning round', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member in the extra planning round', locale: 'en' });
  const { page } = app;
  const alert = page.getByRole('alert');
  await alert.waitFor();
  const text = await alert.innerText();
  expect(text).toContain('No time works yet — add another option');
  expect(text).toContain('You have one more day, until Wednesday 18:00. If no option gets 3 yes votes by then, the pod ends.');
  expect(await visible(page, 'Voting closes Wednesday 18:00')).toBe(true);
});

test('The reveal in Danish', async () => {
  await using app = await openApp({ route: BRAETSPIL, world: 'member of a confirmed pod', locale: 'da' });
  const { page } = app;
  for (const text of ['Bekræftet', '5 personer i nærheden af Aarhus C', 'Dig', 'Flere af jer kan også lide', 'surdej', 'Find et tidspunkt senest tirsdag kl. 18.00']) {
    expect(await visible(page, text)).toBe(true);
  }
  expect(await button(page, 'Mød hinanden trygt').isVisible()).toBe(true);
  expect(await button(page, 'Planlæg mødet').isVisible()).toBe(true);
});
