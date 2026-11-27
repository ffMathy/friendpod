// ail-derived-from: YourAreaCard@2671674ec75e95d6
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

type Page = Awaited<ReturnType<typeof openApp>>['page'];

/** Types a postcode into the area step's postcode field, the step's only text field. */
async function enterPostcode(page: Page, postcode: string): Promise<void> {
  const field = page.getByRole('textbox').first();
  await field.waitFor({ state: 'visible' });
  await field.fill(postcode);
}

/** Waits until the card labelled `label` contains `text`, then returns the card's whole text. */
async function cardTextOnceShowing(page: Page, label: string, text: string): Promise<string> {
  const card = page.getByLabel(label, { exact: true }).filter({ hasText: text }).first();
  await card.waitFor({ state: 'visible' });
  return (await card.textContent()) ?? '';
}

describe('YourAreaCard', () => {
  test(
    'A postcode in another launch city',
    async () => {
      await using app = await openApp({ route: '/area', world: 'new member', locale: 'en' });
      await app.page.getByText('Where do you live?').first().waitFor({ state: 'visible' });

      await enterPostcode(app.page, '5000');

      const text = await cardTextOnceShowing(app.page, 'Your area', 'Odense opens soon');
      expect(text).toContain('Your area');
      expect(text).toContain('Odense C');
      expect(text).toContain('Odense opens soon');
      expect(text).toContain(
        'We store only this area, never your address or exact location. Nobody is ever shown how far away you live.',
      );

      await app.saveScreen('a-postcode-in-another-launch-city.png');
    },
    TIMEOUT,
  );

  test(
    'A postcode outside every launch area',
    async () => {
      await using app = await openApp({ route: '/area', world: 'new member', locale: 'en' });
      await app.page.getByText('Where do you live?').first().waitFor({ state: 'visible' });

      await enterPostcode(app.page, '9990');

      const text = await cardTextOnceShowing(app.page, 'Your area', 'Not open here yet');
      expect(text).toContain('Skagen');
      expect(text).toContain('Not open here yet');

      const hint = "You can still sign up; we'll tell you when we open near you.";
      const stored =
        'We store only this area, never your address or exact location. Nobody is ever shown how far away you live.';
      const hintAt = text.indexOf(hint);
      const storedAt = text.indexOf(stored);
      expect(hintAt).toBeGreaterThanOrEqual(0);
      expect(storedAt).toBeGreaterThanOrEqual(0);
      expect(hintAt).toBeLessThan(storedAt);

      await app.saveScreen('a-postcode-outside-every-launch-area.png');
    },
    TIMEOUT,
  );

  test(
    'The card in Danish',
    async () => {
      await using app = await openApp({ route: '/area', world: 'new member', locale: 'da' });
      await app.page.getByText('Hvor bor du?').first().waitFor({ state: 'visible' });

      await enterPostcode(app.page, '2100');

      const text = await cardTextOnceShowing(app.page, 'Dit område', 'København åbner snart');
      expect(text).toContain('Dit område');
      expect(text).toContain('København Ø');
      expect(text).toContain('København åbner snart');

      await app.saveScreen('the-card-in-danish.png');
    },
    TIMEOUT,
  );
});
