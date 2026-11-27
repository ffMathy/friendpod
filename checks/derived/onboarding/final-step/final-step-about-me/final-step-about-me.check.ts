// ail-derived-from: FinalStepAboutMe@ce4bfc40b0e915e3
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../../harness/preview';

const WORLD = 'member on the last onboarding step';

test('About me starts with what the profile holds', async () => {
  await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
  const page = app.page;

  const aboutMe = page.getByRole('textbox', { name: 'About me (optional)' });
  await aboutMe.waitFor({ state: 'visible' });

  expect(await aboutMe.inputValue()).toBe('New in Aarhus, dad of a toddler, always up for a game');
  await page.getByText('53 / 140', { exact: true }).waitFor({ state: 'visible' });
  expect(await page.getByText('53 / 140', { exact: true }).count()).toBeGreaterThan(0);

  await app.saveScreen('about-me-starts-with-what-the-profile-holds.png');
});

test('Contact details are refused', async () => {
  await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
  const page = app.page;

  const aboutMe = page.getByRole('textbox', { name: 'About me (optional)' });
  await aboutMe.waitFor({ state: 'visible' });

  const pledge = page.getByRole('checkbox');
  expect(await pledge.count()).toBe(1);
  if (!(await isTicked(pledge))) {
    await pledge.click();
  }
  expect(await isTicked(pledge)).toBe(true);

  await aboutMe.fill('Call me on 12345678');

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
  await using app = await openApp({ route: '/', world: WORLD, locale: 'da' });
  const page = app.page;

  const aboutMe = page.getByRole('textbox', { name: 'Om mig (valgfrit)' });
  await aboutMe.waitFor({ state: 'visible' });

  expect(await aboutMe.inputValue()).toBe('Ny i Aarhus, far til en tumling og altid klar på et spil');

  const helper = page.getByText('Vises for medlemmerne af en bekræftet pod. Bruges ikke til matchning.', {
    exact: true,
  });
  await helper.waitFor({ state: 'visible' });
  expect(await helper.isVisible()).toBe(true);

  await app.saveScreen('about-me-in-danish.png');
});
