// ail-derived-from: InfoLegalText@baa74ba3f043bf02
import { describe, expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../harness/preview';

type Box = { x: number; y: number; width: number; height: number };

/** The first visible element showing exactly this text, waited for. */
async function shown(app: { page: import('playwright').Page }, text: string): Promise<Locator> {
  const locator = app.page.getByText(text, { exact: true }).filter({ visible: true }).first();
  await locator.waitFor({ state: 'visible' });
  return locator;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('element has no bounding box');
  }
  return box;
}

describe('InfoLegalText', () => {
  test('The Terms are marked as a draft', async () => {
    await using app = await openApp({ route: '/info/legal/terms', world: 'signed out', locale: 'en' });

    const title = await shown(app, 'Terms');
    const draft = await shown(app, 'Draft');
    const version = await shown(app, 'Version of November 2026');
    const body = await shown(
      app,
      'The Terms are being reviewed by our lawyer and will be published here before launch.',
    );

    const titleBox = await boxOf(title);
    const draftBox = await boxOf(draft);
    const versionBox = await boxOf(version);
    const bodyBox = await boxOf(body);

    // Draft and the version line sit under the title, the version after the pill.
    expect(draftBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
    expect(versionBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
    expect(versionBox.x).toBeGreaterThan(draftBox.x);
    // Then the text.
    expect(bodyBox.y).toBeGreaterThanOrEqual(draftBox.y + draftBox.height - 1);
    expect(bodyBox.y).toBeGreaterThanOrEqual(versionBox.y + versionBox.height - 1);

    await app.saveScreen('the-terms-are-marked-as-a-draft.png');
  });

  test('The privacy notice is marked as a draft', async () => {
    await using app = await openApp({ route: '/info/legal/privacy', world: 'signed out', locale: 'en' });

    const title = await shown(app, 'Privacy notice');
    const draft = await shown(app, 'Draft');
    const version = await shown(app, 'Version of November 2026');
    const body = await shown(
      app,
      'The layered privacy notice is being reviewed by our lawyer and will be published here before launch.',
    );

    const titleBox = await boxOf(title);
    const draftBox = await boxOf(draft);
    const versionBox = await boxOf(version);
    const bodyBox = await boxOf(body);

    expect(draftBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
    expect(versionBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);
    expect(bodyBox.y).toBeGreaterThanOrEqual(draftBox.y + draftBox.height - 1);
    expect(bodyBox.y).toBeGreaterThanOrEqual(versionBox.y + versionBox.height - 1);

    await app.saveScreen('the-privacy-notice-is-marked-as-a-draft.png');
  });

  test('The Terms in Danish', async () => {
    await using app = await openApp({ route: '/info/legal/terms', world: 'signed out', locale: 'da' });

    const title = await shown(app, 'Vilkår');
    const draft = await shown(app, 'Udkast');
    const version = await shown(app, 'Version fra november 2026');

    expect(await title.isVisible()).toBe(true);
    expect(await draft.isVisible()).toBe(true);
    expect(await version.isVisible()).toBe(true);

    await app.saveScreen('the-terms-in-danish.png');
  });

  test('A legal page that does not exist', async () => {
    await using app = await openApp({ route: '/info/legal/nope', world: 'signed out', locale: 'en' });

    const title = await shown(app, 'Legal');
    const message = await shown(app, 'This page does not exist.');

    expect(await title.isVisible()).toBe(true);
    expect(await message.isVisible()).toBe(true);

    await app.saveScreen('a-legal-page-that-does-not-exist.png');
  });
});
