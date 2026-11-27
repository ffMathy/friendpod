// ail-derived-from: DeleteAccount@3dcd4ba816b4f6c9
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { openApp } from '../../../../harness/preview';

const TIMEOUT = 20_000;

/** A pressable thing a user sees by its name: a button or a link. */
function action(page: Page, name: string): Locator {
  return page
    .getByRole('button', { name, exact: true })
    .or(page.getByRole('link', { name, exact: true }))
    .first();
}

/** A button whose accessible name contains the text (an icon may sit next to it). */
function button(page: Page, name: string): Locator {
  return page.getByRole('button', { name }).first();
}

/** Text as a user reads it; Playwright matches across nested text elements. */
function text(page: Page, value: string): Locator {
  return page.getByText(value).first();
}

async function visible(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
}

/** Whether `lower` sits under `upper` on the screen. */
async function expectBelow(upper: Locator, lower: Locator): Promise<void> {
  const upperBox = await upper.boundingBox();
  const lowerBox = await lower.boundingBox();
  expect(upperBox).not.toBeNull();
  expect(lowerBox).not.toBeNull();
  if (upperBox === null || lowerBox === null) return;
  expect(lowerBox.y).toBeGreaterThanOrEqual(upperBox.y + upperBox.height - 1);
}

const POINTS = [
  'Your profile, interests, private interests, photo and votes are deleted now.',
  'You leave every pod. The others only see “A member left”.',
  'Copies in our backups disappear within 7 days.',
  "Your sign-in record at Google's login service can take up to 180 days to clear.",
  'A few records we must keep, such as proof of consent and reports, are kept without your name.',
];

describe('DeleteAccount', () => {
  test('The screen says what happens', async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;
    const open = action(page, 'Delete account');
    await visible(open);
    await open.click();

    await visible(text(page, 'Delete your account?'));
    await visible(text(page, "This can't be undone. If you just need a break, you can pause matching instead."));

    const heading = text(page, 'What happens');
    await visible(heading);
    const points: Locator[] = POINTS.map((p) => text(page, p));
    for (const point of points) {
      await visible(point);
    }
    const first = points[0];
    const last = points[points.length - 1];
    if (first === undefined || last === undefined) throw new Error('no points');
    await expectBelow(heading, first);
    let previous = await topOf(first);
    for (const point of points.slice(1)) {
      const y = await topOf(point);
      expect(y).toBeGreaterThan(previous);
      previous = y;
    }

    const download = button(page, 'Download my data first');
    const note = text(page, "To keep your account safe, we'll ask you to sign in again first.");
    const confirm = button(page, 'Sign in again and delete');
    const cancel = action(page, 'Cancel');
    for (const l of [download, note, confirm, cancel]) {
      await visible(l);
    }
    await expectBelow(last, download);
    await expectBelow(download, note);
    await expectBelow(note, confirm);
    await expectBelow(confirm, cancel);

    await app.saveScreen('the-screen-says-what-happens.png');
  });

  test('Download my data first asks for the file', async () => {
    await using app = await openApp({
      route: '/settings/delete-account',
      world: 'member in privacy settings',
      locale: 'en',
    });
    const page = app.page;
    const download = button(page, 'Download my data first');
    await visible(download);
    await download.click();

    const line = text(page, "We're preparing your file and will let you know when it's ready.");
    await visible(line);
    await expectBelow(download, line);

    await app.saveScreen('download-my-data-first-asks-for-the-file.png');
  });

  test('With a ready file, Download my data first downloads it', async () => {
    await using app = await openApp({ route: '/settings/delete-account', world: 'member this week', locale: 'en' });
    const page = app.page;
    // The download of the file fails.
    await page.route(/firebasestorage|storage\.googleapis\.com/, (route) => route.abort());

    const download = button(page, 'Download my data first');
    await visible(download);
    const ready = text(page, 'Your file is ready until Tue 10 Nov, 21:12.');
    await visible(ready);
    await expectBelow(download, ready);

    await download.click();
    await visible(text(page, "The download didn't work. Try again."));
    expect(await page.getByText("We're preparing your file").count()).toBe(0);

    await app.saveScreen('with-a-ready-file-download-my-data-first-downloads-it.png');
  });

  test('Deleting waits for a confirmation', async () => {
    await using app = await openApp({
      route: '/settings/delete-account',
      world: 'member in privacy settings',
      locale: 'en',
    });
    const page = app.page;
    const confirm = button(page, 'Sign in again and delete');
    await visible(confirm);
    await confirm.click();
    await page.waitForTimeout(1_000);

    await visible(text(page, 'Delete your account?'));
    expect(page.url()).toContain('/settings/delete-account');
    expect(await page.getByText('Your account has been deleted. Thanks for trying Friendpod.').count()).toBe(0);

    await app.saveScreen('deleting-waits-for-a-confirmation.png');
  });

  test('Cancel and Back return to Privacy', async () => {
    {
      await using app = await openApp({
        route: '/settings/delete-account',
        world: 'member in privacy settings',
        locale: 'en',
      });
      const page = app.page;
      const cancel = action(page, 'Cancel');
      await visible(cancel);
      await cancel.click();
      await page.waitForURL(/\/settings\/privacy/, { timeout: TIMEOUT });
      await visible(action(page, 'Delete account'));
    }
    {
      await using app = await openApp({
        route: '/settings/delete-account',
        world: 'member in privacy settings',
        locale: 'en',
      });
      const page = app.page;
      const back = action(page, 'Back');
      await visible(back);
      await back.click();
      await page.waitForURL(/\/settings\/privacy/, { timeout: TIMEOUT });
      await visible(action(page, 'Delete account'));

      await app.saveScreen('cancel-and-back-return-to-privacy.png');
    }
  });

  test('Delete account in Danish', async () => {
    await using app = await openApp({ route: '/settings/delete-account', world: 'member this week', locale: 'da' });
    const page = app.page;
    await visible(text(page, 'Vil du slette din konto?'));
    await visible(text(page, 'Hvad sker der?'));
    await visible(button(page, 'Hent mine data først'));
    await visible(text(page, 'Din fil er klar indtil tirs. 10. nov., 21.12.'));
    await visible(button(page, 'Log ind igen og slet'));
    await visible(action(page, 'Annullér'));

    await app.saveScreen('delete-account-in-danish.png');
  });
});
