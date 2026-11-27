// End-to-end check of AfterTheMeetup (ail/pod-page/after-the-meetup): each test is one of its scenarios, by name, played
// through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const POD = '/pod/braetspilpodaarhus46';

test('Give feedback opens How did it go? and Back returns to the pod', async () => {
  await using app = await openApp({ route: POD, world: 'member the morning after a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Give feedback', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Mette was there' }).waitFor();
  expect(await page.getByRole('heading', { name: 'How did it go?', exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Give feedback', exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Mette was there' }).waitFor({ state: 'detached' });
  expect(await page.getByText('How did it go?', { exact: true }).first().isVisible()).toBe(true);
});

test("A member's name opens their sheet, and Close returns to the pod", async () => {
  await using app = await openApp({ route: POD, world: 'member the morning after a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('link', { name: 'Jonas', exact: true }).click();
  await page.getByRole('button', { name: 'Block Jonas', exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Report Jonas', exact: true }).isVisible()).toBe(true);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Block Jonas', exact: true }).waitFor({ state: 'detached' });
  expect(await page.getByRole('button', { name: 'Give feedback', exact: true }).isVisible()).toBe(true);
});

test("A report from a member's sheet returns to the sheet", async () => {
  await using app = await openApp({ route: `${POD}/member/u_jonas`, world: 'member the morning after a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Report Jonas', exact: true }).click();
  const title = page.getByRole('heading', { name: 'Report Jonas', exact: true });
  await title.waitFor();
  await page.getByRole('radio', { name: "Didn't show up", exact: true }).click();
  await page.getByRole('button', { name: 'Send report', exact: true }).click();
  await title.waitFor({ state: 'detached' });
  expect(await page.getByRole('button', { name: 'Block Jonas', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Report Jonas', exact: true }).isVisible()).toBe(true);
});

test('The journey in Danish', async () => {
  await using app = await openApp({ route: POD, world: 'member the morning after a meetup', locale: 'da' });
  const { page } = app;
  expect(await page.getByText('Medlemmer', { exact: false }).first().isVisible()).toBe(true);
  await page.getByRole('link', { name: 'Jonas', exact: true }).click();
  await page.getByRole('button', { name: 'Anmeld Jonas', exact: true }).click();
  await page.getByRole('heading', { name: 'Anmeld Jonas', exact: true }).waitFor();
  expect(await page.getByText('Hvad skete der?', { exact: true }).isVisible()).toBe(true);
});
