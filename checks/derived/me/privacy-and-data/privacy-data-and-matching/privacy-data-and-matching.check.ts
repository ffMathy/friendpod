// ail-derived-from: PrivacyDataAndMatching@2b01918420dca0e7
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

test(
  'Pausing matching says from which week',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const pause = page.getByRole('button', { name: /Pause matching/ });
    await pause.waitFor({ state: 'visible' });
    expect(await pause.textContent()).toContain('Skip drops until you come back');

    await pause.click();

    await page.getByText('Applies from week 2026-W46').first().waitFor({ state: 'visible' });
    expect(await pause.textContent()).toContain('Applies from week 2026-W46');

    await app.saveScreen('pausing-matching-says-from-which-week.png');
  },
  TIMEOUT,
);

test(
  'Blocked people counts whom the member blocked',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const blocked = page.getByRole('link', { name: /Blocked people/ });
    await blocked.waitFor({ state: 'visible' });
    const text = (await blocked.textContent()) ?? '';
    expect(text).toContain('1 person');
    expect(text).not.toContain('1 people');

    await app.saveScreen('blocked-people-counts-whom-the-member-blocked.png');
  },
  TIMEOUT,
);

test(
  'Nobody blocked',
  async () => {
    await using app = await openApp({
      route: '/settings/privacy',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;

    const blocked = page.getByRole('link', { name: /Blocked people/ });
    await blocked.waitFor({ state: 'visible' });
    expect(await blocked.textContent()).toContain('Nobody');

    await app.saveScreen('nobody-blocked.png');
  },
  TIMEOUT,
);

test(
  'Blocked people opens the list',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const blocked = page.getByRole('link', { name: /Blocked people/ });
    await blocked.waitFor({ state: 'visible' });
    await blocked.click();

    await page.getByText('Rasmus').first().waitFor({ state: 'visible' });
    expect(page.url()).not.toMatch(/\/settings\/privacy\/?(\?.*)?$/);

    await app.saveScreen('blocked-people-opens-the-list.png');
  },
  TIMEOUT,
);

test(
  'How matching works opens its page',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const how = page.getByRole('link', { name: /How matching works/ });
    await how.waitFor({ state: 'visible' });
    await how.click();

    await page.getByText('What we use').first().waitFor({ state: 'visible' });
    expect(page.url()).not.toMatch(/\/settings\/privacy\/?(\?.*)?$/);
    expect(await page.getByText('How matching works').count()).toBeGreaterThan(0);

    await app.saveScreen('how-matching-works-opens-its-page.png');
  },
  TIMEOUT,
);

test(
  'Your data and matching in Danish',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'da' });
    const page = app.page;

    const pause = page.getByRole('button', { name: /Sæt matchning på pause/ });
    await pause.waitFor({ state: 'visible' });
    expect(await pause.textContent()).toContain('Spring drops over, indtil du vender tilbage');

    const blocked = page.getByRole('link', { name: /Blokerede personer/ });
    await blocked.waitFor({ state: 'visible' });
    const blockedText = (await blocked.textContent()) ?? '';
    expect(blockedText).toContain('1 person');
    expect(blockedText).not.toContain('1 personer');

    await page.getByRole('link', { name: /Sådan matcher vi/ }).waitFor({ state: 'visible' });

    await pause.click();

    await page.getByText('Gælder fra uge 2026-W46').first().waitFor({ state: 'visible' });
    expect(await pause.textContent()).toContain('Gælder fra uge 2026-W46');

    await app.saveScreen('your-data-and-matching-in-danish.png');
  },
  TIMEOUT,
);
