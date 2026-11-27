// ail-derived-from: SameGenderPods@28cb7c31a2264082
// End-to-end check of SameGenderPods (ail/me/pod-preferences/pod-preference-fields/same-gender-pods): each test is one
// of its scenarios, by name, played through the running app as a user would, with what the user sees: labels, roles
// and the copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, isTicked, openApp } from '../../../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const sheet = (page: Page) => page.getByRole('dialog');

/** Opens Pod preferences as this week's member and turns on same-gender pods, which opens the sheet. */
async function openSheet(locale: 'en' | 'da' = 'en') {
  const app = await openApp({ route: '/settings/preferences', world: 'member this week', locale });
  const name = locale === 'da' ? 'Kun pods med samme køn' : 'Same-gender pods only';
  await app.page.getByRole('switch', { name, exact: true }).click();
  await sheet(app.page).waitFor();
  return app;
}

test('Turning on asks for a gender first', async () => {
  await using app = await openSheet();
  const dialog = sheet(app.page);
  await dialog.getByRole('heading', { name: 'Same-gender pods', exact: true }).waitFor();
  const genders = dialog.getByRole('radiogroup', { name: 'Your gender' });
  for (const name of ['Woman', 'Man', 'Non-binary']) expect(await genders.getByRole('radio', { name, exact: true }).count()).toBe(1);
  await dialog.getByText('Pick your gender to see how we use it.', { exact: true }).waitFor();
  expect(await dialog.getByRole('button', { name: 'Turn on same-gender pods', exact: true }).isDisabled()).toBe(true);
});

test('The consent box must be ticked', async () => {
  await using app = await openSheet();
  const dialog = sheet(app.page);
  await dialog.getByRole('radio', { name: 'Man', exact: true }).click();
  await dialog.getByText(/^To give you same-gender pods we need to know your gender\./).waitFor();
  const consent = dialog.getByRole('checkbox', { name: 'I consent to Friendpod using my gender to form same-gender pods.', exact: true });
  expect(await isTicked(consent)).toBe(false);
  const turnOn = dialog.getByRole('button', { name: 'Turn on same-gender pods', exact: true });
  expect(await turnOn.isDisabled()).toBe(true);
  await consent.click();
  expect(await isTicked(consent)).toBe(true);
  await turnOn.click();
  await sheet(app.page).waitFor({ state: 'detached' });
});

test('Cancel closes the sheet', async () => {
  await using app = await openSheet();
  const dialog = sheet(app.page);
  // The sheet has two ways to cancel: the cross at its title and the Cancel button under its actions.
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await sheet(app.page).waitFor({ state: 'detached' });
  expect(await app.page.getByRole('heading', { name: 'Pod preferences', exact: true }).isVisible()).toBe(true);
});

test('In Danish, the non-binary text is only in English', async () => {
  await using app = await openSheet('da');
  const dialog = sheet(app.page);
  await dialog.getByRole('radio', { name: 'Nonbinær', exact: true }).click();
  await dialog.getByText(/^To give you same-gender pods we need to know your gender\./).waitFor();
  await dialog
    .getByText(
      'Same-gender pods for non-binary people may be rare in your area, and their members will know that everyone in the pod is non-binary.',
      { exact: true },
    )
    .waitFor();
  await dialog.getByText('Denne tekst findes indtil videre kun på engelsk.', { exact: true }).waitFor();
});
