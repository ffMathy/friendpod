// ail-derived-from: ExtraPlanningRound@04ff3f1688e81573
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/plan';
const WORLD = 'member in the extra planning round';

/** Collapses runs of whitespace so text the screen composes from parts can be compared as one line. */
function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

test('The extra round asks for another option', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'en' });
  const page = app.page;

  const title = page.getByText('No time works yet — add another option', { exact: true });
  await title.waitFor({ state: 'visible' });
  expect(await title.isVisible()).toBe(true);

  const bodyText = normalize(await page.locator('body').innerText());

  // Voting closes line, at the moved deadline.
  expect(bodyText).toContain('Voting closes Wednesday 18:00');

  // The banner body, with the moved deadline.
  expect(bodyText).toContain(
    'You have one more day, until Wednesday 18:00. If no option gets 3 yes votes by then, the pod ends.',
  );

  // Saturday leads with 2 yes, as the earlier of two options with 2 yes.
  const saturdayLeading = page
    .locator('div')
    .filter({ hasText: 'Saturday 21 Nov, 14:00' })
    .filter({ hasNotText: 'Sunday 22 Nov, 11:00' })
    .filter({ hasText: 'Leading' });
  const saturdayCount = await saturdayLeading.count();
  expect(saturdayCount).toBeGreaterThan(0);
  const saturdayCard = saturdayLeading.last();
  const saturdayText = normalize((await saturdayCard.textContent()) ?? '');
  expect(saturdayText).toMatch(/2\s*yes/i);

  const sundayLeading = page
    .locator('div')
    .filter({ hasText: 'Sunday 22 Nov, 11:00' })
    .filter({ hasNotText: 'Saturday 21 Nov, 14:00' })
    .filter({ hasText: 'Leading' });
  expect(await sundayLeading.count()).toBe(0);

  // Suggest another time can be pressed.
  const suggest = page.getByRole('button', { name: /Suggest another time\s*\(1 spot left\)/ });
  await suggest.waitFor({ state: 'visible' });
  expect(await suggest.isDisabled()).toBe(false);

  await app.saveScreen('the-extra-round-asks-for-another-option.png');
});

test('The extra round in Danish', async () => {
  await using app = await openApp({ route: ROUTE, world: WORLD, locale: 'da' });
  const page = app.page;

  const title = page.getByText('Intet tidspunkt passer endnu – tilføj et forslag mere', { exact: true });
  await title.waitFor({ state: 'visible' });
  expect(await title.isVisible()).toBe(true);

  const bodyText = normalize(await page.locator('body').innerText());
  expect(bodyText).toContain(
    'I har én dag mere, indtil onsdag kl. 18.00. Hvis intet forslag får 3 ja-stemmer inden da, stopper poden.',
  );

  await app.saveScreen('the-extra-round-in-danish.png');
});
