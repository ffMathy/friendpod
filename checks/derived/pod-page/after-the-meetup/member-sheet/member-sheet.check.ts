// ail-derived-from: MemberSheet@3c8f575922432588
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

async function shows(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible', timeout: 20_000 });
  expect(await locator.first().isVisible()).toBe(true);
}

test(
  'The sheet of a member in an active pod',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/member/u_jonas',
      world: 'member the morning after a meetup',
      locale: 'en',
    });
    const page = app.page;

    await shows(page.getByText('Jonas', { exact: true }));
    await shows(page.getByLabel('In your brætspil pod'));

    await shows(page.getByRole('button', { name: 'Block Jonas' }));
    await shows(
      page.getByText("You'll never be matched again. Jonas is taken out of this pod and only sees that the pod changed."),
    );

    await shows(page.getByRole('button', { name: 'Report Jonas' }));
    await shows(page.getByText("Jonas won't know who reported. Reports can pause someone from matching."));

    await shows(page.getByText('Want to leave instead? You can leave the pod from its menu at any time.'));

    await app.saveScreen('the-sheet-of-a-member-in-an-active-pod.png');
  },
  TIMEOUT,
);

test(
  'The sheet of a member in a private pod',
  async () => {
    await using app = await openApp({
      route: '/pod/privatepodaarhusweek/member/u_line',
      world: 'member of a confirmed private pod',
      locale: 'en',
    });
    const page = app.page;

    await shows(page.getByText('Line', { exact: true }));
    await shows(page.getByLabel('In your gravid pod'));
    const lock = page.getByRole('img', { name: 'Private', exact: true });
    await shows(lock);

    // Her photo is an image besides the lock.
    const images = await page.getByRole('img').count();
    const locks = await lock.count();
    expect(images).toBeGreaterThan(locks);

    await shows(page.getByText('Moved to Aarhus in the summer, always up for a walk by the water'));

    await shows(page.getByRole('button', { name: 'Block Line' }));
    await shows(page.getByRole('button', { name: 'Report Line' }));

    await app.saveScreen('the-sheet-of-a-member-in-a-private-pod.png');
  },
  TIMEOUT,
);

test(
  "The member's own sheet",
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/member/u_me',
      world: 'member the morning after a meetup',
      locale: 'en',
    });
    const page = app.page;

    await shows(page.getByText('Emil', { exact: true }));
    await shows(page.getByText("That's you"));

    expect(await page.getByRole('button', { name: /^Block/ }).count()).toBe(0);
    expect(await page.getByRole('button', { name: /^Report/ }).count()).toBe(0);

    await app.saveScreen('the-member-s-own-sheet.png');
  },
  TIMEOUT,
);

test(
  'Report opens the report for that member',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/member/u_jonas',
      world: 'member the morning after a meetup',
      locale: 'en',
    });
    const page = app.page;

    const report = page.getByRole('button', { name: 'Report Jonas' });
    await shows(report);
    await report.first().click();

    await shows(page.getByText('What happened?'));
    await shows(page.getByText('Report Jonas', { exact: true }));

    await app.saveScreen('report-opens-the-report-for-that-member.png');
  },
  TIMEOUT,
);

test(
  'A pod the member is not in',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/member/u_jonas',
      world: 'member this week',
      locale: 'en',
    });
    const page = app.page;

    await shows(page.getByText('Former member', { exact: true }));
    await shows(page.getByText('This pod no longer exists.'));

    expect(await page.getByRole('button', { name: /^Block/ }).count()).toBe(0);
    expect(await page.getByRole('button', { name: /^Report/ }).count()).toBe(0);

    await app.saveScreen('a-pod-the-member-is-not-in.png');
  },
  TIMEOUT,
);

test(
  'The sheet in Danish',
  async () => {
    await using app = await openApp({
      route: '/pod/braetspilpodaarhus46/member/u_jonas',
      world: 'member the morning after a meetup',
      locale: 'da',
    });
    const page = app.page;

    await shows(page.getByLabel('I din pod om brætspil'));
    await shows(page.getByRole('button', { name: 'Bloker Jonas' }));
    await shows(page.getByRole('button', { name: 'Anmeld Jonas' }));
    await shows(page.getByRole('button', { name: 'Luk', exact: true }));

    await app.saveScreen('the-sheet-in-danish.png');
  },
  TIMEOUT,
);
