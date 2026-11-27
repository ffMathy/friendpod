// ail-derived-from: FinalStepAboutMe@c764808ec8658182
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../../harness/preview';

const ROUTE = '/almost-done';
const WORLD = 'member on the last onboarding step';

test('About me starts with what the profile holds', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;

  const field = page.getByRole('textbox', { name: 'About me (optional)' });
  await field.waitFor({ state: 'visible' });
  expect(await field.inputValue()).toBe('New in Aarhus, dad of a toddler, always up for a game');

  const body = await page.locator('body').innerText();
  expect(body).toContain('53 / 140');

  await app.saveScreen('about-me-starts-with-what-the-profile-holds.png');
});

test('Contact details are refused', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;

  const field = page.getByRole('textbox', { name: 'About me (optional)' });
  await field.waitFor({ state: 'visible' });

  // Given: the pledge is ticked (the safety pledge is the last checkbox on the step).
  const pledge = page.getByRole('checkbox').last();
  if (!(await isTicked(pledge))) {
    await pledge.click();
  }
  expect(await isTicked(pledge)).toBe(true);

  await field.fill('Call me on 12345678');

  const reason = page.getByText(
    "No contact details here: you haven't met yet. Share them in person if you like.",
    { exact: true },
  );
  await reason.waitFor({ state: 'visible' });
  expect(await reason.isVisible()).toBe(true);

  const finish = page.getByRole('button', { name: 'Finish' });
  expect(await finish.isDisabled()).toBe(true);

  await app.saveScreen('contact-details-are-refused.png');
});

test('About me in Danish', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
  const page = app.page;

  const field = page.getByRole('textbox', { name: 'Om mig (valgfrit)' });
  await field.waitFor({ state: 'visible' });
  expect(await field.inputValue()).toBe('Ny i Aarhus, far til en tumling og altid klar på et spil');

  const helper = page.getByText('Vises for medlemmerne af en bekræftet pod. Bruges ikke til matchning.', {
    exact: true,
  });
  expect(await helper.isVisible()).toBe(true);

  await app.saveScreen('about-me-in-danish.png');
});
