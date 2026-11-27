// ail-derived-from: InfoAutomaticPauses@7916e492688add3d
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/info/how-matching-works';
const TIMEOUT = 180_000;

/** Collapses runs of whitespace so text split across lines or elements compares as one string. */
const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Returns the index of `needle` in `haystack` at or after `from`, failing the test when it is absent. */
const indexAfter = (haystack: string, needle: string, from: number): number => {
  const index = haystack.indexOf(needle, from);
  expect({ needle, found: index >= 0 }).toEqual({ needle, found: true });
  return index;
};

test(
  'Every pause is listed with its length',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
    const heading = app.page.getByText('Automatic pauses', { exact: true }).first();
    await heading.waitFor();
    await app.page.getByText('No person reviews these decisions', { exact: true }).first().waitFor();

    const text = normalize(await app.page.locator('body').innerText());

    let at = indexAfter(text, 'Automatic pauses', 0);
    at = indexAfter(
      text,
      'Two independent reports within 30 days, or one safety report: no drops for 28 days.',
      at,
    );
    at = indexAfter(
      text,
      'A report marked “May be under 18”: no drops for 28 days. A new such report from another pod starts it again.',
      at,
    );
    at = indexAfter(
      text,
      'Two missed meetups within 8 weeks: a 2-week pause. Three: no drops for 8 weeks.',
      at,
    );
    indexAfter(
      text,
      'A report marked “Not a genuine member”: no pods about private interests for 28 days.',
      at,
    );

    const review = indexAfter(text, 'No person reviews these decisions', 0);
    indexAfter(
      text,
      "Nobody reads reports or what's written in them, and nobody is banned for good.",
      review,
    );

    await heading.scrollIntoViewIfNeeded();
    await app.saveScreen('every-pause-is-listed-with-its-length.png');
  },
  TIMEOUT,
);

test(
  'The pauses in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'da' });
    const heading = app.page.getByText('Automatiske pauser', { exact: true }).first();
    await heading.waitFor();
    await app.page.getByText('Ingen mennesker gennemgår afgørelserne', { exact: true }).first().waitFor();

    const text = normalize(await app.page.locator('body').innerText());

    const pauses = indexAfter(text, 'Automatiske pauser', 0);
    const noShow = indexAfter(
      text,
      'To udeblivelser inden for 8 uger: 2 ugers pause. Tre: ingen drops i 8 uger.',
      pauses,
    );
    indexAfter(text, '»Kan være under 18«', pauses);
    const notGenuine = indexAfter(text, '»Ikke et ægte medlem«', pauses);

    const lastCard = indexAfter(text, 'Ingen mennesker gennemgår afgørelserne', Math.max(noShow, notGenuine));
    expect(lastCard).toBeGreaterThan(pauses);

    await heading.scrollIntoViewIfNeeded();
    await app.saveScreen('the-pauses-in-danish.png');
  },
  TIMEOUT,
);
