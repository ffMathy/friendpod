// ail-derived-from: PrivatePodProposal@0fe381d46fc8b6d6
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

/** The page's visible text, with all runs of whitespace (including no-break spaces) folded to one space. */
async function visibleText(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text.replace(/[\s\u00a0\u202f]+/g, ' ').trim();
}

/** A control a user presses by its name, whether the app renders it as a link or a button. */
function pressable(page: Page, name: string): Locator {
  return page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true }));
}

test(
  'A private proposal shows less',
  async () => {
    await using app = await openApp({ route: '/', world: 'member with a private pod proposal', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: "I'm in", exact: true }).first().waitFor({ state: 'visible' });

    const text = await visibleText(page);
    expect(text).toContain('Your weekly drop');
    expect(text).toContain('Week 48');
    expect(text).toContain('Private interest');
    expect(text).toContain('Answer by Sat 18:00');
    expect(text).toContain('A pod around');
    expect(text).toContain('gravid');
    expect(text).toContain('5 people');
    expect(text).toContain('Near Aarhus C');
    expect(text).toContain(
      'Everyone invited added this interest themselves and gave consent. ' +
        "We show less here on purpose, so that people who say no can't work out who you are.",
    );
    expect(text).toContain(
      'Once the pod is confirmed, members see first names. ' +
        'Your photo stays hidden unless you choose to show it in this pod.',
    );

    expect(await page.getByRole('button', { name: 'Not this time', exact: true }).count()).toBe(1);
    expect(await page.getByRole('button', { name: "I'm in", exact: true }).count()).toBe(1);
    expect(await pressable(page, 'How private interests are protected').count()).toBe(1);

    // No New pod, no seats, no ages, no distance, no shared interests and no Why this pod?
    expect(text).not.toContain('New pod');
    expect(await page.getByText('You', { exact: true }).count()).toBe(0);
    expect(text).not.toMatch(/ages \d/);
    expect(text).not.toMatch(/\d+–\d+/);
    expect(text).not.toContain('within about');
    expect(text).not.toContain('km');
    expect(text).not.toContain('also share');
    expect(text).not.toContain('Why this pod?');
    expect(await pressable(page, 'Why this pod?').count()).toBe(0);

    await app.saveScreen('a-private-proposal-shows-less.png');
  },
  TIMEOUT,
);

test(
  'How private interests are protected',
  async () => {
    await using app = await openApp({ route: '/', world: 'member with a private pod proposal', locale: 'en' });
    const page = app.page;

    const link = pressable(page, 'How private interests are protected').first();
    await link.waitFor({ state: 'visible' });
    await link.click();

    await page.waitForURL(/\/info\/sensitive-interests(?:[?#]|$)/);
    await page.getByText('What counts as private').first().waitFor({ state: 'visible' });

    const text = await visibleText(page);
    expect(text).toContain('Private interests');
    expect(text).toContain('What counts as private');

    await app.saveScreen('how-private-interests-are-protected.png');
  },
  TIMEOUT,
);

test(
  'A private proposal in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: 'member with a private pod proposal', locale: 'da' });
    const page = app.page;

    await page.getByRole('button', { name: 'Jeg er med', exact: true }).first().waitFor({ state: 'visible' });

    const text = await visibleText(page);
    expect(text).toContain('Ugens drop');
    expect(text).toContain('Uge 48');
    expect(text).toContain('Privat interesse');
    expect(text).toContain('Svar senest lør. kl. 18.00');
    expect(text).toContain('En pod om');
    expect(text).toContain('gravid');
    expect(text).toContain('5 personer');
    expect(text).toContain('Tæt på Aarhus C');

    expect(await page.getByRole('button', { name: 'Ikke nu', exact: true }).count()).toBe(1);
    expect(await page.getByRole('button', { name: 'Jeg er med', exact: true }).count()).toBe(1);
    expect(await pressable(page, 'Sådan beskytter vi private interesser').count()).toBe(1);

    await app.saveScreen('a-private-proposal-in-danish.png');
  },
  TIMEOUT,
);
