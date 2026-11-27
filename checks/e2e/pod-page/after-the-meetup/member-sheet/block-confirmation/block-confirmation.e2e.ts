// End-to-end check of BlockConfirmation (ail/pod-page/after-the-meetup/member-sheet/block-confirmation): each test is one
// of its scenarios, by name, played through the running app as a user would, with what the user sees.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const MORNING_AFTER = 'member the morning after a meetup' as const;
const jonasSheet = '/pod/braetspilpodaarhus46/member/u_jonas';
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const text = (page: Page, t: string) => page.getByText(t, { exact: true });

async function onJonasConfirmation(locale: 'en' | 'da' = 'en') {
  const app = await openApp({ route: jonasSheet, world: MORNING_AFTER, locale });
  await button(app.page, locale === 'da' ? 'Bloker Jonas' : 'Block Jonas').click();
  return app;
}

test('Block asks first and takes the member out by default', async () => {
  await using app = await onJonasConfirmation();
  const { page } = app;
  await text(page, 'Block Jonas?').waitFor();
  expect(await text(page, "You'll never be matched again, and photos are hidden both ways.").isVisible()).toBe(true);
  expect(await page.getByRole('radiogroup', { name: 'What should happen to the pod?' }).isVisible()).toBe(true);
  expect(await page.getByRole('radio', { name: 'Take Jonas out of the pod', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('radio', { name: 'Leave the pod myself instead', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('radio', { name: 'Take them out and re-plan the meetup', exact: true }).count()).toBe(0);
  expect(await text(page, 'The others only see that the pod changed.').isVisible()).toBe(true);
  expect(await button(page, 'Report Jonas').count()).toBe(0);
  expect(await button(page, 'Block Jonas').isVisible()).toBe(true);
  expect(await button(page, 'Cancel').isVisible()).toBe(true);
});

test('Leaving instead keeps the member in the pod', async () => {
  await using app = await onJonasConfirmation();
  const { page } = app;
  await page.getByRole('radio', { name: 'Leave the pod myself instead', exact: true }).click();
  await text(page, 'Jonas stays in the pod. The others only see “A member left”.').waitFor();
  expect(await text(page, 'The others only see that the pod changed.').count()).toBe(0);
});

test('A scheduled meetup can be re-planned', async () => {
  await using app = await openApp({ route: '/pod/braetspilpodaarhus46/member/u_mette', world: 'member the day before a meetup', locale: 'en' });
  const { page } = app;
  await button(page, 'Block Mette').click();
  await page.getByRole('radio', { name: 'Take them out and re-plan the meetup', exact: true }).click();
  await text(page, "They already know where and when you're meeting. Re-planning picks a new time and place within 48 hours.").waitFor();
});

test('In a past pod, Block asks without choices', async () => {
  await using app = await openApp({ route: '/pod/climbingpodaarhus42a/member/u_sofie', world: 'member this week', locale: 'en' });
  const { page } = app;
  await button(page, 'Block Sofie').waitFor();
  expect(await text(page, "You'll never be matched again, and photos are hidden both ways.").isVisible()).toBe(true);
  expect(await page.getByText(/^Want to leave instead\?/).count()).toBe(0);
  await button(page, 'Block Sofie').click();
  await text(page, 'Block Sofie?').waitFor();
  expect(await page.getByRole('radiogroup').count()).toBe(0);
  expect(await page.getByRole('radio').count()).toBe(0);
  expect(await button(page, 'Block Sofie').isVisible()).toBe(true);
  expect(await button(page, 'Cancel').isVisible()).toBe(true);
  expect(await button(page, 'Report Sofie').count()).toBe(0);
});

test('Cancel returns to the sheet', async () => {
  await using app = await onJonasConfirmation();
  const { page } = app;
  await button(page, 'Cancel').click();
  await button(page, 'Report Jonas').waitFor();
  expect(await button(page, 'Block Jonas').isVisible()).toBe(true);
  expect(await text(page, 'Block Jonas?').count()).toBe(0);
});

test('Confirming the block closes the sheet', async () => {
  await using app = await onJonasConfirmation();
  const { page } = app;
  await text(page, 'Block Jonas?').waitFor();
  await button(page, 'Block Jonas').click();
  await button(page, 'Give feedback').waitFor();
  expect(await button(page, 'Block Jonas').count()).toBe(0);
  expect(await page.getByText('brætspil', { exact: true }).first().isVisible()).toBe(true);
});

test('Someone already blocked can be unblocked', async () => {
  await using app = await openApp({ route: '/pod/climbingpodaarhus42a/member/u_rasmus', world: 'member this week', locale: 'en' });
  const { page } = app;
  await button(page, 'Unblock this person').waitFor();
  expect(await page.getByRole('heading', { name: 'Former member', exact: true }).isVisible()).toBe(true);
  expect(await text(page, "You've blocked this person.").isVisible()).toBe(true);
  await button(page, 'Unblock this person').click();
  await button(page, 'Block this person').waitFor();
  expect(await button(page, 'Unblock this person').count()).toBe(0);
});

test('The confirmation in Danish', async () => {
  await using app = await onJonasConfirmation('da');
  const { page } = app;
  await text(page, 'Bloker Jonas?').waitFor();
  expect(await text(page, 'Hvad skal der ske med poden?').isVisible()).toBe(true);
  expect(await page.getByRole('radio', { name: 'Tag Jonas ud af poden', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('radio', { name: 'Forlad hellere selv poden', exact: true }).isVisible()).toBe(true);
  expect(await button(page, 'Annullér').isVisible()).toBe(true);
});
