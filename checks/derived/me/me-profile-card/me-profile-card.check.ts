// ail-derived-from: MeProfileCard@95ee3ac2a04ef3c2
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

// A small, valid 8×8 PNG, standing in for the picture the member chooses from their photo library.
const PICTURE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
  'base64',
);

describe('MeProfileCard', () => {
  test(
    'A member with a photo',
    async () => {
      await using app = await openApp({ route: '/me', world: 'member this week', locale: 'en' });
      const page = app.page;

      await page.getByText('Attended 2 of 2 meetups', { exact: true }).first().waitFor({ state: 'visible' });

      expect(await page.getByRole('img', { name: 'Your photo' }).first().isVisible()).toBe(true);
      expect(await page.getByText('Emil', { exact: true }).first().isVisible()).toBe(true);
      expect(await page.getByText('Aarhus C', { exact: true }).first().isVisible()).toBe(true);
      expect(await page.getByText('Attended 2 of 2 meetups', { exact: true }).first().isVisible()).toBe(true);
      expect(
        await page
          .getByText(
            'Only people in a confirmed pod with you can see your photo. In pods about a private interest, you choose per pod.',
            { exact: true },
          )
          .first()
          .isVisible(),
      ).toBe(true);
      expect(await page.getByRole('button', { name: 'Change photo' }).first().isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Delete photo' }).first().isVisible()).toBe(true);

      await app.saveScreen('a-member-with-a-photo.png');
    },
    TIMEOUT,
  );

  test(
    'A new member has no photo and no meetups yet',
    async () => {
      await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'en' });
      const page = app.page;

      await page.getByText('No meetups yet', { exact: true }).first().waitFor({ state: 'visible' });

      expect(await page.getByText('No meetups yet', { exact: true }).first().isVisible()).toBe(true);
      expect(await page.getByRole('img', { name: 'Your photo' }).count()).toBe(0);
      expect(await page.getByRole('button', { name: 'Add a photo' }).first().isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Delete photo' }).count()).toBe(0);

      await app.saveScreen('a-new-member-has-no-photo-and-no-meetups-yet.png');
    },
    TIMEOUT,
  );

  test(
    'Adding a photo thanks the member',
    async () => {
      await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'en' });
      const page = app.page;

      const add = page.getByRole('button', { name: 'Add a photo' }).first();
      await add.waitFor({ state: 'visible' });

      const chooserPromise = page.waitForEvent('filechooser');
      await add.click();
      const chooser = await chooserPromise;
      await chooser.setFiles({ name: 'picture.png', mimeType: 'image/png', buffer: PICTURE_PNG });

      const thanks = page.getByText('Thanks! Your photo will appear shortly.', { exact: true }).first();
      await thanks.waitFor({ state: 'visible', timeout: 30_000 });
      expect(await thanks.isVisible()).toBe(true);

      const change = page.getByRole('button', { name: 'Change photo' }).first();
      await change.waitFor({ state: 'visible', timeout: 30_000 });
      expect(await change.isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Add a photo' }).count()).toBe(0);

      await app.saveScreen('adding-a-photo-thanks-the-member.png');
    },
    TIMEOUT,
  );

  test(
    'The card in Danish',
    async () => {
      await using app = await openApp({ route: '/me', world: 'new member with nothing yet', locale: 'da' });
      const page = app.page;

      await page.getByText('Ingen møder endnu', { exact: true }).first().waitFor({ state: 'visible' });

      expect(await page.getByText('Ingen møder endnu', { exact: true }).first().isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Tilføj et billede' }).first().isVisible()).toBe(true);

      await app.saveScreen('the-card-in-danish.png');
    },
    TIMEOUT,
  );
});
