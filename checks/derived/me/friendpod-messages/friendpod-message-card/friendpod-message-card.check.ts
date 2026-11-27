// ail-derived-from: FriendpodMessageCard@89eb2d3b3ccfd509
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';
import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

async function isBelow(lower: Locator, upper: Locator): Promise<boolean> {
  const a = await upper.boundingBox();
  const b = await lower.boundingBox();
  if (a === null || b === null) {
    return false;
  }
  return b.y >= a.y + a.height - 1;
}

test(
  "A safety report's receipt adds the 112 line",
  async () => {
    await using app = await openApp({
      route: '/settings/notices',
      world: 'member with messages from Friendpod',
      locale: 'en',
    });
    const page = app.page;

    const title = page.getByText('Thanks for your report', { exact: true });
    await title.waitFor({ state: 'visible' });
    const body = page.getByText(
      "We've received your report. The person you reported won't find out who reported them.",
      { exact: true },
    );
    await body.waitFor({ state: 'visible' });

    const alert = page.getByRole('alert').filter({ hasText: 'In danger right now? Call 112.' });
    await alert.waitFor({ state: 'visible' });
    expect(await alert.count()).toBe(1);
    expect(await isBelow(alert, body)).toBe(true);

    await alert.scrollIntoViewIfNeeded();
    await app.saveScreen('a-safety-report-s-receipt-adds-the-112-line.png');
  },
  TIMEOUT,
);

test(
  'An automated pause says it was decided automatically',
  async () => {
    await using app = await openApp({
      route: '/settings/notices',
      world: 'member with messages from Friendpod',
      locale: 'en',
    });
    const page = app.page;

    const title = page.getByText('Matching paused', { exact: true });
    await title.waitFor({ state: 'visible' });
    const body = page.getByText(
      'You are paused from drops until Mon 26 Oct, 09:00 because you missed meetups without cancelling. ' +
        "When you're back, we'll ask you to commit to showing up.",
      { exact: true },
    );
    await body.waitFor({ state: 'visible' });

    const automated = page.getByText(
      'This was decided automatically; no person reviewed it. The pause ends on its own.',
      { exact: true },
    );
    await automated.waitFor({ state: 'visible' });
    const contact = page.getByText('Questions? Write to privacy@friendpod.example.', { exact: true });
    await contact.waitFor({ state: 'visible' });

    expect(await isBelow(automated, body)).toBe(true);
    expect(await isBelow(contact, body)).toBe(true);

    await contact.scrollIntoViewIfNeeded();
    await app.saveScreen('an-automated-pause-says-it-was-decided-automatically.png');
  },
  TIMEOUT,
);

test(
  'Ready data can be downloaded from its message',
  async () => {
    await using app = await openApp({
      route: '/settings/notices',
      world: 'member with messages from Friendpod',
      locale: 'en',
    });
    const page = app.page;

    const title = page.getByText('Your Friendpod data', { exact: true });
    await title.waitFor({ state: 'visible' });
    const body = page.getByText('Your data is ready to download. The file is deleted within 48 hours.', {
      exact: true,
    });
    await body.waitFor({ state: 'visible' });

    const download = page.getByRole('button', { name: 'Download the file' });
    await download.waitFor({ state: 'visible' });
    expect(await download.count()).toBe(1);
    expect(await download.isDisabled()).toBe(false);

    await download.scrollIntoViewIfNeeded();
    await app.saveScreen('ready-data-can-be-downloaded-from-its-message.png');
  },
  TIMEOUT,
);

test(
  'A download that does not work says so',
  async () => {
    // In the preview, saving a file (a download) always fails.
    await using app = await openApp({
      route: '/settings/notices',
      world: 'member with messages from Friendpod',
      locale: 'en',
    });
    const page = app.page;

    const download = page.getByRole('button', { name: 'Download the file' });
    await download.waitFor({ state: 'visible' });
    await download.scrollIntoViewIfNeeded();
    await download.click();

    const failed = page.getByText("The download didn't work. Try again.", { exact: true });
    await failed.waitFor({ state: 'visible' });
    expect(await failed.count()).toBe(1);

    await failed.scrollIntoViewIfNeeded();
    await app.saveScreen('a-download-that-does-not-work-says-so.png');
  },
  TIMEOUT,
);
