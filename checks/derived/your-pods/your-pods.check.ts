// ail-derived-from: YourPods@f1df678c8153ff1c
import { setDefaultTimeout, test, expect } from 'bun:test';
import type { Page } from 'playwright';
import { openApp } from '../../harness/preview';

setDefaultTimeout(600_000);

const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();

async function pageText(page: Page): Promise<string> {
  return normalize(await page.locator('body').innerText());
}

async function waitForText(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (t) => document.body.innerText.replace(/\s+/g, ' ').includes(t),
    text,
    { timeout: 30_000 },
  );
}

async function waitForPattern(page: Page, source: string): Promise<void> {
  await page.waitForFunction(
    (src) => new RegExp(src).test(document.body.innerText.replace(/\s+/g, ' ')),
    source,
    { timeout: 30_000 },
  );
}

function indexOfPattern(text: string, pattern: RegExp): number {
  const m = pattern.exec(text);
  return m === null ? -1 : m.index;
}

function expectInOrder(text: string, patterns: RegExp[]): void {
  let last = -1;
  for (const p of patterns) {
    const rest = text.slice(last + 1);
    const i = indexOfPattern(rest, p);
    expect(i, `expected ${String(p)} after position ${last} in: ${text}`).toBeGreaterThanOrEqual(0);
    last = last + 1 + i;
  }
}

function podsTab(page: Page) {
  return page
    .getByRole('tab', { name: /Pods/ })
    .or(page.getByRole('link', { name: /^Pods/ }))
    .or(page.getByRole('button', { name: /^Pods/ }))
    .last();
}

test('Active and past pods are listed apart', async () => {
  await using app = await openApp({ route: '/pods', world: 'member this week', locale: 'en' });
  await waitForPattern(app.page, 'Past\\s*·\\s*1');
  await waitForText(app.page, 'bouldering');
  const text = await pageText(app.page);
  expectInOrder(text, [/Pods/, /Active\s*·\s*1/, /sourdough/, /Past\s*·\s*1/, /bouldering/]);
  await app.saveScreen('active-and-past-pods-are-listed-apart.png');
});

test('No past pods yet', async () => {
  await using app = await openApp({ route: '/pods', world: 'member with a pod proposal', locale: 'en' });
  await waitForText(app.page, 'No past pods yet.');
  const text = await pageText(app.page);
  expectInOrder(text, [/Active\s*·\s*1/, /brætspil/, /Past/, /No past pods yet\./]);
  await app.saveScreen('no-past-pods-yet.png');
});

test('A member with no pods', async () => {
  await using app = await openApp({ route: '/pods', world: 'new member with nothing yet', locale: 'en' });
  await waitForText(app.page, 'No pods yet');
  await waitForText(
    app.page,
    "Your first pod arrives with a Thursday drop. We'll let you know when it's here.",
  );
  const text = await pageText(app.page);
  expect(text).not.toMatch(/Active\s*·/);
  expect(text).not.toMatch(/Past\s*·/);
  expect(text).not.toContain('No past pods yet.');
  expect(text).not.toContain('No active pods right now.');
  await app.saveScreen('a-member-with-no-pods.png');
});

test('A row opens its pod', async () => {
  await using app = await openApp({ route: '/pods', world: 'member this week', locale: 'en' });
  const row = app.page.getByRole('link', { name: /^sourdough\./ }).first();
  await row.waitFor({ timeout: 30_000 });
  await row.click();
  await waitForText(app.page, '4 people near Aarhus C');
  expect(await pageText(app.page)).toContain('4 people near Aarhus C');
  await app.saveScreen('a-row-opens-its-pod.png');
});

test('A pod said no to leaves the list', async () => {
  await using app = await openApp({ route: '/pods', world: 'member with a pod proposal', locale: 'en' });
  const row = app.page.getByRole('link', { name: /^brætspil\./ }).first();
  await row.waitFor({ timeout: 30_000 });
  await row.click();
  const notThisTime = app.page.getByRole('button', { name: 'Not this time' }).first();
  await notThisTime.waitFor({ timeout: 30_000 });
  await notThisTime.click();
  const decline = app.page.getByRole('button', { name: 'Decline this pod' }).first();
  await decline.waitFor({ timeout: 30_000 });
  await decline.click();
  const tab = podsTab(app.page);
  await tab.waitFor({ timeout: 30_000 });
  await tab.click();
  await waitForText(app.page, 'No pods yet');
  const text = await pageText(app.page);
  expect(text).toContain('No pods yet');
  expect(await app.page.getByRole('link', { name: /^brætspil\./ }).count()).toBe(0);
  await app.saveScreen('a-pod-said-no-to-leaves-the-list.png');
});

test('The Pods tab in Danish', async () => {
  await using app = await openApp({ route: '/pods', world: 'member this week', locale: 'da' });
  await waitForPattern(app.page, 'Tidligere\\s*·\\s*1');
  await waitForText(app.page, 'Arkiveret');
  const text = await pageText(app.page);
  expectInOrder(text, [/Pods/, /Aktive\s*·\s*1/, /Tidligere\s*·\s*1/, /Arkiveret/]);
  const row = app.page.getByRole('link', { name: /^sourdough\./ }).first();
  await row.waitFor({ timeout: 30_000 });
  const rowText = normalize(await row.innerText());
  expect(rowText).toContain('Lørdag kl. 14.00 · [Bagericafé], Frederiksbjerg');
  await app.saveScreen('the-pods-tab-in-danish.png');
});
