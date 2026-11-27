// ail-derived-from: FinalStepCards@ef4edcb69df2b303
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

test(
  'The cards before anything is chosen',
  async () => {
    await using app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale: 'en' });
    const page = app.page;

    const photoTitle = page.getByText('A photo, so your pod recognises you').first();
    await photoTitle.waitFor();
    expect(await photoTitle.isVisible()).toBe(true);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/A photo, so your pod recognises you\s*\(optional\)/);

    const addPhoto = page.getByRole('button', { name: 'Add a photo' });
    expect(await addPhoto.isVisible()).toBe(true);

    const notifTitle = page.getByText('Know when your drop arrives', { exact: true });
    expect(await notifTitle.isVisible()).toBe(true);
    const enable = page.getByRole('button', { name: 'Turn on notifications' });
    expect(await enable.isVisible()).toBe(true);

    const pledgeTitle = page.getByText('Our safety pledge', { exact: true });
    expect(await pledgeTitle.isVisible()).toBe(true);

    await app.saveScreen('the-cards-before-anything-is-chosen.png');
  },
  TIMEOUT,
);

test(
  'Turning on notifications',
  async () => {
    await using app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale: 'en' });
    const page = app.page;

    const enable = page.getByRole('button', { name: 'Turn on notifications' });
    await enable.waitFor();

    // The phone allows notifications when asked.
    await page.context().grantPermissions(['notifications']);
    await enable.click();

    const on = page.getByText('Notifications are on').first();
    await on.waitFor();
    expect(await on.isVisible()).toBe(true);

    await app.saveScreen('turning-on-notifications.png');
  },
  TIMEOUT,
);

test(
  'The cards in Danish',
  async () => {
    await using app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale: 'da' });
    const page = app.page;

    const photoTitle = page.getByText('Et billede, så din pod kan genkende dig').first();
    await photoTitle.waitFor();
    expect(await photoTitle.isVisible()).toBe(true);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toMatch(/Et billede, så din pod kan genkende dig\s*\(valgfrit\)/);

    const addPhoto = page.getByRole('button', { name: 'Tilføj billede' });
    expect(await addPhoto.isVisible()).toBe(true);

    const notifTitle = page.getByText('Få besked, når dit drop lander', { exact: true });
    expect(await notifTitle.isVisible()).toBe(true);
    const enable = page.getByRole('button', { name: 'Slå notifikationer til' });
    expect(await enable.isVisible()).toBe(true);

    const pledgeTitle = page.getByText('Vores sikkerhedsløfte', { exact: true });
    expect(await pledgeTitle.isVisible()).toBe(true);

    await app.saveScreen('the-cards-in-danish.png');
  },
  TIMEOUT,
);
