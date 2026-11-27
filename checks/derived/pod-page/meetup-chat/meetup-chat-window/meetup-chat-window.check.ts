// ail-derived-from: MeetupChatWindow@fe9f31c5be357557
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/chat';
const TIMEOUT = 180_000;

test(
  'Before a time is picked the chat is closed',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member planning a meetup', locale: 'en' });
    const page = app.page;

    const band = page.getByText('Chat closed', { exact: true });
    await band.first().waitFor({ state: 'visible' });
    expect(await band.first().isVisible()).toBe(true);

    const note = page.getByText('The chat opens 24 hours before your meetup, once you have picked a time.', {
      exact: true,
    });
    await note.first().waitFor({ state: 'visible' });
    expect(await note.first().isVisible()).toBe(true);

    // The note above is the one shown only when there are no messages; the one for a chat with messages is absent.
    expect(
      await page
        .getByText(
          'This chat closed because the meetup is no longer scheduled. ' +
            'Messages are deleted about 3 days after the original meetup time.',
          { exact: true },
        )
        .count(),
    ).toBe(0);

    const field = page.getByRole('textbox').first();
    await field.waitFor({ state: 'attached' });
    expect(await field.isEditable()).toBe(false);

    const send = page.getByRole('button', { name: 'Send', exact: true });
    await send.waitFor({ state: 'attached' });
    expect(await send.isDisabled()).toBe(true);

    await app.saveScreen('before-a-time-is-picked-the-chat-is-closed.png');
  },
  TIMEOUT,
);

test(
  'The morning after the meetup the chat is still open',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'en' });
    const page = app.page;

    const band = page.getByText('Chat open until Sunday 14:00', { exact: true });
    await band.first().waitFor({ state: 'visible' });
    expect(await band.first().isVisible()).toBe(true);

    const field = page.getByRole('textbox').first();
    await field.waitFor({ state: 'visible' });
    expect(await field.isEditable()).toBe(true);

    await app.saveScreen('the-morning-after-the-meetup-the-chat-is-still-open.png');
  },
  TIMEOUT,
);

test(
  'The closed chat in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member planning a meetup', locale: 'da' });
    const page = app.page;

    const band = page.getByText('Chatten er lukket', { exact: true });
    await band.first().waitFor({ state: 'visible' });
    expect(await band.first().isVisible()).toBe(true);

    const note = page.getByText('Chatten åbner 24 timer før jeres møde, når I har valgt et tidspunkt.', {
      exact: true,
    });
    await note.first().waitFor({ state: 'visible' });
    expect(await note.first().isVisible()).toBe(true);

    await app.saveScreen('the-closed-chat-in-danish.png');
  },
  TIMEOUT,
);
