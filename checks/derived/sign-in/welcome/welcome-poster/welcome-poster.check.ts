// ail-derived-from: WelcomePoster@45b8a42590f67a24
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../../harness/preview';

/** The whitespace-normalised text of an element, so a headline split over two lines reads as one line. */
async function readText(locator: Locator): Promise<string> {
  const text = await locator.textContent();
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

test('The welcome in English', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
  const page = app.page;

  await expect(page.getByRole('img', { name: 'Friendpod' }).isVisible()).resolves.toBe(true);
  await expect(page.getByText('18+ only', { exact: true }).isVisible()).resolves.toBe(true);
  expect(await readText(page.getByRole('heading', { level: 1 }))).toBe('Small groups. Real meetups.');
  await expect(page.getByText('There’s room for you.', { exact: true }).isVisible()).resolves.toBe(true);

  const language = page.getByRole('radiogroup', { name: 'Language' });
  await expect(language.isVisible()).resolves.toBe(true);
  expect(await language.getByRole('radio').count()).toBe(2);
  await expect(language.getByRole('radio', { name: 'Dansk' }).isVisible()).resolves.toBe(true);
  await expect(language.getByRole('radio', { name: 'English' }).isVisible()).resolves.toBe(true);

  await app.saveScreen('the-welcome-in-english.png');
});

test('Switching the welcome to Danish', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
  const page = app.page;

  await page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'Dansk' }).click();

  const heading = page.getByRole('heading', { level: 1 });
  await page.waitForFunction(
    () => (document.querySelector('[role="heading"][aria-level="1"], h1')?.textContent ?? '').includes('Små grupper.'),
  );
  expect(await readText(heading)).toBe('Små grupper. Rigtige møder.');
  await expect(page.getByText('Kun 18+', { exact: true }).isVisible()).resolves.toBe(true);
  await expect(page.getByText('Fortsæt med e-mail', { exact: true }).isVisible()).resolves.toBe(true);

  await page.getByRole('radiogroup', { name: 'Sprog' }).getByRole('radio', { name: 'English' }).click();

  await page.waitForFunction(
    () => (document.querySelector('[role="heading"][aria-level="1"], h1')?.textContent ?? '').includes('Small groups.'),
  );
  expect(await readText(heading)).toBe('Small groups. Real meetups.');

  await app.saveScreen('switching-the-welcome-to-danish.png');
});

test('The welcome in Danish', async () => {
  await using app = await openApp({ route: '/', world: 'signed out', locale: 'da' });
  const page = app.page;

  await expect(page.getByText('Kun 18+', { exact: true }).isVisible()).resolves.toBe(true);
  expect(await readText(page.getByRole('heading', { level: 1 }))).toBe('Små grupper. Rigtige møder.');
  await expect(page.getByText('Der er plads til dig.', { exact: true }).isVisible()).resolves.toBe(true);

  const language = page.getByRole('radiogroup', { name: 'Sprog' });
  await expect(language.isVisible()).resolves.toBe(true);
  expect(await language.getByRole('radio').count()).toBe(2);
  await expect(language.getByRole('radio', { name: 'Dansk' }).isVisible()).resolves.toBe(true);
  await expect(language.getByRole('radio', { name: 'English' }).isVisible()).resolves.toBe(true);

  await app.saveScreen('the-welcome-in-danish.png');
});
