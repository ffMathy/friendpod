// ail-derived-from: PodPreferenceFields@f6353012f41a8b9a
import { expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../../harness/preview.ts';

const ROUTE = '/settings/preferences';

test('One distance at a time', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
  const page = app.page;

  const group = page.getByRole('radiogroup', { name: 'How far would you travel?' });
  await expect(group.isVisible()).resolves.toBe(true);

  const km25 = group.getByRole('radio', { name: 'about 25 km', exact: true });
  const km10 = group.getByRole('radio', { name: 'about 10 km', exact: true });

  await km25.click();

  expect(await isTicked(km25)).toBe(true);
  expect(await isTicked(km10)).toBe(false);

  await app.saveScreen('one-distance-at-a-time.png');
}, 120_000);

test('Meetup languages are ticked one by one', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
  const page = app.page;

  const danish = page.getByRole('checkbox', { name: 'Danish', exact: true });
  const english = page.getByRole('checkbox', { name: 'English', exact: true });

  await danish.click();

  expect(await isTicked(danish)).toBe(false);
  expect(await isTicked(english)).toBe(true);

  await app.saveScreen('meetup-languages-are-ticked-one-by-one.png');
}, 120_000);

test('Open to meeting anyone is offered here', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
  const page = app.page;

  const openToAnyone = page.getByRole('switch', { name: 'Open to meeting anyone' });
  await openToAnyone.waitFor({ state: 'visible' });
  expect(await openToAnyone.isVisible()).toBe(true);
  const openHint = page.getByText(
    'If no interest fits, you can be matched with nearby people without a shared theme.',
    { exact: true },
  );
  expect(await openHint.isVisible()).toBe(true);

  const sameGender = page.getByRole('switch', { name: 'Same-gender pods only' });
  expect(await sameGender.isVisible()).toBe(true);
  const sameGenderHint = page.getByText('We\'ll ask for your gender and your consent, and use it only for this.', {
    exact: true,
  });
  expect(await sameGenderHint.isVisible()).toBe(true);

  await app.saveScreen('open-to-meeting-anyone-is-offered-here.png');
}, 120_000);
