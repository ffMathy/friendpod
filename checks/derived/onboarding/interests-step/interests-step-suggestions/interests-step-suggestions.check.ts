// ail-derived-from: InterestsStepSuggestions@e611543a3e3f6fe7
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

test(
  'Did you mean after a longer word',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
    const page = app.page;

    await page.getByRole('textbox').first().fill('brætspilsaften');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    const question = page
      .getByText('Did you mean brætspil by “brætspilsaften”? Saying yes puts you with more people.')
      .first();
    await question.waitFor({ state: 'visible' });
    const questionText = (await question.textContent()) ?? '';
    expect(questionText.replace(/\s+/g, ' ')).toContain(
      'Did you mean brætspil by “brætspilsaften”? Saying yes puts you with more people.',
    );

    const yes = page.getByRole('button', { name: 'Yes, same thing' });
    const no = page.getByRole('button', { name: 'No, keep it' });
    await yes.waitFor({ state: 'visible' });
    await no.waitFor({ state: 'visible' });

    await yes.click();

    await page.getByText(/Did you mean/).first().waitFor({ state: 'hidden' });
    expect(await page.getByText(/Did you mean/).count()).toBe(0);
    expect(await page.getByRole('button', { name: 'Yes, same thing' }).count()).toBe(0);
    expect(await page.getByRole('button', { name: 'No, keep it' }).count()).toBe(0);

    const chip = page.getByText('brætspilsaften', { exact: true }).first();
    await chip.waitFor({ state: 'visible' });
    expect(await chip.isVisible()).toBe(true);

    await app.saveScreen('did-you-mean-after-a-longer-word.png');
  },
  TIMEOUT,
);

test(
  'A popular interest is added with one tap',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
    const page = app.page;

    const heading = page.getByText('Popular in Aarhus', { exact: true }).first();
    await heading.waitFor({ state: 'visible' });

    for (const name of ['løb', 'climbing', 'madlavning', 'book club']) {
      const chip = page.getByRole('button', { name: `Add ${name}`, exact: true });
      await chip.waitFor({ state: 'visible' });
      expect(await chip.count()).toBe(1);
    }

    await page.getByRole('button', { name: 'Add løb', exact: true }).click();

    const held = page.getByText('løb', { exact: true }).first();
    await held.waitFor({ state: 'visible' });
    expect(await held.isVisible()).toBe(true);

    await page.getByRole('button', { name: 'Add løb', exact: true }).waitFor({ state: 'detached' });
    expect(await page.getByRole('button', { name: 'Add løb', exact: true }).count()).toBe(0);

    await app.saveScreen('a-popular-interest-is-added-with-one-tap.png');
  },
  TIMEOUT,
);

test(
  'Suggestions in Danish',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'da' });
    const page = app.page;

    const heading = page.getByText('Populært i Aarhus', { exact: true }).first();
    await heading.waitFor({ state: 'visible' });

    for (const name of ['løb', 'klatring', 'madlavning', 'læseklub']) {
      const chip = page.getByRole('button', { name: `Tilføj ${name}`, exact: true });
      await chip.waitFor({ state: 'visible' });
      expect(await chip.count()).toBe(1);
    }

    await app.saveScreen('suggestions-in-danish.png');
  },
  TIMEOUT,
);
