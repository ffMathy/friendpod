// ail-derived-from: MeetupChatMessages@6c2de99c4766c3d4
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

/** A message's accessible name: "<writer>, <time>: <text>", where time is "13:41", "Fri 15:02", "13.41" or "fre. 15.02". */
const MESSAGE_NAME = /^(.+?), ((?:\S+ )?\d{1,2}[:.]\d{2}): ([\s\S]*)$/;

interface Reading {
  writer: string;
  time: string;
  text: string;
}

function messagesList(page: Page): Locator {
  return page.getByRole('list', { name: 'Messages' });
}

async function readMessages(list: Locator): Promise<Reading[]> {
  const names = await list
    .locator('[aria-label]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label') ?? ''));
  const readings: Reading[] = [];
  for (const name of names) {
    const match = MESSAGE_NAME.exec(name);
    if (match === null) continue;
    const writer = match[1];
    const time = match[2];
    const text = match[3];
    if (writer === undefined || time === undefined || text === undefined) continue;
    readings.push({ writer, time, text });
  }
  return readings;
}

/** Waits for the list "Messages" and for it to hold `count` messages, then reads them in order. */
async function waitForMessages(page: Page, count: number): Promise<Reading[]> {
  const list = messagesList(page);
  await list.waitFor({ state: 'visible', timeout: 30_000 });
  const deadline = Date.now() + 15_000;
  let readings = await readMessages(list);
  while (readings.length < count && Date.now() < deadline) {
    await page.waitForTimeout(200);
    readings = await readMessages(list);
  }
  return readings;
}

function headers(readings: Reading[]): string[] {
  return readings.map((reading) => `${reading.writer} · ${reading.time}`);
}

test(
  'Five messages just before the meetup',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/chat',
      world: 'member just before a meetup',
      locale: 'en',
    });
    const readings = await waitForMessages(app.page, 5);
    expect(headers(readings)).toEqual([
      'Mette · Fri 15:02',
      'Sofie · Fri 18:40',
      'You · Fri 19:05',
      'Jonas · 13:41',
      'Ahmed · 13:55',
    ]);
    const ahmed = readings.find((reading) => reading.writer === 'Ahmed');
    expect(ahmed).toBeDefined();
    expect(ahmed?.text ?? '').toMatch(/^I['’]m here, table by the window, green jacket\.?$/);
    await app.saveScreen('five-messages-just-before-the-meetup.png');
  },
  TIMEOUT,
);

test(
  'Three messages the day before',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/chat',
      world: 'member the day before a meetup',
      locale: 'en',
    });
    const readings = await waitForMessages(app.page, 3);
    expect(headers(readings)).toEqual(['Mette · 15:02', 'Sofie · 18:40', 'Jonas · 19:12']);
    await app.saveScreen('three-messages-the-day-before.png');
  },
  TIMEOUT,
);

test(
  "A private pod's chat stays uncoloured",
  async () => {
    await using app = await openApp({
      route: '/pod/privatepodaarhusweek/chat',
      world: 'member the day before a private meetup',
      locale: 'en',
    });
    const readings = await waitForMessages(app.page, 4);
    await expect(app.page.getByText('gravid', { exact: true }).first().isVisible()).resolves.toBe(true);
    await expect(app.page.getByLabel('Private', { exact: true }).first().isVisible()).resolves.toBe(true);
    expect(headers(readings)).toEqual(['Line · 15:10', 'Sara · 17:45', 'You · 18:20', 'Mads · 19:05']);
    await app.saveScreen('a-private-pod-s-chat-stays-uncoloured.png');
  },
  TIMEOUT,
);

test(
  'The messages in Danish',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/chat',
      world: 'member just before a meetup',
      locale: 'da',
    });
    const list = app.page.getByRole('list', { name: 'Beskeder' });
    await list.waitFor({ state: 'visible', timeout: 30_000 });
    const deadline = Date.now() + 15_000;
    let readings = await readMessages(list);
    while (readings.length < 5 && Date.now() < deadline) {
      await app.page.waitForTimeout(200);
      readings = await readMessages(list);
    }
    expect(headers(readings)).toEqual([
      'Mette · fre. 15.02',
      'Sofie · fre. 18.40',
      'Dig · fre. 19.05',
      'Jonas · 13.41',
      'Ahmed · 13.55',
    ]);
    const note = app.page.getByText(
      'Kun jeres pod kan læse med her. Beskederne slettes cirka 3 dage efter mødet. Hold en besked nede for at anmelde den.',
      { exact: true },
    );
    await expect(note.first().isVisible()).resolves.toBe(true);
    await app.saveScreen('the-messages-in-danish.png');
  },
  TIMEOUT,
);
