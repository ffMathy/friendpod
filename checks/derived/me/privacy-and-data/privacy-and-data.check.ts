// ail-derived-from: PrivacyAndData@6b5347d1cb08a621
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 15_000;

async function visible(locator: Locator): Promise<Locator> {
  await locator.waitFor({ state: 'visible', timeout: TIMEOUT });
  return locator;
}

async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box === null ? 0 : box.y;
}

function meTab(page: Page): Locator {
  return page.getByRole('tab', { name: 'Me', exact: true }).or(page.getByRole('link', { name: 'Me', exact: true }));
}

function normalized(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

test('Privacy opens on what you have agreed to and your data', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const page = app.page;

  const title = await visible(page.getByText('Privacy', { exact: true }).first());
  // The Me eyebrow over the title is plain text, not a way back.
  const eyebrow = page.getByText('Me', { exact: true }).first();
  await visible(eyebrow);
  expect(await page.getByRole('button', { name: 'Back: Me' }).count()).toBe(0);
  expect(await topOf(eyebrow)).toBeLessThan(await topOf(title));

  const agreed = await visible(page.getByText(/What you['’]ve agreed to/).first());
  const data = await visible(page.getByText('Your data and matching', { exact: true }).first());
  const deleteButton = await visible(page.getByRole('button', { name: 'Delete account' }));
  const agreedTop = await topOf(agreed);
  const dataTop = await topOf(data);
  const deleteTop = await topOf(deleteButton);
  expect(agreedTop).toBeLessThan(dataTop);
  expect(dataTop).toBeLessThan(deleteTop);

  const complaint = await visible(page.getByText(/Unhappy with how we handle your data\?/).first());
  expect(normalized(await complaint.textContent())).toContain(
    'Unhappy with how we handle your data? You can complain to the Danish Data Protection Agency (datatilsynet.dk)',
  );
  expect(await topOf(complaint)).toBeGreaterThan(deleteTop);
  await visible(page.getByRole('link', { name: 'datatilsynet.dk' }));

  await visible(meTab(page).first());

  await app.saveScreen('privacy-opens-on-what-you-have-agreed-to-and-your-data.png');
});

test('Coming from Me, Me leads back', async () => {
  await using app = await openApp({ route: '/me', world: 'member in privacy settings', locale: 'en' });
  const page = app.page;

  await (await visible(page.getByText('Privacy', { exact: true }).first())).click();

  const back = await visible(page.getByRole('button', { name: 'Back: Me' }));
  await back.click();

  await page.getByRole('button', { name: 'Back: Me' }).waitFor({ state: 'hidden', timeout: TIMEOUT });
  await page.waitForURL(/\/me(\?|#|$)/, { timeout: TIMEOUT });
  await visible(page.getByText('Privacy', { exact: true }).first());

  await app.saveScreen('coming-from-me-me-leads-back.png');
});

test('Delete account opens the delete screen', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
  const page = app.page;

  await (await visible(page.getByRole('button', { name: 'Delete account' }))).click();
  await visible(page.getByText('Delete your account?').first());

  await app.saveScreen('delete-account-opens-the-delete-screen.png');
});

test('Privacy in Danish', async () => {
  await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'da' });
  const page = app.page;

  await visible(page.getByText('Mig', { exact: true }).first());
  await visible(page.getByText('Privatliv', { exact: true }).first());
  await visible(page.getByText('Det har du sagt ja til', { exact: true }).first());
  await visible(page.getByText('Dine data og matchning', { exact: true }).first());
  const deleteButton = await visible(page.getByRole('button', { name: 'Slet konto' }));

  const complaint = await visible(page.getByText(/Utilfreds med, hvordan vi behandler dine data\?/).first());
  expect(normalized(await complaint.textContent())).toContain(
    'Utilfreds med, hvordan vi behandler dine data? Du kan klage til Datatilsynet (datatilsynet.dk).',
  );
  expect(await topOf(complaint)).toBeGreaterThan(await topOf(deleteButton));

  await app.saveScreen('privacy-in-danish.png');
});
