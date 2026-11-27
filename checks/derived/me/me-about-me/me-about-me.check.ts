// ail-derived-from: MeAboutMe@2069d316e0845468
import { expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

test(
  'The saved sentence, and no Save until it changes',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    const field = page.getByRole('textbox', { name: 'About me' });
    await field.waitFor();
    await page.getByText('53 / 140').first().waitFor();

    expect(await field.inputValue()).toBe('New in Aarhus, dad of a toddler, always up for a game');
    expect(await page.getByText('About me').count()).toBeGreaterThan(0);
    expect(await page.getByText('(optional)').count()).toBeGreaterThan(0);
    expect(await page.getByRole('button', { name: 'Save', exact: true }).count()).toBe(0);

    await app.saveScreen('the-saved-sentence-and-no-save-until-it-changes.png');
  },
  TIMEOUT,
);

test(
  'A changed sentence is saved',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    const field = page.getByRole('textbox', { name: 'About me' });
    await field.waitFor();
    await page.getByText('53 / 140').first().waitFor();

    await field.fill('Board games and long walks');

    await page.getByText('26 / 140').first().waitFor();
    const save = page.getByRole('button', { name: 'Save', exact: true });
    await save.waitFor();
    expect(await save.isVisible()).toBe(true);

    await save.click();

    await page.getByText('Saved.', { exact: true }).first().waitFor();
    await save.waitFor({ state: 'detached' });
    expect(await page.getByRole('button', { name: 'Save', exact: true }).count()).toBe(0);

    await app.saveScreen('a-changed-sentence-is-saved.png');
  },
  TIMEOUT,
);

test(
  'Contact details are refused',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
    const page = app.page;

    const field = page.getByRole('textbox', { name: 'About me' });
    await field.waitFor();
    await page.getByText('53 / 140').first().waitFor();

    await field.fill('Call me on 12345678');

    await page
      .getByText("No contact details here: you haven't met yet. Share them in person if you like.")
      .first()
      .waitFor();

    const save = page.getByRole('button', { name: 'Save', exact: true });
    const saveCount = await save.count();
    if (saveCount > 0) {
      expect(await save.first().isDisabled()).toBe(true);
    } else {
      expect(saveCount).toBe(0);
    }

    await app.saveScreen('contact-details-are-refused.png');
  },
  TIMEOUT,
);

test(
  'About me in Danish',
  async () => {
    await using app = await openApp({ route: '/me', world: 'member this week', locale: 'da' });
    const page = app.page;

    const field = page.getByRole('textbox', { name: 'Om mig' });
    await field.waitFor();
    // The saved sentence has loaded (in Danish it is the world's Danish sentence, not the English one).
    await page.getByText(/^[1-9]\d* \/ 140$/).first().waitFor();

    await field.fill('Ring på 12345678');

    await page
      .getByText('Ingen kontaktoplysninger her: I har ikke mødt hinanden endnu. Del dem gerne, når I ses.')
      .first()
      .waitFor();

    await app.saveScreen('about-me-in-danish.png');
  },
  TIMEOUT,
);
