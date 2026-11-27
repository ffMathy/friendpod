// ail-derived-from: InterestStars@334d41d581d939f6
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../harness/preview.ts';

type App = Awaited<ReturnType<typeof openApp>>;

const TIMEOUT = 180_000;

const EN = { starPrefix: 'Star ', limit: 'You can star up to 3 interests.' };
const DA = { starPrefix: 'Stjernemarkér ', limit: 'Du kan stjernemarkere op til 3 interesser.' };

// On the web the star's role is "togglebutton", which is no ARIA role, so it is found by its label.
function star(app: App, prefix: string, interest: string): Locator {
  return app.page.getByLabel(`${prefix}${interest}`, { exact: true });
}

/** Whether the star shows filled (a main interest) rather than as an outline. */
async function isFilled(button: Locator): Promise<boolean> {
  const fill = await button.locator('svg path').first().getAttribute('fill');
  return fill !== null && fill !== 'none';
}

async function expectFilled(app: App, prefix: string, interest: string, filled: boolean): Promise<void> {
  const button = star(app, prefix, interest);
  await button.waitFor({ state: 'visible' });
  // The star is redrawn once the star call answers: wait for the drawing asked for.
  await button.locator(filled ? 'svg path:not([fill="none"])' : 'svg path[fill="none"]').first().waitFor({ state: 'attached' });
  expect(await isFilled(button)).toBe(filled);
}

async function starLabels(app: App, prefix: string): Promise<string[]> {
  const buttons = app.page.getByLabel(new RegExp(`^${prefix}`));
  await buttons.first().waitFor({ state: 'visible' });
  const labels: string[] = [];
  for (const button of await buttons.all()) {
    const label = (await button.getAttribute('aria-label')) ?? (await button.textContent()) ?? '';
    if (label.startsWith(prefix)) {
      labels.push(label.slice(prefix.length));
    }
  }
  return labels;
}

/** Brings the tab to exactly the given main interests, unstarring the others first to make room. */
async function setMainInterests(app: App, prefix: string, mains: string[]): Promise<void> {
  for (const interest of await starLabels(app, prefix)) {
    if (mains.includes(interest)) continue;
    const button = star(app, prefix, interest);
    if ((await button.count()) > 0 && (await isFilled(button))) {
      await button.click();
      await expectFilled(app, prefix, interest, false);
    }
  }
  for (const interest of mains) {
    const button = star(app, prefix, interest);
    await button.waitFor({ state: 'visible' });
    if (!(await isFilled(button))) {
      await button.click();
      await expectFilled(app, prefix, interest, true);
    }
  }
  for (const interest of mains) {
    await expectFilled(app, prefix, interest, true);
  }
}

test(
  'A fourth main interest is refused',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    await setMainInterests(app, EN.starPrefix, ['brætspil']);

    await star(app, EN.starPrefix, 'sourdough').click();
    await expectFilled(app, EN.starPrefix, 'sourdough', true);
    await star(app, EN.starPrefix, 'trail running').click();
    await expectFilled(app, EN.starPrefix, 'trail running', true);
    await expectFilled(app, EN.starPrefix, 'brætspil', true);
    await expectFilled(app, EN.starPrefix, 'sourdough', true);
    await expectFilled(app, EN.starPrefix, 'trail running', true);

    await star(app, EN.starPrefix, 'far på barsel').click();
    await app.page.getByText(EN.limit, { exact: true }).waitFor({ state: 'visible' });
    await expectFilled(app, EN.starPrefix, 'far på barsel', false);

    await app.saveScreen('a-fourth-main-interest-is-refused.png');
  },
  TIMEOUT,
);

test(
  'Unstarring makes room, and the message stays',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
    await setMainInterests(app, EN.starPrefix, ['brætspil', 'sourdough', 'trail running']);
    await star(app, EN.starPrefix, 'far på barsel').click();
    await app.page.getByText(EN.limit, { exact: true }).waitFor({ state: 'visible' });

    await star(app, EN.starPrefix, 'brætspil').click();
    await expectFilled(app, EN.starPrefix, 'brætspil', false);
    await star(app, EN.starPrefix, 'far på barsel').click();

    await expectFilled(app, EN.starPrefix, 'far på barsel', true);
    await expectFilled(app, EN.starPrefix, 'brætspil', false);
    await expect(app.page.getByText(EN.limit, { exact: true }).isVisible()).resolves.toBe(true);

    await app.saveScreen('unstarring-makes-room-and-the-message-stays.png');
  },
  TIMEOUT,
);

test(
  'The star limit in Danish',
  async () => {
    await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'da' });
    await setMainInterests(app, DA.starPrefix, ['brætspil']);

    await star(app, DA.starPrefix, 'sourdough').click();
    await expectFilled(app, DA.starPrefix, 'sourdough', true);
    await star(app, DA.starPrefix, 'trail running').click();
    await expectFilled(app, DA.starPrefix, 'trail running', true);
    await star(app, DA.starPrefix, 'far på barsel').click();

    await app.page.getByText(DA.limit, { exact: true }).waitFor({ state: 'visible' });
    await expect(app.page.getByText(DA.limit, { exact: true }).isVisible()).resolves.toBe(true);

    await app.saveScreen('the-star-limit-in-danish.png');
  },
  TIMEOUT,
);
