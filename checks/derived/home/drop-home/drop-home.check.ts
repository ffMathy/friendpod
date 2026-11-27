// ail-derived-from: DropHome@f89eed499f59965f
import { describe, expect, test } from 'bun:test';
import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

type App = Awaited<ReturnType<typeof openApp>>;

/** Collapses runs of whitespace so text split across elements compares as one line. */
function normalize(text: string | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** The visible text of the whole page, as one line. */
async function pageText(app: App): Promise<string> {
  return normalize(await app.page.locator('body').innerText());
}

/** The accessible names of the page's links, in document order, leaving out the tab bar. */
async function contentLinkNames(app: App): Promise<string[]> {
  return app.page
    .getByRole('link')
    .evaluateAll((els) =>
      els
        .filter((e) => e.closest('[role="tablist"]') === null)
        .map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );
}

describe('DropHome', () => {
  test(
    'This week before the drop',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
      const poster = app.page.getByRole('link', { name: /^Next drop/ });
      await poster.waitFor();

      const text = await pageText(app);
      expect(text).toContain('This week');
      expect(text).toContain('Week 46');

      const posterText = normalize(await poster.textContent());
      expect(posterText).toContain('Next drop');
      expect(posterText).toContain('Thursday 18:00');
      expect(posterText).toContain('in 2 days and 6 hours');
      expect(posterText).toContain("You're in this week");

      expect(text).toContain('Your pods · 1 of 2 active');
      const row = app.page.getByRole('link', { name: /^sourdough\./ });
      await row.waitFor();
      const rowText = normalize(await row.textContent());
      expect(rowText).toContain('sourdough');
      expect(rowText).toContain('Saturday 14:00 · [Bakery café], Frederiksbjerg');

      const links = await contentLinkNames(app);
      const last = links[links.length - 1];
      expect(last).toBe('How matching works');

      await app.saveScreen('this-week-before-the-drop.png');
    },
    TIMEOUT,
  );

  test(
    'The next drop explains the drop',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
      const poster = app.page.getByRole('link', { name: /^Next drop/ });
      await poster.waitFor();
      await poster.click();
      await app.page.waitForURL(/\/info\/how-matching-works/);
      expect(new URL(app.page.url()).pathname).toBe('/info/how-matching-works');

      await app.saveScreen('the-next-drop-explains-the-drop.png');
    },
    TIMEOUT,
  );

  test(
    'A pod row opens its pod',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
      const row = app.page.getByRole('link', { name: /^sourdough\./ });
      await row.waitFor();
      await row.click();
      await app.page.waitForURL(/\/pod\/[^/?#]+/);
      expect(new URL(app.page.url()).pathname).toMatch(/^\/pod\/[^/]+$/);

      const plan = app.page.getByText('Plan', { exact: true }).first();
      const members = app.page.getByText('Members', { exact: true }).first();
      await plan.waitFor();
      await members.waitFor();
      expect(await plan.isVisible()).toBe(true);
      expect(await members.isVisible()).toBe(true);

      await app.saveScreen('a-pod-row-opens-its-pod.png');
    },
    TIMEOUT,
  );

  test(
    'This week in Danish',
    async () => {
      await using app = await openApp({ route: '/', world: 'member this week', locale: 'da' });
      const poster = app.page.getByRole('link', { name: /^Næste drop/ });
      await poster.waitFor();

      const text = await pageText(app);
      expect(text).toContain('Denne uge');
      expect(text).toContain('Uge 46');

      const posterText = normalize(await poster.textContent());
      expect(posterText).toContain('Næste drop');
      expect(posterText).toContain('Torsdag kl. 18.00');
      expect(posterText).toContain('om 2 dage og 6 timer');
      expect(posterText).toContain('Du er med i denne uge');

      expect(text).toContain('Dine pods · 1 af 2 aktive');
      const row = app.page.getByRole('link', { name: /^sourdough\./ });
      await row.waitFor();
      const rowText = normalize(await row.textContent());
      expect(rowText).toContain('sourdough');
      expect(rowText).toContain('Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg');

      const links = await contentLinkNames(app);
      const last = links[links.length - 1];
      expect(last).toBe('Sådan matcher vi');

      await app.saveScreen('this-week-in-danish.png');
    },
    TIMEOUT,
  );
});
