// ail-derived-from: InfoHowMatchingWorks@d5a04791dac42bf7
import { expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 300_000;

/** Reads the whole visible text of the page, so texts split across elements are seen as one. */
async function pageText(page: { locator: (selector: string) => { innerText: () => Promise<string> } }): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/\s+/g, ' ');
}

test(
  'The page says what is used and what never is',
  async () => {
    await using app = await openApp({ route: '/info/how-matching-works', world: 'member this week', locale: 'en' });
    const page = app.page;

    await page.getByRole('heading', { name: 'How matching works' }).first().waitFor({ state: 'visible' });

    const text = await pageText(page);

    // The lede
    expect(text).toContain(
      'Every Thursday we put together pods of 4–6 people near you who share an interest. ' +
        'This is what decides who you meet.',
    );

    // What we use
    expect(text).toContain('What we use');
    expect(text).toContain('Your interests');
    expect(text).toContain('Your approximate area (a map cell)');
    expect(text).toContain('Your birth year and the age range you chose');
    expect(text).toContain("How far you'll travel, your meetup languages and when you're free");
    expect(text).toContain('How reliably you show up');

    // Meet again: a pair can be matched again after 4 weeks
    expect(text).toContain(
      'Your “Meet again” answers: if you both say yes, you can be matched again after 4 weeks; ' +
        'if either says no, never again. Nobody sees your answer.',
    );

    // What we never use
    expect(text).toContain('What we never use');
    expect(text).toContain(
      'Photos, your “About me”, or anything we infer about you. ' +
        'We use your gender only if you have turned on “Same-gender pods only”.',
    );

    // Private interests
    expect(text).toContain('Private interests');
    expect(text).toContain(
      'Private interests are only used if you have agreed to sensitive interests, ' +
        'only as the theme of a pod whose members all added them, ' +
        'and only after your account is 14 days old and you have attended a meetup.',
    );

    await app.saveScreen('the-page-says-what-is-used-and-what-never-is.png');
  },
  TIMEOUT,
);

test(
  'How matching works in Danish',
  async () => {
    await using app = await openApp({ route: '/info/how-matching-works', world: 'member this week', locale: 'da' });
    const page = app.page;

    await page.getByRole('heading', { name: 'Sådan matcher vi' }).first().waitFor({ state: 'visible' });

    const text = await pageText(page);

    expect(text).toContain('Sådan matcher vi');
    expect(text).toContain('Det bruger vi');
    expect(text).toContain('Det bruger vi aldrig');
    expect(text).toContain('Private interesser');
    expect(text).toContain('Sæt matchning på pause');

    // The Meet again line
    expect(text).toContain('kan I blive matchet igen efter 4 uger');

    await app.saveScreen('how-matching-works-in-danish.png');
  },
  TIMEOUT,
);
