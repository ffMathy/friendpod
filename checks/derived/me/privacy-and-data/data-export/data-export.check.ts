// ail-derived-from: DataExport@714d61043846b322
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

type Boxed = { boundingBox(): Promise<{ y: number; height: number } | null> };

/** Asserts that `line` sits below `anchor` on the screen. */
async function expectBelow(line: Boxed, anchor: Boxed): Promise<void> {
  const a = await anchor.boundingBox();
  const b = await line.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (a === null || b === null) return;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
}

describe('DataExport', () => {
  test(
    'Asking for the data',
    async () => {
      await using app = await openApp({ route: '/settings/privacy', world: 'member in privacy settings', locale: 'en' });
      const page = app.page;

      const row = page.getByRole('button', { name: 'Download my data' });
      await row.waitFor({ state: 'visible' });
      await page.getByText('A file you can keep, ready within minutes').waitFor({ state: 'visible' });

      await row.click();

      const line = page.getByText("We're preparing your file and will let you know when it's ready.");
      await line.waitFor({ state: 'visible' });
      await expectBelow(line, row);

      await app.saveScreen('asking-for-the-data.png');
    },
    TIMEOUT,
  );

  test(
    'A ready file shows until when it can be downloaded',
    async () => {
      await using app = await openApp({ route: '/settings/privacy', world: 'member this week', locale: 'en' });
      const page = app.page;

      const row = page.getByRole('button', { name: 'Download my data' });
      await row.waitFor({ state: 'visible' });

      const line = page.getByText('Your file is ready until Tue 10 Nov, 21:12.');
      await line.waitFor({ state: 'visible' });
      await expectBelow(line, row);

      const download = page.getByRole('button', { name: 'Download the file' });
      await download.waitFor({ state: 'visible' });

      await app.saveScreen('a-ready-file-shows-until-when-it-can-be-downloaded.png');
    },
    TIMEOUT,
  );

  test(
    'A download that does not work says so',
    async () => {
      await using app = await openApp({ route: '/settings/privacy', world: 'member this week', locale: 'en' });
      const page = app.page;

      const download = page.getByRole('button', { name: 'Download the file' });
      await download.waitFor({ state: 'visible' });

      // The download fails: the phone loses its connection before the file is fetched.
      await page.route('**/*', (route) => route.abort());
      await page.context().setOffline(true);

      await download.click();

      const line = page.getByText("The download didn't work. Try again.");
      await line.waitFor({ state: 'visible' });
      await expectBelow(line, download);

      await page.context().setOffline(false);
      await page.unroute('**/*');
      await app.saveScreen('a-download-that-does-not-work-says-so.png');
    },
    TIMEOUT,
  );

  test(
    'The data export in Danish',
    async () => {
      await using app = await openApp({ route: '/settings/privacy', world: 'member this week', locale: 'da' });
      const page = app.page;

      const row = page.getByRole('button', { name: 'Hent mine data' });
      await row.waitFor({ state: 'visible' });
      await page.getByText('En fil, du kan gemme, klar på få minutter').waitFor({ state: 'visible' });

      const ready = page.getByText('Din fil er klar indtil tirs. 10. nov., 21.12.');
      await ready.waitFor({ state: 'visible' });
      await expectBelow(ready, row);
      await page.getByRole('button', { name: 'Hent filen' }).waitFor({ state: 'visible' });

      await row.click();

      const requested = page.getByText('Vi laver din fil og giver besked, når den er klar.');
      await requested.waitFor({ state: 'visible' });
      await expectBelow(requested, row);

      await app.saveScreen('the-data-export-in-danish.png');
    },
    TIMEOUT,
  );
});
