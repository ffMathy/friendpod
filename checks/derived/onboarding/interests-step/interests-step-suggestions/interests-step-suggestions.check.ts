// ail-derived-from: InterestsStepSuggestions@a8dd99b8661f59a6
import { afterEach, expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

afterEach(() => {
  // Each test opens and disposes of its own app with `await using`.
});

test(
  'Did you mean after a longer word',
  async () => {
    await using app = await openApp({ route: '/', world: 'member adding interests', locale: 'en' });
    const page = app.page;

    const field = page.getByRole('textbox').first();
    await field.waitFor();
    await field.fill('brætspilsaften');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    const question = page.getByText(
      'Did you mean brætspil by “brætspilsaften”? Saying yes puts you with more people.',
      { exact: true },
    );
    await question.first().waitFor();
    expect(await question.count()).toBeGreaterThan(0);

    const yes = page.getByRole('button', { name: 'Yes, same thing', exact: true });
    const no = page.getByRole('button', { name: 'No, keep it', exact: true });
    await yes.waitFor();
    await no.waitFor();
    expect(await yes.isVisible()).toBe(true);
    expect(await no.isVisible()).toBe(true);

    await yes.click();

    await page.getByText(/Did you mean/).first().waitFor({ state: 'detached' });
    expect(await page.getByText(/Did you mean/).count()).toBe(0);
    expect(await yes.count()).toBe(0);
    expect(await no.count()).toBe(0);

    const chip = page.getByText('brætspilsaften', { exact: true });
    await chip.first().waitFor();
    expect(await chip.count()).toBeGreaterThan(0);

    await app.saveScreen('did-you-mean-after-a-longer-word.png');
  },
  TIMEOUT,
);

test(
  'A popular interest is added with one tap',
  async () => {
    await using app = await openApp({ route: '/', world: 'member adding interests', locale: 'en' });
    const page = app.page;

    const heading = page.getByText('Popular in Aarhus', { exact: true });
    await heading.first().waitFor();
    expect(await heading.count()).toBeGreaterThan(0);

    for (const name of ['løb', 'climbing', 'madlavning', 'book club']) {
      const chip = page.getByRole('button', { name: `Add ${name}`, exact: true });
      await chip.waitFor();
      expect(await chip.isVisible()).toBe(true);
    }

    const lob = page.getByRole('button', { name: 'Add løb', exact: true });
    await lob.click();

    await lob.waitFor({ state: 'detached' });
    expect(await lob.count()).toBe(0);

    const added = page.getByText('løb', { exact: true });
    await added.first().waitFor();
    expect(await added.count()).toBeGreaterThan(0);

    await app.saveScreen('a-popular-interest-is-added-with-one-tap.png');
  },
  TIMEOUT,
);

test(
  'Suggestions in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'member adding interests', locale: 'da' });
    const page = app.page;

    const heading = page.getByText('Populært i Aarhus', { exact: true });
    await heading.first().waitFor();
    expect(await heading.count()).toBeGreaterThan(0);

    for (const name of ['løb', 'klatring', 'madlavning', 'læseklub']) {
      const chip = page.getByRole('button', { name: `Tilføj ${name}`, exact: true });
      await chip.waitFor();
      expect(await chip.isVisible()).toBe(true);
    }

    await app.saveScreen('suggestions-in-danish.png');
  },
  TIMEOUT,
);
