// ail-derived-from: Onboarding@6c68a77d9fe44adf
import { expect, test } from 'bun:test';
import { openApp } from '../../harness/preview';

type Page = Awaited<ReturnType<typeof openApp>>['page'];

const TIMEOUT = 180_000;

/** Waits until the exact text is visible on the page. */
async function shows(page: Page, text: string): Promise<void> {
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'visible' });
}

/** Counts the buttons with the given accessible name that are visible. */
async function visibleButtons(page: Page, name: string): Promise<number> {
  const buttons = page.getByRole('button', { name, exact: true });
  const count = await buttons.count();
  let visible = 0;
  for (let i = 0; i < count; i += 1) {
    if (await buttons.nth(i).isVisible()) {
      visible += 1;
    }
  }
  return visible;
}

test(
  'A new member starts at About you',
  async () => {
    await using app = await openApp({ route: '/', world: 'new member', locale: 'en' });
    await shows(app.page, 'Step 1 of 6');
    await shows(app.page, 'About you');
    await app.saveScreen('a-new-member-starts-at-about-you.png');
  },
  TIMEOUT,
);

test(
  'A member who sent the basics resumes at the interests',
  async () => {
    await using app = await openApp({
      route: '/',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    await shows(app.page, 'Step 4 of 6');
    await shows(app.page, 'What are you into?');
    await app.saveScreen('a-member-who-sent-the-basics-resumes-at-the-interests.png');
  },
  TIMEOUT,
);

test(
  'Back from resumed interests opens the private-interests step',
  async () => {
    await using app = await openApp({
      route: '/',
      world: 'member choosing about private interests',
      locale: 'en',
    });
    const page = app.page;
    await shows(page, 'What are you into?');

    await page.getByRole('button', { name: 'Back', exact: true }).first().click();
    await shows(page, 'Step 3 of 6');
    await shows(page, 'Sensitive interests');
    expect(await visibleButtons(page, 'Back')).toBe(0);

    await page.getByRole('button', { name: 'Not now', exact: true }).first().click();
    await shows(page, 'What are you into?');
    await app.saveScreen('back-from-resumed-interests-opens-the-private-interests-step.png');
  },
  TIMEOUT,
);

test(
  'Resuming in Danish',
  async () => {
    await using app = await openApp({
      route: '/',
      world: 'member choosing about private interests',
      locale: 'da',
    });
    await shows(app.page, 'Trin 4 af 6');
    await shows(app.page, 'Hvad går du op i?');
    await app.saveScreen('resuming-in-danish.png');
  },
  TIMEOUT,
);
