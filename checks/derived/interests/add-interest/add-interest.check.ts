// ail-derived-from: AddInterest@ecdc1ca4f73835ca
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';
import { openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

function field(page: Page, label: string) {
  return page.getByRole('textbox', { name: label });
}

function addButton(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

async function waitForMessage(page: Page, message: string): Promise<void> {
  await page.getByText(message, { exact: true }).first().waitFor({ state: 'visible' });
}

async function pageText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

async function isLastInItsList(page: Page, text: string): Promise<boolean> {
  return page.evaluate((wanted: string) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let found: Element | null = null;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      if ((node.textContent ?? '').trim() === wanted && node.parentElement !== null) {
        const el = node.parentElement;
        if (el.closest('input, textarea') === null) {
          found = el;
        }
      }
    }
    if (found === null) {
      return false;
    }
    let item: Element = found;
    while (item.parentElement !== null && (item.parentElement.textContent ?? '').trim() === wanted) {
      item = item.parentElement;
    }
    const list = item.parentElement;
    if (list === null) {
      return false;
    }
    let last: Element | null = list.lastElementChild;
    while (last !== null && (last.textContent ?? '').trim() === '' && last !== item) {
      last = last.previousElementSibling;
    }
    return last === item;
  }, text);
}

test('A new interest is added at the end of the list', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
  const page = app.page;
  const input = field(page, 'Add an interest in your own words');
  await input.waitFor({ state: 'visible' });

  await input.fill('climbing');
  await addButton(page, 'Add').click();

  await waitForMessage(page, 'Added.');
  await page.getByText('climbing', { exact: true }).first().waitFor({ state: 'visible' });
  expect(await isLastInItsList(page, 'climbing')).toBe(true);
  expect(await pageText(page)).toContain('6 of 20');
  expect(await input.inputValue()).toBe('');

  await app.saveScreen('a-new-interest-is-added-at-the-end-of-the-list.png');
}, TIMEOUT);

test('An interest of one character is refused', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
  const page = app.page;
  const input = field(page, 'Add an interest in your own words');
  await input.waitFor({ state: 'visible' });

  await input.fill('a');
  await addButton(page, 'Add').click();

  await waitForMessage(page, 'An interest needs at least 2 characters.');
  expect(await input.inputValue()).toBe('a');
  expect(await pageText(page)).toContain('5 of 20');

  await app.saveScreen('an-interest-of-one-character-is-refused.png');
}, TIMEOUT);

test('An interest of more than 40 characters is refused', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
  const page = app.page;
  const input = field(page, 'Add an interest in your own words');
  await input.waitFor({ state: 'visible' });

  const fortyOne = 'abcdefghij'.repeat(4) + 'k';
  expect(fortyOne.length).toBe(41);
  await input.fill(fortyOne);
  await addButton(page, 'Add').click();

  await waitForMessage(page, 'An interest can have at most 40 characters.');

  await app.saveScreen('an-interest-of-more-than-40-characters-is-refused.png');
}, TIMEOUT);

test('Contact details are refused', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
  const page = app.page;
  const input = field(page, 'Add an interest in your own words');
  await input.waitFor({ state: 'visible' });

  await input.fill('call me 12345678');
  await addButton(page, 'Add').click();

  await waitForMessage(
    page,
    'Interests cannot contain contact details such as phone numbers, emails, links or handles.',
  );
  expect(await input.inputValue()).toBe('call me 12345678');
  expect(await pageText(page)).toContain('5 of 20');

  await app.saveScreen('contact-details-are-refused.png');
}, TIMEOUT);

test("Someone else's sensitive situation is refused", async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'en' });
  const page = app.page;
  const input = field(page, 'Add an interest in your own words');
  await input.waitFor({ state: 'visible' });

  await input.fill('min datters diabetes');
  await addButton(page, 'Add').click();

  await waitForMessage(
    page,
    'This seems to describe someone else\'s sensitive situation. Describe your own instead, for example “parent of an autistic child”.',
  );
  expect(await pageText(page)).toContain('5 of 20');

  await app.saveScreen('someone-else-s-sensitive-situation-is-refused.png');
}, TIMEOUT);

test('Adding in Danish', async () => {
  await using app = await openApp({ route: '/interests', world: 'member this week', locale: 'da' });
  const page = app.page;
  const input = field(page, 'Tilføj en interesse med egne ord');
  await input.waitFor({ state: 'visible' });

  await input.fill('klatring');
  await addButton(page, 'Tilføj').click();

  await waitForMessage(page, 'Tilføjet.');
  expect(await pageText(page)).toContain('6 af 20');

  await input.fill('a');
  await addButton(page, 'Tilføj').click();

  await waitForMessage(page, 'En interesse skal have mindst 2 tegn.');

  await app.saveScreen('adding-in-danish.png');
}, TIMEOUT);
