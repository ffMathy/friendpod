// ail-derived-from: LockedMeetupPlan@0a41fceefb25fa8a
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/plan';
const TIMEOUT = 180_000;
const MEMBERS = ['Mette', 'Jonas', 'Sofie', 'Ahmed'] as const;

/** A pressable control by its accessible name, whether it renders as a button or a link. */
function control(page: Page, name: string): Locator {
  return page.getByRole('button', { name, exact: true }).or(page.getByRole('link', { name, exact: true }));
}

/** The map link, by the text it shows (its accessible name also names the place: "Open [Board game café] in Maps"). */
function mapLink(page: Page, text: string): Locator {
  return page.getByRole('link').filter({ hasText: text });
}

/** Waits until the text is on the page. */
async function seeText(page: Page, text: string): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible' });
}

/** The smallest element that holds both the member's name and the given attendance status. */
async function memberRowText(page: Page, name: string, status: string): Promise<string> {
  const row = page.locator('div').filter({ hasText: name }).filter({ hasText: status }).last();
  await row.waitFor({ state: 'attached' });
  return (await row.textContent()) ?? '';
}

/** Asserts a member's row shows the status and belongs to that member alone. */
async function expectMemberStatus(page: Page, name: string, status: string): Promise<void> {
  const text = await memberRowText(page, name, status);
  expect(text).toContain(name);
  expect(text).toContain(status);
  for (const other of MEMBERS) {
    if (other !== name) {
      expect(text).not.toContain(other);
    }
  }
}

describe('LockedMeetupPlan', () => {
  test(
    'The plan once it is locked',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member the day before a meetup', locale: 'en' });
      const page = app.page;

      await seeText(page, 'Your meetup');
      await seeText(page, 'Voting has closed: this time won with 3 yes votes.');

      await seeText(page, 'Saturday 21 Nov, 14:00');
      const body = (await page.locator('body').textContent()) ?? '';
      expect(body).toMatch(/\S · Aarhus C/);
      await mapLink(page, 'Open in Maps').first().waitFor({ state: 'visible' });
      await control(page, 'Add to calendar').first().waitFor({ state: 'visible' });
      await control(page, 'Meeting safely').first().waitFor({ state: 'visible' });

      await seeText(page, "You haven't said if you're coming yet.");
      await control(page, "I'm coming").first().waitFor({ state: 'visible' });
      await control(page, "Can't make it").first().waitFor({ state: 'visible' });

      await expectMemberStatus(page, 'Mette', 'Coming');
      await expectMemberStatus(page, 'Jonas', 'Coming');
      await expectMemberStatus(page, 'Ahmed', 'Coming');
      await expectMemberStatus(page, 'Sofie', "Hasn't confirmed");

      expect(await control(page, 'Done voting').count()).toBe(0);
      expect(await page.getByText('Done voting').count()).toBe(0);

      await app.saveScreen('the-plan-once-it-is-locked.png');
    },
    TIMEOUT,
  );

  test(
    "Saying I'm coming on the plan",
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member the day before a meetup', locale: 'en' });
      const page = app.page;

      await seeText(page, 'Your meetup');
      const coming = control(page, "I'm coming").first();
      await coming.waitFor({ state: 'visible' });
      await coming.click();

      await seeText(page, "You're coming.");
      await seeText(page, 'Voting has closed: this time won with 3 yes votes.');
      expect(await page.getByText(/Your yes counts as/).count()).toBe(0);

      await app.saveScreen('saying-i-m-coming-on-the-plan.png');
    },
    TIMEOUT,
  );

  test(
    'Meeting safely opens the safety tips',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member the day before a meetup', locale: 'en' });
      const page = app.page;

      const safely = control(page, 'Meeting safely').first();
      await safely.waitFor({ state: 'visible' });
      await safely.click();

      await page.getByRole('heading', { name: 'Meeting safely' }).first().waitFor({ state: 'visible' });

      await app.saveScreen('meeting-safely-opens-the-safety-tips.png');
    },
    TIMEOUT,
  );

  test(
    'After the meetup the plan is a record',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'en' });
      const page = app.page;

      await seeText(page, 'Saturday 21 Nov, 14:00');
      const body = (await page.locator('body').textContent()) ?? '';
      expect(body).toMatch(/\S · Aarhus C/);

      expect(await mapLink(page, 'Open in Maps').count()).toBe(0);
      expect(await control(page, 'Add to calendar').count()).toBe(0);
      expect(await control(page, 'Meeting safely').count()).toBe(0);
      expect(await control(page, "I'm coming").count()).toBe(0);

      await app.saveScreen('after-the-meetup-the-plan-is-a-record.png');
    },
    TIMEOUT,
  );

  test(
    'Before the pod is confirmed',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      await seeText(page, 'Your meetup');
      await seeText(page, 'The planner opens once the pod is confirmed.');

      await app.saveScreen('before-the-pod-is-confirmed.png');
    },
    TIMEOUT,
  );

  test(
    'The plan in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member the day before a meetup', locale: 'da' });
      const page = app.page;

      await seeText(page, 'Jeres møde');
      await seeText(page, 'Afstemningen er lukket, og det her tidspunkt vandt med 3 ja-stemmer.');
      await seeText(page, 'Lørdag 21. nov. kl. 14.00');
      await mapLink(page, 'Åbn i Kort').first().waitFor({ state: 'visible' });
      await control(page, 'Føj til kalender').first().waitFor({ state: 'visible' });
      await control(page, 'Mød hinanden trygt').first().waitFor({ state: 'visible' });

      await app.saveScreen('the-plan-in-danish.png');
    },
    TIMEOUT,
  );
});
