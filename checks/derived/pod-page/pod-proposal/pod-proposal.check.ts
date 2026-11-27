// ail-derived-from: PodProposal@5fd442bd5c5e47e3
import { describe, expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46';
const TIMEOUT = 180_000;

/** The page's whole visible text, with runs of whitespace folded to one space. */
async function pageText(page: Page): Promise<string> {
  const raw = await page.locator('body').innerText();
  return raw.replace(/\s+/g, ' ').trim();
}

/** Waits until every given text is part of the page's visible text, then returns that text. */
async function waitForTexts(page: Page, texts: string[], timeoutMs = 15_000): Promise<string> {
  const start = Date.now();
  let text = await pageText(page);
  while (!texts.every((t) => text.includes(t))) {
    if (Date.now() - start > timeoutMs) {
      const missing = texts.filter((t) => !text.includes(t));
      throw new Error(`Timed out waiting for ${JSON.stringify(missing)} in: ${text}`);
    }
    await page.waitForTimeout(200);
    text = await pageText(page);
  }
  return text;
}

function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

/** Asserts that `lower` sits below `upper` on the screen. */
async function expectBelow(
  upper: ReturnType<Page['getByText']>,
  lower: ReturnType<Page['getByText']>,
): Promise<void> {
  const a = await upper.first().boundingBox();
  const b = await lower.first().boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  if (a && b) {
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  }
}

describe('PodProposal', () => {
  test(
    'The proposal names the pod, never its people',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      const text = await waitForTexts(page, ['Your weekly drop', 'Week 46']);
      expect(text).toContain('Your weekly drop');
      expect(text).toContain('Week 46');

      expect(text).toContain('New pod');
      expect(text).toContain('Answer by Sat 18:00');
      expect(text).toContain('A pod around');
      expect(text).toContain('brætspil');

      expect(text).toContain('You');
      expect(text).toContain('5 people');
      expect(text).toContain('ages 29–38');
      expect(text).toContain('Near Aarhus C · everyone within about 10 km of you');
      expect(text).toContain('Some of you also share sourdough and trail running');

      expect(text).toContain('Names and photos appear when 4 people have said yes.');

      const notThisTime = button(page, 'Not this time');
      const imIn = button(page, "I'm in");
      await notThisTime.waitFor();
      await imIn.waitFor();
      expect(await notThisTime.isVisible()).toBe(true);
      expect(await imIn.isVisible()).toBe(true);

      const why = page.getByText('Why this pod?', { exact: true });
      expect(await why.first().isVisible()).toBe(true);
      await expectBelow(imIn, why);

      for (const name of ['Mette', 'Jonas', 'Sofie', 'Ahmed']) {
        expect(text).not.toContain(name);
      }

      await app.saveScreen('the-proposal-names-the-pod-never-its-people.png');
    },
    TIMEOUT,
  );

  test(
    "I'm in turns the proposal into the wait",
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      const imIn = button(page, "I'm in");
      await imIn.waitFor();
      await imIn.click();

      const text = await waitForTexts(page, ["You're in", '3 of 5 said yes']);
      expect(text).toContain("You're in");
      expect(text).toContain('Open until Sat 18:00');
      expect(text).toContain('3 of 5 said yes');
      expect(text).toContain('4 needed');
      expect(text).toContain(
        "We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits.",
      );
      expect(text).toContain('Changed your mind? Leave this pod');

      expect(await button(page, "I'm in").count()).toBe(0);
      expect(await button(page, 'Not this time').count()).toBe(0);
      expect(await button(page, 'Okay').count()).toBe(0);

      expect(new URL(page.url()).pathname).toBe(ROUTE);

      await app.saveScreen('i-m-in-turns-the-proposal-into-the-wait.png');
    },
    TIMEOUT,
  );

  test(
    'Waiting for the others',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member waiting for the others', locale: 'en' });
      const page = app.page;

      const text = await waitForTexts(page, ["You're in", '3 of 5 said yes']);
      expect(text).toContain("You're in");
      expect(text).toContain('3 of 5 said yes');
      expect(text).toContain('4 needed');

      await app.saveScreen('waiting-for-the-others.png');
    },
    TIMEOUT,
  );

  test(
    'Saying no on the pod page',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      const notThisTime = button(page, 'Not this time');
      await notThisTime.waitFor();
      await notThisTime.click();

      const tooFar = page.getByRole('radio', { name: 'Too far', exact: true });
      await tooFar.waitFor();
      await tooFar.click();

      const decline = button(page, 'Decline this pod');
      await decline.waitFor();
      await decline.click();

      const text = await waitForTexts(page, ['You said no']);
      expect(text).toContain('You said no');
      expect(text).toContain('brætspil');
      expect(new URL(page.url()).pathname).toBe(ROUTE);

      expect(await button(page, "I'm in").count()).toBe(0);
      expect(await button(page, 'Not this time').count()).toBe(0);
      expect(await page.getByText('Why this pod?', { exact: true }).count()).toBe(0);

      await app.saveScreen('saying-no-on-the-pod-page.png');
    },
    TIMEOUT,
  );

  test(
    'Why this pod? gives the reasons',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'en' });
      const page = app.page;

      const why = page.getByText('Why this pod?', { exact: true }).first();
      await why.waitFor();
      await why.click();

      const text = await waitForTexts(page, ['Everyone added brætspil']);
      expect(await page.getByText('Why this pod', { exact: true }).first().isVisible()).toBe(true);
      expect(text).toContain('Everyone added brætspil, or something that means the same');

      await app.saveScreen('why-this-pod-gives-the-reasons.png');
    },
    TIMEOUT,
  );

  test(
    'The proposal in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member with a pod proposal', locale: 'da' });
      const page = app.page;

      const text = await waitForTexts(page, ['Ugens drop', 'Uge 46']);
      expect(text).toContain('Ugens drop');
      expect(text).toContain('Uge 46');
      expect(text).toContain('Ny pod');
      expect(text).toContain('Svar senest lør. kl. 18.00');
      expect(text).toContain('En pod om');

      const ikkeNu = button(page, 'Ikke nu');
      const jegErMed = button(page, 'Jeg er med');
      await ikkeNu.waitFor();
      await jegErMed.waitFor();
      expect(await ikkeNu.isVisible()).toBe(true);
      expect(await jegErMed.isVisible()).toBe(true);

      const why = page.getByText('Hvorfor denne pod?', { exact: true });
      expect(await why.first().isVisible()).toBe(true);
      await expectBelow(jegErMed, why);

      await app.saveScreen('the-proposal-in-danish.png');
    },
    TIMEOUT,
  );
});
