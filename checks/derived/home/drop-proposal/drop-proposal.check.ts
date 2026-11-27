// ail-derived-from: DropProposal@217cbca0949f8ff5
import { describe, expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;
const WAIT = 20_000;

type App = Awaited<ReturnType<typeof openApp>>;

/** The visible text of the whole page, with every run of whitespace collapsed to one space. */
async function pageText(app: App): Promise<string> {
  const text = await app.page.locator('body').innerText();
  return text.replace(/\s+/g, ' ');
}

async function shows(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible', timeout: WAIT });
}

describe('DropProposal', () => {
  test(
    'The proposal on Home',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;
      await shows(page.getByText('Your weekly drop', { exact: true }));

      const text = await pageText(app);
      expect(text).toContain('Your weekly drop');
      expect(text).toContain('Week 46');
      expect(text).toContain('New pod');
      expect(text).toContain('Answer by Sat 18:00');
      expect(text).toContain('A pod around');
      expect(text).toContain('brætspil');

      await shows(page.getByText('You', { exact: true }));

      expect(text).toContain('5 people, ages 29–38');
      expect(text).toContain('Near Aarhus C · everyone within about 10 km of you');
      expect(text).toContain('Some of you also share sourdough and trail running');
      expect(text).toContain('Names and photos appear when 4 people have said yes.');

      await shows(page.getByRole('button', { name: 'Not this time', exact: true }));
      await shows(page.getByRole('button', { name: "I'm in", exact: true }));
      await shows(page.getByText('Why this pod?', { exact: true }));

      for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) {
        expect(text).not.toContain(name);
      }

      await app.saveScreen('the-proposal-on-home.png');
    },
    TIMEOUT,
  );

  test(
    'Saying yes shows the wait for the others',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;
      const accept = page.getByRole('button', { name: "I'm in", exact: true });
      await shows(accept);

      await accept.first().click();
      await shows(page.getByText("You're in", { exact: true }));

      const text = await pageText(app);
      expect(text).toContain("You're in");
      expect(text).toContain('3 of 5 said yes');
      expect(text).toContain('4 needed');
      expect(await page.getByRole('button', { name: "I'm in", exact: true }).count()).toBe(0);

      await app.saveScreen('saying-yes-shows-the-wait-for-the-others.png');
    },
    TIMEOUT,
  );

  test(
    'An open pod proposal',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with an open pod proposal', locale: 'en' });
      await shows(app.page.getByText('A pod without a shared theme', { exact: true }));

      const text = await pageText(app);
      expect(text).toContain('A pod without a shared theme');
      expect(text).toContain('Open to anyone');

      await app.saveScreen('an-open-pod-proposal.png');
    },
    TIMEOUT,
  );

  test(
    'The proposal in Danish',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'da' });
      const page = app.page;
      await shows(page.getByText('Ugens drop', { exact: true }));

      const text = await pageText(app);
      expect(text).toContain('Ugens drop');
      expect(text).toContain('Uge 46');
      expect(text).toContain('Ny pod');
      expect(text).toContain('Svar senest lør. kl. 18.00');
      expect(text).toContain('En pod om');
      expect(text).toContain('brætspil');
      expect(text).toContain('5 personer, 29–38 år');
      expect(text).toContain('Tæt på Aarhus C · alle bor højst ca. 10 km fra dig');
      expect(text).toContain('Nogle af jer deler også sourdough og trail running');
      expect(text).toContain('Navne og billeder vises, når 4 har sagt ja.');

      await shows(page.getByRole('button', { name: 'Ikke nu', exact: true }));
      await shows(page.getByRole('button', { name: 'Jeg er med', exact: true }));
      await shows(page.getByText('Hvorfor denne pod?', { exact: true }));

      await app.saveScreen('the-proposal-in-danish.png');
    },
    TIMEOUT,
  );
});
