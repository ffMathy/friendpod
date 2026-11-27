// ail-derived-from: Onboarding@24a321459ab6bac4
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../harness/preview';

const TIMEOUT = 180_000;

/** Waits until a visible element reads exactly `text`, and reports whether one does. */
async function shows(page: Page, text: string): Promise<boolean> {
  const locator = page.getByText(text, { exact: true }).locator('visible=true').first();
  try {
    await locator.waitFor({ state: 'visible', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

test(
  'A new member starts at About you',
  async () => {
    await using app = await openApp({ route: '/', world: 'new member', locale: 'en' });
    expect(await shows(app.page, 'Step 1 of 6')).toBe(true);
    expect(await shows(app.page, 'About you')).toBe(true);
    await app.saveScreen('a-new-member-starts-at-about-you.png');
  },
  TIMEOUT,
);

test(
  'A member who sent the basics resumes at the interests',
  async () => {
    await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'en' });
    expect(await shows(app.page, 'Step 4 of 6')).toBe(true);
    expect(await shows(app.page, 'What are you into?')).toBe(true);
    await app.saveScreen('a-member-who-sent-the-basics-resumes-at-the-interests.png');
  },
  TIMEOUT,
);

test(
  'Back from resumed interests opens the private-interests step',
  async () => {
    await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'en' });
    const page = app.page;
    expect(await shows(page, 'What are you into?')).toBe(true);

    await page.getByRole('button', { name: 'Back', exact: true }).click();

    expect(await shows(page, 'Step 3 of 6')).toBe(true);
    expect(await shows(page, 'Sensitive interests')).toBe(true);
    await page.getByRole('button', { name: 'Not now', exact: true }).waitFor({ state: 'visible' });
    expect(await page.getByRole('button', { name: 'Back', exact: true }).count()).toBe(0);

    await page.getByRole('button', { name: 'Not now', exact: true }).click();

    expect(await shows(page, 'What are you into?')).toBe(true);
    expect(await shows(page, 'Step 4 of 6')).toBe(true);
    await app.saveScreen('back-from-resumed-interests-opens-the-private-interests-step.png');
  },
  TIMEOUT,
);

test(
  'Resuming in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'member choosing about private interests', locale: 'da' });
    expect(await shows(app.page, 'Trin 4 af 6')).toBe(true);
    expect(await shows(app.page, 'Hvad går du op i?')).toBe(true);
    await app.saveScreen('resuming-in-danish.png');
  },
  TIMEOUT,
);
