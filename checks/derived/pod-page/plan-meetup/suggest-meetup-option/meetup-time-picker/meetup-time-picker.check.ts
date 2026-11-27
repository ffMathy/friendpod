// ail-derived-from: MeetupTimePicker@860bbdcaf98743ee
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;

const ROUTE = '/pod/braetspilpodaarhus46/propose';
const WORLD = 'member planning a meetup';
const TIMEOUT = 180_000;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The 15 days from Mon 16 Nov to Mon 30 Nov, as the app shows them. */
const expectedDays = (): string[] => {
  const days: string[] = [];
  for (let d = 16; d <= 30; d += 1) {
    days.push(`${WEEKDAYS[(d - 16) % 7] ?? ''} ${d} Nov`);
  }
  return days;
};

/** Every half hour from 08:00 to 22:00. */
const expectedTimes = (): string[] => {
  const times: string[] = [];
  for (let m = 8 * 60; m <= 22 * 60; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    times.push(`${h}:${mm}`);
  }
  return times;
};

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sheet = (app: App, title: string) => app.page.getByRole('dialog').filter({ hasText: title });

const choice = (app: App, title: string, label: string) =>
  sheet(app, title)
    .getByRole('radio')
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) });

const closeIfOpen = async (app: App, title: string): Promise<void> => {
  const s = sheet(app, title);
  if (await s.isVisible()) {
    await app.page.keyboard.press('Escape');
  }
  await s.waitFor({ state: 'hidden' });
};

const pick = async (app: App, title: string, label: string): Promise<void> => {
  await choice(app, title, label).click();
  await closeIfOpen(app, title);
};

const dayField = (app: App, name: RegExp = /^Day, /) => app.page.getByRole('button', { name });
const timeField = (app: App, name: RegExp = /^Time, /) => app.page.getByRole('button', { name });

describe('MeetupTimePicker', () => {
  test(
    'The days run from today to 14 days ahead',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });

      await dayField(app).click();
      const daySheet = sheet(app, 'Which day?');
      await daySheet.waitFor({ state: 'visible' });

      const radios = daySheet.getByRole('radio');
      const texts = (await radios.allTextContents()).map((t) => t.trim());
      expect(texts).toEqual(expectedDays());

      await pick(app, 'Which day?', 'Sun 22 Nov');
      expect(await dayField(app).textContent()).toContain('Sun 22 Nov');

      await app.saveScreen('the-days-run-from-today-to-14-days-ahead.png');
    },
    TIMEOUT,
  );

  test(
    'Times that have passed today cannot be picked',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });

      await dayField(app).click();
      await sheet(app, 'Which day?').waitFor({ state: 'visible' });
      await pick(app, 'Which day?', 'Mon 16 Nov');

      await timeField(app).click();
      const timeSheet = sheet(app, 'What time?');
      await timeSheet.waitFor({ state: 'visible' });

      expect(await timeSheet.textContent()).toContain('Between 08:00 and 22:00, within the next 14 days.');

      const texts = (await timeSheet.getByRole('radio').allTextContents()).map((t) => t.trim());
      expect(texts).toEqual(expectedTimes());

      for (const t of ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']) {
        expect(await choice(app, 'What time?', t).isDisabled()).toBe(true);
      }
      expect(await choice(app, 'What time?', '12:30').isDisabled()).toBe(false);
      expect(await choice(app, 'What time?', '22:00').isDisabled()).toBe(false);

      await app.saveScreen('times-that-have-passed-today-cannot-be-picked.png');
    },
    TIMEOUT,
  );

  test(
    'The last day ends at the time it is now',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });

      await dayField(app).click();
      await sheet(app, 'Which day?').waitFor({ state: 'visible' });
      await pick(app, 'Which day?', 'Mon 30 Nov');

      await timeField(app).click();
      await sheet(app, 'What time?').waitFor({ state: 'visible' });

      expect(await choice(app, 'What time?', '12:00').isDisabled()).toBe(false);
      expect(await choice(app, 'What time?', '12:30').isDisabled()).toBe(true);

      await app.saveScreen('the-last-day-ends-at-the-time-it-is-now.png');
    },
    TIMEOUT,
  );

  test(
    'A time picked before the day is not limited',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });

      expect(await dayField(app, /^Day, Pick a day$/).count()).toBe(1);

      await timeField(app).click();
      await sheet(app, 'What time?').waitFor({ state: 'visible' });

      expect(await choice(app, 'What time?', '08:00').isDisabled()).toBe(false);

      await app.saveScreen('a-time-picked-before-the-day-is-not-limited.png');
    },
    TIMEOUT,
  );

  test(
    'Day and time in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });

      await dayField(app, /^Dag, /).click();
      await sheet(app, 'Hvilken dag?').waitFor({ state: 'visible' });
      await pick(app, 'Hvilken dag?', 'søn. 22. nov.');

      await timeField(app, /^Tidspunkt, /).click();
      const timeSheet = sheet(app, 'Hvilket tidspunkt?');
      await timeSheet.waitFor({ state: 'visible' });
      expect(await timeSheet.textContent()).toContain('Mellem kl. 8 og 22 inden for de næste 14 dage.');
      await pick(app, 'Hvilket tidspunkt?', '15.00');

      expect(await dayField(app, /^Dag, /).textContent()).toContain('søn. 22. nov.');
      expect(await timeField(app, /^Tidspunkt, /).textContent()).toContain('15.00');

      await app.saveScreen('day-and-time-in-danish.png');
    },
    TIMEOUT,
  );
});
