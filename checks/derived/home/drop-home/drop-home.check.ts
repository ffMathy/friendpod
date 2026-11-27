// ail-derived-from: DropHome@a2e1a66f29d2d075
import { describe, expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;

const TIMEOUT = 180_000;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameWith(...parts: string[]): RegExp {
  return new RegExp(parts.map(escapeRegExp).join('.*'), 's');
}

async function pageText(app: App): Promise<string> {
  const text = await app.page.locator('body').innerText();
  return text.replace(/\s+/g, ' ');
}

async function linkNames(app: App): Promise<string[]> {
  const links = app.page.getByRole('link');
  const count = await links.count();
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    const label = await link.getAttribute('aria-label');
    const name = label ?? (await link.innerText());
    names.push(name.replace(/\s+/g, ' ').trim());
  }
  return names;
}

describe('DropHome', () => {
  test(
    'This week before the drop',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
      const poster = app.page.getByRole('link', { name: /^Next drop/ }).first();
      await poster.waitFor();
      const row = app.page
        .getByRole('link', { name: nameWith('sourdough', 'Saturday 14:00 · [Bakery café], Frederiksbjerg') })
        .first();
      await row.waitFor();
      await app.page.getByRole('link', { name: 'How matching works' }).first().waitFor();

      const text = await pageText(app);
      expect(text).toContain('This week');
      expect(text).toContain('Week 46');
      expect(text).toContain('Next drop');
      expect(text).toContain('Thursday 18:00');
      expect(text).toContain('in 2 days and 6 hours');
      expect(text).toContain("You're in this week");
      expect(text).toContain('Your pods · 1 of 2 active');
      expect(text).toContain('sourdough');
      expect(text).toContain('Saturday 14:00 · [Bakery café], Frederiksbjerg');

      const names = await linkNames(app);
      const last = names[names.length - 1];
      expect(last).toBe('How matching works');

      await app.saveScreen('this-week-before-the-drop.png');
    },
    TIMEOUT,
  );

  test(
    'The next drop explains the drop',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
      const poster = app.page.getByRole('link', { name: /^Next drop/ }).first();
      await poster.waitFor();
      await poster.click();
      await app.page.waitForURL(/\/info\/how-matching-works/);
      expect(app.page.url()).toContain('/info/how-matching-works');

      await app.saveScreen('the-next-drop-explains-the-drop.png');
    },
    TIMEOUT,
  );

  test(
    'A pod row opens its pod',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
      const row = app.page.getByRole('link', { name: /^sourdough/ }).first();
      await row.waitFor();
      await row.click();
      await app.page.waitForURL(/\/pod\/[^/?#]+/);
      expect(app.page.url()).toMatch(/\/pod\/[^/?#]+/);
      await app.page.getByText('Plan', { exact: true }).first().waitFor();
      await app.page.getByText('Members', { exact: true }).first().waitFor();

      await app.saveScreen('a-pod-row-opens-its-pod.png');
    },
    TIMEOUT,
  );

  test(
    'This week in Danish',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'da' });
      const poster = app.page.getByRole('link', { name: /^Næste drop/ }).first();
      await poster.waitFor();
      const row = app.page
        .getByRole('link', { name: nameWith('sourdough', 'Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg') })
        .first();
      await row.waitFor();
      await app.page.getByRole('link', { name: 'Sådan matcher vi' }).first().waitFor();

      const text = await pageText(app);
      expect(text).toContain('Denne uge');
      expect(text).toContain('Uge 46');
      expect(text).toContain('Næste drop');
      expect(text).toContain('Torsdag kl. 18.00');
      expect(text).toContain('om 2 dage og 6 timer');
      expect(text).toContain('Du er med i denne uge');
      expect(text).toContain('Dine pods · 1 af 2 aktive');
      expect(text).toContain('sourdough');
      expect(text).toContain('Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg');

      const names = await linkNames(app);
      const last = names[names.length - 1];
      expect(last).toBe('Sådan matcher vi');

      await app.saveScreen('this-week-in-danish.png');
    },
    TIMEOUT,
  );
});
