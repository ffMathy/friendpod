// ail-derived-from: MeetupAttendance@45e1402ffa172f9a
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const POD_ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 180_000;

describe('MeetupAttendance', () => {
  test(
    'Saying yes moves the next step on to the chat',
    async () => {
      await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'en' });
      const page = app.page;

      const ask = page.getByText('Still coming tomorrow at 14:00?', { exact: true });
      await ask.waitFor({ state: 'visible' });
      expect(await ask.isVisible()).toBe(true);

      await page.getByRole('button', { name: "Yes, I'm coming", exact: true }).click();

      const chatStep = page.getByText('The meetup chat is open', { exact: true });
      await chatStep.waitFor({ state: 'visible' });
      expect(await chatStep.isVisible()).toBe(true);
      const openChat = page.getByRole('button', { name: 'Open chat', exact: true });
      await openChat.waitFor({ state: 'visible' });
      expect(await openChat.isVisible()).toBe(true);

      const answer = page.getByText("You're coming.", { exact: true });
      await answer.waitFor({ state: 'visible' });
      expect(await answer.isVisible()).toBe(true);
      const cantMakeIt = page.getByRole('button', { name: "Can't make it", exact: true });
      await cantMakeIt.waitFor({ state: 'visible' });
      expect(await cantMakeIt.isVisible()).toBe(true);

      await page.getByText('Still coming tomorrow at 14:00?', { exact: true }).waitFor({ state: 'hidden' });
      expect(await page.getByText('Still coming tomorrow at 14:00?', { exact: true }).count()).toBe(0);

      await app.saveScreen('saying-yes-moves-the-next-step-on-to-the-chat.png');
    },
    TIMEOUT,
  );

  test(
    'The viewer already said they are coming',
    async () => {
      await using app = await openApp({ route: POD_ROUTE, world: 'member just before a meetup', locale: 'en' });
      const page = app.page;

      const answer = page.getByText("You're coming.", { exact: true });
      await answer.waitFor({ state: 'visible' });
      expect(await answer.isVisible()).toBe(true);
      const cantMakeIt = page.getByRole('button', { name: "Can't make it", exact: true });
      await cantMakeIt.waitFor({ state: 'visible' });
      expect(await cantMakeIt.isVisible()).toBe(true);

      await app.saveScreen('the-viewer-already-said-they-are-coming.png');
    },
    TIMEOUT,
  );

  test(
    'Still coming? in Danish',
    async () => {
      await using app = await openApp({ route: POD_ROUTE, world: 'member the day before a meetup', locale: 'da' });
      const page = app.page;

      const yes = page.getByRole('button', { name: 'Ja, jeg kommer', exact: true });
      await yes.waitFor({ state: 'visible' });
      await yes.click();

      const answer = page.getByText('Du kommer.', { exact: true });
      await answer.waitFor({ state: 'visible' });
      expect(await answer.isVisible()).toBe(true);
      const cantMakeIt = page.getByRole('button', { name: 'Kan ikke komme', exact: true });
      await cantMakeIt.waitFor({ state: 'visible' });
      expect(await cantMakeIt.isVisible()).toBe(true);

      await app.saveScreen('still-coming-in-danish.png');
    },
    TIMEOUT,
  );
});
