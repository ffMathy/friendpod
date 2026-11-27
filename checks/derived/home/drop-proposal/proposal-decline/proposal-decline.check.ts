// ail-derived-from: ProposalDecline@0bcef545c0618e4b
import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

const IM_IN = /^I[’']m in$/;
const WHAT_WE_MATCH_ON = /What we[’']ll match on/;

/** Waits until the page's visible text contains the given text, wherever its parts are split across elements. */
async function waitForPageText(page: Page, text: string): Promise<void> {
  await page.waitForFunction((t) => document.body.innerText.includes(t), text);
}

/** The page's whole visible text. */
async function pageText(page: Page): Promise<string> {
  return page.evaluate(() => document.body.innerText);
}

describe('ProposalDecline', () => {
  test(
    'Declining asks why, optionally',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Not this time', exact: true }).click();

      await page.getByText('Optional: why? (used only for anonymous statistics)', { exact: true }).waitFor();
      for (const name of ['Not this week', 'Not this interest', 'Too far', 'Group size', 'Other']) {
        await page.getByRole('radio', { name, exact: true }).waitFor();
      }
      await page.getByRole('button', { name: 'Cancel', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Decline this pod', exact: true }).waitFor();
      expect(await page.getByRole('button', { name: IM_IN }).count()).toBe(0);

      await app.saveScreen('declining-asks-why-optionally.png');
    },
    TIMEOUT,
  );

  test(
    'Cancel keeps the proposal',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Not this time', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();

      await page.getByRole('button', { name: 'Not this time', exact: true }).waitFor();
      await page.getByRole('button', { name: IM_IN }).waitFor();

      await app.saveScreen('cancel-keeps-the-proposal.png');
    },
    TIMEOUT,
  );

  test(
    'Declining leaves the proposal behind',
    async () => {
      // The drop worlds are on Thursday 12 November 2026 at 18:30.
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      await page.getByRole('button', { name: 'Not this time', exact: true }).click();
      await page.getByRole('radio', { name: 'Too far', exact: true }).click();
      await page.getByRole('button', { name: 'Decline this pod', exact: true }).click();

      await waitForPageText(page, 'Next drop');
      await waitForPageText(page, 'in 6 days and 23 hours');
      const text = await pageText(page);
      expect(text).toContain('This week');
      expect(text).toContain('Next drop');
      expect(text).toContain('in 6 days and 23 hours');

      // The proposal card is gone.
      expect(await page.getByRole('button', { name: 'Not this time', exact: true }).count()).toBe(0);
      expect(await page.getByRole('button', { name: IM_IN }).count()).toBe(0);
      expect(await page.getByRole('button', { name: 'Decline this pod', exact: true }).count()).toBe(0);

      // brætspil is left only as an interest under What we'll match on.
      const heading = WHAT_WE_MATCH_ON.exec(text);
      expect(heading).not.toBeNull();
      const headingAt = heading === null ? -1 : heading.index;
      const mentions = [...text.matchAll(/brætspil/gi)];
      expect(mentions.length).toBeGreaterThan(0);
      for (const mention of mentions) {
        expect(mention.index).toBeGreaterThan(headingAt);
      }

      await app.saveScreen('declining-leaves-the-proposal-behind.png');
    },
    TIMEOUT,
  );

  test(
    'Declining in Danish',
    async () => {
      await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'da' });
      const page = app.page;

      await page.getByRole('button', { name: 'Ikke nu', exact: true }).click();

      await page.getByText('Valgfrit: hvorfor? (bruges kun til anonym statistik)', { exact: true }).waitFor();
      for (const name of [
        'Ikke i denne uge',
        'Ikke denne interesse',
        'For langt væk',
        'Gruppens størrelse',
        'Andet',
      ]) {
        await page.getByRole('radio', { name, exact: true }).waitFor();
      }
      await page.getByRole('button', { name: 'Annullér', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Sig nej tak til poden', exact: true }).waitFor();

      await app.saveScreen('declining-in-danish.png');
    },
    TIMEOUT,
  );
});
