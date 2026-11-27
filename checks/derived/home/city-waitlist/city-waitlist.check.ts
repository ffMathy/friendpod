// ail-derived-from: CityWaitlist@30aaeea3350d3959
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const WORLD = 'member in a city on the waitlist';
const TIMEOUT = 180_000;

/** A button or a link with exactly this accessible name. */
function pressable(page: Page, name: string): Locator {
  return page
    .getByRole('button', { name, exact: true })
    .or(page.getByRole('link', { name, exact: true }))
    .first();
}

/** A tab bar item with exactly this name, whether drawn as a tab or as a link. */
function tabBarItem(page: Page, name: string): Locator {
  return page.getByRole('tab', { name, exact: true }).or(page.getByRole('link', { name, exact: true }));
}

const TAB_NAMES = ['This week', 'Pods', 'Interests', 'Me'];

async function shown(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible' });
}

function exactText(page: Page, text: string): Locator {
  return page.getByText(text, { exact: true });
}

function caseInsensitive(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

async function expectTabBar(page: Page): Promise<void> {
  for (const name of TAB_NAMES) {
    await shown(tabBarItem(page, name));
  }
}

test(
  'The waitlist instead of this week',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    await shown(exactText(page, "You're on the list"));
    await shown(exactText(page, 'Odense opens soon'));
    await shown(page.getByText(caseInsensitive('Odense waitlist')));

    const counter = page.getByLabel('186 of 250 signed up', { exact: true }).first();
    await shown(counter);
    const counterText = (await counter.textContent()) ?? '';
    expect(counterText).toContain('186');
    expect(counterText).toContain('of 250');
    await shown(exactText(page, '186'));
    await shown(exactText(page, 'of 250'));

    await shown(page.getByRole('progressbar', { name: 'People on the Odense waitlist', exact: true }));

    await shown(exactText(page, 'Help Odense open sooner'));
    await shown(page.getByRole('button', { name: 'Share invite link', exact: true }));
    await shown(page.getByText('friendpod.dk/c/odense'));

    await shown(exactText(page, 'While you wait'));
    await shown(pressable(page, 'Add a few more interests'));

    const profile = pressable(page, 'Profile and settings');
    await shown(profile);
    const profileBox = await profile.boundingBox();
    expect(profileBox).not.toBeNull();
    const all = [...(await page.getByRole('button').all()), ...(await page.getByRole('link').all())];
    let lowest = Number.NEGATIVE_INFINITY;
    for (const item of all) {
      if (!(await item.isVisible())) continue;
      const box = await item.boundingBox();
      if (box !== null && box.y > lowest) lowest = box.y;
    }
    if (profileBox !== null) {
      expect(profileBox.y + 0.5).toBeGreaterThanOrEqual(lowest);
    }

    for (const name of TAB_NAMES) {
      expect(await tabBarItem(page, name).count()).toBe(0);
    }

    await app.saveScreen('the-waitlist-instead-of-this-week.png');
  },
  TIMEOUT,
);

test(
  'Copy copies the invite link',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    const copy = page.getByRole('button', { name: 'Copy', exact: true });
    await shown(copy);
    await copy.first().click();

    await shown(page.getByRole('button', { name: 'Copied', exact: true }));

    await app.saveScreen('copy-copies-the-invite-link.png');
  },
  TIMEOUT,
);

test(
  'The interests while you wait',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    const more = pressable(page, 'Add a few more interests');
    await shown(more);
    await more.click();

    await page.waitForURL(/\/interests(\?.*)?$/);
    await expectTabBar(page);

    await app.saveScreen('the-interests-while-you-wait.png');
  },
  TIMEOUT,
);

test(
  'Profile and settings opens Me',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    const profile = pressable(page, 'Profile and settings');
    await shown(profile);
    await profile.click();

    await page.waitForURL(/\/me(\?.*)?$/);
    await shown(page.getByText('Weekly drops', { exact: true }));
    await expectTabBar(page);

    await app.saveScreen('profile-and-settings-opens-me.png');
  },
  TIMEOUT,
);

test(
  'The waitlist in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'da' });
    const page = app.page;

    await shown(exactText(page, 'Du er på listen'));
    await shown(exactText(page, 'Odense åbner snart'));
    await shown(page.getByText(caseInsensitive('Venteliste for Odense')));
    await shown(exactText(page, 'af 250'));

    await shown(exactText(page, 'Hjælp Odense med at åbne hurtigere'));
    await shown(page.getByRole('button', { name: 'Del invitationslink', exact: true }));
    await shown(page.getByRole('button', { name: 'Kopiér', exact: true }));
    await shown(exactText(page, 'Mens du venter'));
    await shown(pressable(page, 'Profil og indstillinger'));

    await app.saveScreen('the-waitlist-in-danish.png');
  },
  TIMEOUT,
);
