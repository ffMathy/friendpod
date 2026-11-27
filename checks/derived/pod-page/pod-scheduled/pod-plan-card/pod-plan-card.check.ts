// ail-derived-from: PodPlanCard@dd61546a76b8aea5
import { expect, test } from 'bun:test';
import { openApp } from '../../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;
type Page = App['page'];
type Locator = ReturnType<Page['getByText']>;

const POD_ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 180_000;

/** Waits until a text the user reads is on screen. */
async function seeText(page: Page, text: string): Promise<Locator> {
  const loc = page.getByText(text, { exact: true }).first();
  await loc.waitFor({ state: 'visible' });
  return loc;
}

/** The Plan eyebrow of the Plan card. */
async function planHeading(page: Page, label: string): Promise<Locator> {
  return seeText(page, label);
}

/** The button or link with this name that sits on the same row as the Plan heading, at its right; null when none. */
async function besidePlan(page: Page, planLabel: string, name: string): Promise<Locator | null> {
  const plan = await planHeading(page, planLabel);
  const planBox = await plan.boundingBox();
  if (planBox === null) return null;
  const candidates = page.getByRole('button', { name }).or(page.getByRole('link', { name }));
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);
    if (!(await candidate.isVisible())) continue;
    const box = await candidate.boundingBox();
    if (box === null) continue;
    const sameRow = box.y < planBox.y + planBox.height && box.y + box.height > planBox.y;
    const atRight = box.x >= planBox.x + planBox.width - 1;
    if (sameRow && atRight) return candidate;
  }
  return null;
}

test('The plan the day before', async () => {
  await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
  const page = app.page;

  await planHeading(page, 'Plan');
  await seeText(page, 'Saturday 21 Nov, 14:00');
  await seeText(page, '[Board game café] · Aarhus C');

  const map = page.getByRole('link', { name: 'Open [Board game café] in Maps', exact: true });
  await map.first().waitFor({ state: 'visible' });
  expect(await map.first().textContent()).toContain('Open in Maps');

  const calendar = page.getByRole('button', { name: 'Add to calendar' });
  await calendar.first().waitFor({ state: 'visible' });
  expect(await calendar.first().isVisible()).toBe(true);

  const safety = await besidePlan(page, 'Plan', 'Meeting safely');
  expect(safety).not.toBeNull();

  await app.saveScreen('the-plan-the-day-before.png');
}, TIMEOUT);

test('Meeting safely beside the plan opens the tips', async () => {
  await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
  const page = app.page;

  const safety = await besidePlan(page, 'Plan', 'Meeting safely');
  expect(safety).not.toBeNull();
  if (safety === null) return;
  await safety.click();

  await page.waitForURL(/\/info\/safety/);
  await page.getByRole('heading', { name: 'Meeting safely' }).first().waitFor({ state: 'visible' });
  expect(new URL(page.url()).pathname).toBe('/info/safety');

  await app.saveScreen('meeting-safely-beside-the-plan-opens-the-tips.png');
}, TIMEOUT);

test('After the meetup the plan is a record', async () => {
  await using app = await openApp({ route: POD_ROUTE, world: 'member the morning after a meetup', locale: 'en' });
  const page = app.page;

  await planHeading(page, 'Plan');
  await seeText(page, 'Saturday 21 Nov, 14:00');
  await seeText(page, '[Board game café] · Aarhus C');

  expect(await page.getByRole('link', { name: 'Open [Board game café] in Maps' }).count()).toBe(0);
  expect(await page.getByText('Open in Maps', { exact: true }).count()).toBe(0);
  expect(await page.getByRole('button', { name: 'Add to calendar' }).count()).toBe(0);
  expect(await page.getByText('Add to calendar', { exact: true }).count()).toBe(0);
  expect(await besidePlan(page, 'Plan', 'Meeting safely')).toBeNull();

  await app.saveScreen('after-the-meetup-the-plan-is-a-record.png');
}, TIMEOUT);

test('The plan in Danish', async () => {
  await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'da' });
  const page = app.page;

  await planHeading(page, 'Plan');
  await seeText(page, 'Lørdag 21. nov. kl. 14.00');
  await seeText(page, '[Brætspilscafé] · Aarhus C');

  const map = page.getByRole('link', { name: 'Åbn [Brætspilscafé] i Kort', exact: true });
  await map.first().waitFor({ state: 'visible' });
  expect(await map.first().textContent()).toContain('Åbn i Kort');

  const calendar = page.getByRole('button', { name: 'Føj til kalender' });
  await calendar.first().waitFor({ state: 'visible' });
  expect(await calendar.first().isVisible()).toBe(true);

  await app.saveScreen('the-plan-in-danish.png');
}, TIMEOUT);
