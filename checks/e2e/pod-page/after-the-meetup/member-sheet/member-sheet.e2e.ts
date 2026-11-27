// End-to-end check of MemberSheet (ail/pod-page/after-the-meetup/member-sheet): each test is one of its scenarios, by
// name, played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const MORNING_AFTER = 'member the morning after a meetup' as const;
const jonasSheet = '/pod/braetspilpodaarhus46/member/u_jonas';

test('The sheet of a member in an active pod', async () => {
  await using app = await openApp({ route: jonasSheet, world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Block Jonas', exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Jonas', exact: true }).isVisible()).toBe(true);
  expect(await page.getByLabel('In your brætspil pod', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('brætspil', { exact: true }).isVisible()).toBe(true);
  expect(
    await page.getByText("You'll never be matched again. Jonas is taken out of this pod and only sees that the pod changed.", { exact: true }).isVisible(),
  ).toBe(true);
  expect(await page.getByRole('button', { name: 'Report Jonas', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText("Jonas won't know who reported. Reports can pause someone from matching.", { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText(/^Want to leave instead\? You can leave the pod from its menu at any time\./).isVisible()).toBe(true);
});

test('The sheet of a member in a private pod', async () => {
  await using app = await openApp({ route: '/pod/privatepodaarhusweek/member/u_line', world: 'member of a confirmed private pod', locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Block Line', exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Line', exact: true }).isVisible()).toBe(true);
  expect(await page.getByLabel('In your gravid pod', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('img', { name: 'Private', exact: true }).isVisible()).toBe(true);
  // Her photo: an image the size of the 72 px avatar (a sheet without a photo has none).
  const widths = await Promise.all((await page.getByRole('img').all()).map(async (img) => (await img.boundingBox())?.width));
  expect(widths).toContain(72);
  expect(await page.getByText('About me', { exact: false }).isVisible()).toBe(true);
  expect(await page.getByText('Moved to Aarhus in the summer, always up for a walk by the water', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Report Line', exact: true }).isVisible()).toBe(true);
});

test("The member's own sheet", async () => {
  await using app = await openApp({ route: '/pod/braetspilpodaarhus46/member/u_me', world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByText("That's you", { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Emil', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: /^Block/ }).count()).toBe(0);
  expect(await page.getByRole('button', { name: /^Report/ }).count()).toBe(0);
});

test('Report opens the report for that member', async () => {
  await using app = await openApp({ route: jonasSheet, world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByRole('button', { name: 'Report Jonas', exact: true }).click();
  await page.getByRole('heading', { name: 'Report Jonas', exact: true }).waitFor();
  expect(await page.getByText('What happened?', { exact: true }).isVisible()).toBe(true);
});

test('A pod the member is not in', async () => {
  await using app = await openApp({ route: jonasSheet, world: 'member this week', locale: 'en' });
  const { page } = app;
  await page.getByText('This pod no longer exists.', { exact: true }).waitFor();
  expect(await page.getByRole('heading', { name: 'Former member', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: /^Block/ }).count()).toBe(0);
  expect(await page.getByRole('button', { name: /^Report/ }).count()).toBe(0);
});

test('The sheet in Danish', async () => {
  await using app = await openApp({ route: jonasSheet, world: MORNING_AFTER, locale: 'da' });
  const { page } = app;
  await page.getByRole('button', { name: 'Bloker Jonas', exact: true }).waitFor();
  expect(await page.getByLabel('I din pod om brætspil', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Anmeld Jonas', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Luk', exact: true }).isVisible()).toBe(true);
});
