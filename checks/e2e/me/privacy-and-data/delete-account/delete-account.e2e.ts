// End-to-end check of DeleteAccount (ail/me/privacy-and-data/delete-account): each test is one of its scenarios, by
// name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import type { World } from '../../../data.ts';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const onDelete = (world: World = 'member in privacy settings', locale: 'en' | 'da' = 'en') =>
  openApp({ route: '/settings/delete-account', world, locale });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

const WHAT_HAPPENS = [
  'Your profile, interests, private interests, photo and votes are deleted now.',
  'You leave every pod. The others only see “A member left”.',
  'Copies in our backups disappear within 7 days.',
  "Your sign-in record at Google's login service can take up to 180 days to clear.",
  'A few records we must keep, such as proof of consent and reports, are kept without your name.',
];

test('The screen says what happens', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const { page } = app;
  await button(page, 'Delete account').click();
  await page.getByRole('heading', { name: 'Delete your account?', exact: true }).waitFor();
  await page.getByText("This can't be undone. If you just need a break, you can pause matching instead.", { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'What happens', exact: true }).waitFor();
  for (const point of WHAT_HAPPENS) await page.getByText(point, { exact: true }).waitFor();
  const order = [
    button(page, 'Download my data first'),
    page.getByText("To keep your account safe, we'll ask you to sign in again first.", { exact: true }),
    button(page, 'Sign in again and delete'),
    button(page, 'Cancel'),
  ];
  let last = -1;
  for (const item of order) {
    const box = await item.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan(last);
    last = box!.y;
  }
});

test('Download my data first asks for the file', async () => {
  await using app = await onDelete();
  const { page } = app;
  await button(page, 'Download my data first').click();
  await page.getByText("We're preparing your file and will let you know when it's ready.", { exact: true }).waitFor();
});

test('With a ready file, Download my data first downloads it', async () => {
  await using app = await onDelete('member this week');
  const { page } = app;
  await page.getByText('Your file is ready until Tue 10 Nov, 21:12.', { exact: true }).waitFor();
  await button(page, 'Download my data first').click();
  await page.getByText("The download didn't work. Try again.", { exact: true }).waitFor();
  await page.waitForTimeout(500);
  expect(await page.getByText("We're preparing your file and will let you know when it's ready.").count()).toBe(0);
});

test('Deleting waits for a confirmation', async () => {
  await using app = await onDelete();
  const { page } = app;
  await button(page, 'Sign in again and delete').click();
  await page.waitForTimeout(800);
  expect(await page.getByRole('heading', { name: 'Delete your account?', exact: true }).isVisible()).toBe(true);
  expect(await button(page, 'Cancel').isVisible()).toBe(true);
});

test('Cancel and Back return to Privacy', async () => {
  for (const way of ['Cancel', 'Back']) {
    await using app = await onDelete();
    const { page } = app;
    await button(page, way).click();
    await page.getByRole('heading', { name: 'Privacy', exact: true }).waitFor();
    expect(await page.getByRole('heading', { name: 'Delete your account?' }).count()).toBe(0);
  }
});

test('Delete account in Danish', async () => {
  await using app = await onDelete('member this week', 'da');
  const { page } = app;
  await page.getByRole('heading', { name: 'Vil du slette din konto?', exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Hvad sker der?', exact: true }).waitFor();
  await button(page, 'Hent mine data først').waitFor();
  await page.getByText('Din fil er klar indtil tirs. 10. nov., 21.12.', { exact: true }).waitFor();
  await button(page, 'Log ind igen og slet').waitFor();
  await button(page, 'Annullér').waitFor();
});
