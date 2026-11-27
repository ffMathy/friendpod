// ail-derived-from: PrivacyAgreements@2f8768d951180689
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview.ts';

type Page = Awaited<ReturnType<typeof openApp>>['page'];

const TIMEOUT = 180_000;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The row of the agreements card whose label starts its accessible name. */
function agreementRow(page: Page, label: string) {
  // The rows are links on the web.
  return page.getByRole('link', { name: new RegExp(`^\\s*${escapeRegExp(label)}`) }).first();
}

/** The whole text of a row: its label and its state, which sit in separate elements. */
async function rowText(page: Page, label: string): Promise<string> {
  const row = agreementRow(page, label);
  await row.waitFor({ state: 'visible' });
  return (await row.textContent()) ?? '';
}

test(
  'The agreements of a member with private-interest consent',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    await page.getByText("What you've agreed to", { exact: false }).first().waitFor({ state: 'visible' });

    const privateRow = await rowText(page, 'Private interests');
    expect(privateRow).toContain('Private interests');
    expect(privateRow).toContain('1 interest, consent given');

    const sameGenderRow = await rowText(page, 'Same-gender pods');
    expect(sameGenderRow).toContain('Same-gender pods');
    expect(sameGenderRow).toContain('Off, no gender stored');

    const photoRow = await rowText(page, 'Photo');
    expect(photoRow).toContain('Photo');
    expect(photoRow).toContain('Shown to confirmed pods');

    await app.saveScreen('the-agreements-of-a-member-with-private-interest-consent.png');
  },
  TIMEOUT,
);

test(
  'Without private-interest consent nothing sensitive is saved',
  async () => {
    await using app = await openApp({
      route: '/settings/privacy',
      world: 'member without private-interest consent',
      locale: 'en',
    });
    const page = app.page;

    const privateRow = await rowText(page, 'Private interests');
    expect(privateRow).toContain('Private interests');
    expect(privateRow).toContain('Not given, so nothing sensitive is saved');

    await app.saveScreen('without-private-interest-consent-nothing-sensitive-is-saved.png');
  },
  TIMEOUT,
);

test(
  'Private interests opens the private-interest consent',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const row = agreementRow(page, 'Private interests');
    await row.waitFor({ state: 'visible' });
    await row.click();

    await page.getByText('Sensitive interests', { exact: true }).first().waitFor({ state: 'visible' });
    // The date is written with no-break spaces.
    await page.getByText(/You agreed on 4\sNov\s2026\./).first().waitFor({ state: 'visible' });

    await app.saveScreen('private-interests-opens-the-private-interest-consent.png');
  },
  TIMEOUT,
);

test(
  'Same-gender pods opens the pod preferences',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const row = agreementRow(page, 'Same-gender pods');
    await row.waitFor({ state: 'visible' });
    await row.click();

    await page.getByText('Pod preferences', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Same-gender pods only', { exact: true }).first().waitFor({ state: 'visible' });

    await app.saveScreen('same-gender-pods-opens-the-pod-preferences.png');
  },
  TIMEOUT,
);

test(
  'Photo opens Me',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
    const page = app.page;

    const row = agreementRow(page, 'Photo');
    await row.waitFor({ state: 'visible' });
    await row.click();

    await page.getByText('Change photo', { exact: true }).first().waitFor({ state: 'visible' });

    await app.saveScreen('photo-opens-me.png');
  },
  TIMEOUT,
);

test(
  'The agreements in Danish',
  async () => {
    await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'da' });
    const page = app.page;

    const privateRow = await rowText(page, 'Private interesser');
    expect(privateRow).toContain('Private interesser');
    expect(privateRow).toContain('1 interesse, samtykke givet');

    const sameGenderRow = await rowText(page, 'Pods med samme køn');
    expect(sameGenderRow).toContain('Pods med samme køn');
    expect(sameGenderRow).toContain('Fra – vi gemmer ikke dit køn');

    const photoRow = await rowText(page, 'Billede');
    expect(photoRow).toContain('Billede');
    expect(photoRow).toContain('Vises for bekræftede pods');

    await app.saveScreen('the-agreements-in-danish.png');
  },
  TIMEOUT,
);
