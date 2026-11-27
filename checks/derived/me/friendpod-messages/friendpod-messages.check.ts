// ail-derived-from: FriendpodMessages@341451db7c4853f5
import { describe, expect, test } from 'bun:test';
import { openApp } from '../../../harness/preview.ts';

const ROUTE = '/settings/notices';

type App = Awaited<ReturnType<typeof openApp>>;

async function pageText(app: App): Promise<string> {
  return await app.page.locator('body').innerText();
}

function expectInOrder(text: string, parts: readonly string[]): void {
  let from = 0;
  for (const part of parts) {
    const at = text.indexOf(part, from);
    expect({ part, found: at >= 0 }).toEqual({ part, found: true });
    from = at + part.length;
  }
}

describe('FriendpodMessages', () => {
  test('One message of each kind, newest first', async () => {
    await using app = await openApp({ route: ROUTE, world: 'member with messages from Friendpod', locale: 'en' });
    const page = app.page;

    await page.getByText('Messages from Friendpod', { exact: true }).first().waitFor();
    const lede = page.getByText(
      'Pauses, report receipts and other news about your account. Each message is kept for a year.',
      { exact: true },
    );
    await lede.waitFor();
    expect(await lede.isVisible()).toBe(true);

    await page.getByText('Matching paused', { exact: true }).first().waitFor();
    const text = await pageText(app);

    expectInOrder(text, [
      'Your Friendpod data',
      'Thanks for your report',
      'Your pod changed',
      'Welcome back',
      'Matching paused',
    ]);
    expectInOrder(text, [
      'Mon 9 Nov, 09:12',
      'Sun 1 Nov, 22:40',
      'Sat 31 Oct, 21:00',
      'Mon 26 Oct, 09:00',
      'Mon 12 Oct, 09:00',
    ]);

    await app.saveScreen('one-message-of-each-kind-newest-first.png');
  });

  test('No messages yet', async () => {
    await using app = await openApp({ route: ROUTE, world: 'new member with nothing yet', locale: 'en' });
    const page = app.page;

    const none = page.getByText('No messages from Friendpod.', { exact: true });
    await none.waitFor();
    expect(await none.isVisible()).toBe(true);

    const body = page.getByText(
      "If we pause matching, receive your report or have your data ready, you'll find it here.",
      { exact: true },
    );
    await body.waitFor();
    expect(await body.isVisible()).toBe(true);

    await app.saveScreen('no-messages-yet.png');
  });

  test('Messages in Danish', async () => {
    await using app = await openApp({ route: ROUTE, world: 'member with messages from Friendpod', locale: 'da' });
    const page = app.page;

    await page.getByText('Beskeder fra Friendpod', { exact: true }).first().waitFor();
    await page.getByText('Matchning sat på pause', { exact: true }).first().waitFor();
    await page.getByText('Dine Friendpod-data', { exact: true }).first().waitFor();

    const text = await pageText(app);
    expect(text).toContain('Beskeder fra Friendpod');
    expect(text).toContain('Dine Friendpod-data');
    expect(text).toContain('man. 9. nov., 09.12');
    expect(text).toContain('Matchning sat på pause');

    await app.saveScreen('messages-in-danish.png');
  });
});
