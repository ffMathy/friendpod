// End-to-end check of ReportSheet (ail/pod-page/after-the-meetup/report-sheet): each test is one of its scenarios, by
// name, played through the running app as a user would, with what the user sees: labels, roles and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const MORNING_AFTER = 'member the morning after a meetup' as const;
const reportOfJonas = '/sheets/report?podId=braetspilpodaarhus46&uid=u_jonas';
const send = (page: Page, name = 'Send report') => page.getByRole('button', { name, exact: true });
const reasons = (page: Page) => page.getByRole('radiogroup').getByRole('radio');
const reasonNames = async (page: Page) => Promise.all((await reasons(page).all()).map((r) => r.getAttribute('aria-label')));

test('Reporting a member', async () => {
  await using app = await openApp({ route: reportOfJonas, world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Report Jonas', exact: true }).waitFor();
  const alert = page.getByText('In danger right now? Call 112.', { exact: true });
  const question = page.getByText('What happened?', { exact: true });
  expect(await alert.isVisible()).toBe(true);
  expect((await alert.boundingBox())!.y).toBeLessThan((await question.boundingBox())!.y);
  expect(await reasonNames(page)).toEqual(['Harassment or disrespect', 'I felt unsafe', "Didn't show up", 'Something they wrote', 'May be under 18']);
  expect(await page.getByText('Not a genuine member', { exact: true }).count()).toBe(0);
  expect(await page.getByText('Tell us more', { exact: false }).first().isVisible()).toBe(true);
  expect(await page.getByText('(optional)', { exact: false }).first().isVisible()).toBe(true);
  expect(await page.getByText('0 / 500', { exact: true }).isVisible()).toBe(true);
  expect(
    await page.getByText("Please don't include health or other sensitive details. Jonas will not know who reported.", { exact: true }).isVisible(),
  ).toBe(true);
  expect(await send(page).isDisabled()).toBe(true);
});

test('A reason lets the report be sent', async () => {
  await using app = await openApp({ route: reportOfJonas, world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByRole('radio', { name: 'I felt unsafe', exact: true }).click();
  await page.waitForTimeout(200);
  expect(await send(page).isDisabled()).toBe(false);
});

test('Tell us more stops at 500 characters', async () => {
  await using app = await openApp({ route: reportOfJonas, world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  const note = page.getByLabel('Tell us more', { exact: true });
  await note.fill('a'.repeat(520));
  await page.getByText('500 / 500', { exact: true }).waitFor();
  expect((await note.inputValue()).length).toBe(500);
});

test('In a private pod, Not a genuine member is offered', async () => {
  await using app = await openApp({ route: '/sheets/report?podId=privatepodaarhusweek&uid=u_line', world: 'member of a confirmed private pod', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Report Line', exact: true }).waitFor();
  const names = await reasonNames(page);
  expect(names.slice(-2)).toEqual(['May be under 18', 'Not a genuine member']);
  expect(names.length).toBe(6);
});

test('Reporting a chat message', async () => {
  await using app = await openApp({ route: '/sheets/report?podId=braetspilpodaarhus46&messageId=m4', world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Report a message', exact: true }).waitFor();
  expect(
    await page.getByText('We keep a copy of this message with your report for 12 months, also after the chat is deleted.', { exact: true }).isVisible(),
  ).toBe(true);
  expect((await reasonNames(page))[0]).toBe('Something they wrote');
  expect(await page.getByText(/Nobody is told who reported\.$/).isVisible()).toBe(true);
});

test('Reporting a plan suggestion', async () => {
  await using app = await openApp({ route: '/sheets/report?podId=braetspilpodaarhus46&optionId=optionSaturday', world: 'member planning a meetup', locale: 'en' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Report a suggestion', exact: true }).waitFor();
  expect(await page.getByText(/Nobody is told who reported\.$/).isVisible()).toBe(true);
});

test('A report opened on its own stays open after sending', async () => {
  await using app = await openApp({ route: reportOfJonas, world: MORNING_AFTER, locale: 'en' });
  const { page } = app;
  await page.getByRole('radio', { name: "Didn't show up", exact: true }).click();
  await send(page).click();
  await page.waitForTimeout(1500);
  expect(await page.getByRole('heading', { name: 'Report Jonas', exact: true }).isVisible()).toBe(true);
  expect(await send(page).isVisible()).toBe(true);
});

test('The report in Danish', async () => {
  await using app = await openApp({ route: reportOfJonas, world: MORNING_AFTER, locale: 'da' });
  const { page } = app;
  await page.getByRole('heading', { name: 'Anmeld Jonas', exact: true }).waitFor();
  for (const text of ['I fare lige nu? Ring 112.', 'Hvad skete der?']) {
    expect(await page.getByText(text, { exact: true }).isVisible()).toBe(true);
  }
  expect(await page.getByText('Fortæl mere (valgfrit)', { exact: true }).isVisible()).toBe(true);
  expect(await send(page, 'Send anmeldelse').isVisible()).toBe(true);
});
