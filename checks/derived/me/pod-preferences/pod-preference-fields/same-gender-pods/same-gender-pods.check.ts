// ail-derived-from: SameGenderPods@37b5fec124f6ccb0
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../../../harness/preview';

const TIMEOUT = 180_000;
const ROUTE = '/settings/preferences';
const WORLD = 'member this week';

type App = Awaited<ReturnType<typeof openApp>>;

async function openSheet(app: App, switchName: string | RegExp): Promise<void> {
  const toggle = app.page.getByRole('switch', { name: switchName });
  await toggle.waitFor({ state: 'visible' });
  await toggle.click();
  await app.page.getByRole('dialog').waitFor({ state: 'visible' });
}

test(
  'Turning on asks for a gender first',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    await openSheet(app, 'Same-gender pods only');

    const dialog = app.page.getByRole('dialog');
    await dialog.getByText('Same-gender pods', { exact: true }).waitFor({ state: 'visible' });

    const genders = dialog.getByRole('radiogroup', { name: 'Your gender' });
    await genders.getByRole('radio', { name: 'Woman', exact: true }).waitFor({ state: 'visible' });
    await genders.getByRole('radio', { name: 'Man', exact: true }).waitFor({ state: 'visible' });
    await genders.getByRole('radio', { name: 'Non-binary', exact: true }).waitFor({ state: 'visible' });

    const dialogText = (await dialog.textContent()) ?? '';
    expect(dialogText).toContain('Pick your gender to see how we use it.');

    const confirm = dialog.getByRole('button', { name: 'Turn on same-gender pods' });
    await confirm.waitFor({ state: 'visible' });
    expect(await confirm.isDisabled()).toBe(true);

    await app.saveScreen('turning-on-asks-for-a-gender-first.png');
  },
  TIMEOUT,
);

test(
  'The consent box must be ticked',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    await openSheet(app, 'Same-gender pods only');

    const dialog = app.page.getByRole('dialog');
    const genders = dialog.getByRole('radiogroup', { name: 'Your gender' });
    await genders.getByRole('radio', { name: 'Man', exact: true }).click();

    const box = dialog.getByRole('checkbox', {
      name: 'I consent to Friendpod using my gender to form same-gender pods.',
    });
    await box.waitFor({ state: 'visible' });

    const dialogText = (await dialog.textContent()) ?? '';
    expect(dialogText).toContain('To give you same-gender pods we need to know your gender.');

    expect(await isTicked(box)).toBe(false);
    const confirm = dialog.getByRole('button', { name: 'Turn on same-gender pods' });
    expect(await confirm.isDisabled()).toBe(true);

    await box.click();
    await confirm.click();

    await app.page.getByRole('dialog').waitFor({ state: 'hidden' });

    await app.saveScreen('the-consent-box-must-be-ticked.png');
  },
  TIMEOUT,
);

test(
  'Cancel closes the sheet',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
    await openSheet(app, 'Same-gender pods only');

    await app.page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();

    await app.page.getByRole('dialog').waitFor({ state: 'hidden' });
    await app.page.getByRole('switch', { name: 'Same-gender pods only' }).waitFor({ state: 'visible' });

    await app.saveScreen('cancel-closes-the-sheet.png');
  },
  TIMEOUT,
);

test(
  'In Danish, the non-binary text is only in English',
  async () => {
    await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
    await openSheet(app, /samme køn/i);

    const dialog = app.page.getByRole('dialog');
    const genders = dialog.getByRole('radiogroup', { name: 'Dit køn' });
    await genders.getByRole('radio', { name: 'Nonbinær', exact: true }).click();

    await dialog.getByRole('checkbox').first().waitFor({ state: 'visible' });

    const dialogText = (await dialog.textContent()) ?? '';
    expect(dialogText).toContain(
      'Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary.',
    );
    expect(dialogText).toContain('Denne tekst findes indtil videre kun på engelsk.');

    await app.saveScreen('in-danish-the-non-binary-text-is-only-in-english.png');
  },
  TIMEOUT,
);
