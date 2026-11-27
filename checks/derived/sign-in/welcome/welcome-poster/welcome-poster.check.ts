// ail-derived-from: WelcomePoster@8e33c451e868b51e
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

function normalize(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

async function visible(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible', timeout: 15_000 });
  expect(await locator.first().isVisible()).toBe(true);
}

async function headlineReads(page: Page, expected: string): Promise<void> {
  const heading = page.getByRole('heading', { level: 1 });
  const deadline = Date.now() + 15_000;
  let last = '';
  while (Date.now() < deadline) {
    if ((await heading.count()) > 0) {
      last = normalize(await heading.first().textContent());
      if (last === expected) {
        break;
      }
    }
    await page.waitForTimeout(100);
  }
  expect(last).toBe(expected);
}

async function languageSwitchOffers(page: Page, groupName: string): Promise<void> {
  const group = page.getByRole('radiogroup', { name: groupName, exact: true });
  await visible(group);
  await visible(group.getByRole('radio', { name: 'Dansk', exact: true }));
  await visible(group.getByRole('radio', { name: 'English', exact: true }));
  expect(await group.getByRole('radio').count()).toBe(2);
}

test(
  'The welcome in English',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    await visible(page.getByRole('img', { name: 'Friendpod', exact: true }));
    await visible(page.getByText('18+ only', { exact: true }));
    await headlineReads(page, 'Small groups. Real meetups.');
    await visible(page.getByText('There’s room for you.', { exact: true }));
    await languageSwitchOffers(page, 'Language');

    await app.saveScreen('the-welcome-in-english.png');
  },
  TIMEOUT,
);

test(
  'Switching the welcome to Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    await headlineReads(page, 'Small groups. Real meetups.');

    await page.getByRole('radio', { name: 'Dansk', exact: true }).click();
    await headlineReads(page, 'Små grupper. Rigtige møder.');
    await visible(page.getByText('Kun 18+', { exact: true }));
    await visible(page.getByText('Fortsæt med e-mail', { exact: true }));

    await page.getByRole('radio', { name: 'English', exact: true }).click();
    await headlineReads(page, 'Small groups. Real meetups.');

    await app.saveScreen('switching-the-welcome-to-danish.png');
  },
  TIMEOUT,
);

test(
  'The welcome in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'da' });
    const page = app.page;

    await visible(page.getByText('Kun 18+', { exact: true }));
    await headlineReads(page, 'Små grupper. Rigtige møder.');
    await visible(page.getByText('Der er plads til dig.', { exact: true }));
    await languageSwitchOffers(page, 'Sprog');

    await app.saveScreen('the-welcome-in-danish.png');
  },
  TIMEOUT,
);
