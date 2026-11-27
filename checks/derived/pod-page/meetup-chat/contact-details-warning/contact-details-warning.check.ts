// ail-derived-from: ContactDetailsWarning@d7e10a964ddf0e6c
import { describe, expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../../harness/preview';

const ROUTE = '/pod/braetspilpodaarhus46/chat';
const TIMEOUT = 180_000;

const WARNING_EN = "You haven't met yet.";
const WARNING_DETAIL_EN = "It's fine to wait until after the meetup before sharing your number or profile.";
const WARNING_DA = 'I har ikke mødt hinanden endnu.';
const WARNING_DETAIL_DA = 'Det er helt i orden at vente til efter mødet med at dele dit nummer eller din profil.';

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const field = (page: Page): Locator => page.getByRole('textbox');
const sendButton = (page: Page): Locator => page.getByRole('button', { name: 'Send', exact: true });
/** The messages shown (the list named "Messages"; the field's own text is not one of them). */
const messages = (page: Page): Locator => page.getByLabel('Messages', { exact: true });
const warning = (page: Page, firstSentence: string): Locator =>
  page.getByRole('alert').filter({ hasText: firstSentence });

/** Types the text in the chat field and presses Send. */
async function writeAndSend(page: Page, text: string): Promise<void> {
  await field(page).fill(text);
  await sendButton(page).click();
}

/** Gets a member into the state "warned about <text>". */
async function warnAbout(page: Page, text: string): Promise<void> {
  await writeAndSend(page, text);
  await warning(page, WARNING_EN).waitFor({ state: 'visible' });
}

/** The whole visible text of the page, whitespace collapsed (a field's value is not part of it). */
async function pageText(page: Page): Promise<string> {
  return normalize(await page.locator('body').innerText());
}

/** Asserts that a message with the given meta line and text shows, with the text after the meta line. */
async function expectMessage(page: Page, meta: RegExp, text: string): Promise<void> {
  await messages(page).getByText(text, { exact: true }).first().waitFor({ state: 'visible' });
  const all = await pageText(page);
  const metaMatches = [...all.matchAll(new RegExp(meta.source, 'g'))];
  const lastMeta = metaMatches[metaMatches.length - 1];
  expect(lastMeta).toBeDefined();
  if (lastMeta === undefined || lastMeta.index === undefined) return;
  const textAt = all.lastIndexOf(text);
  expect(textAt).toBeGreaterThan(lastMeta.index);
}

describe('ContactDetailsWarning', () => {
  test(
    'A phone number before the meetup needs a second tap',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member just before a meetup', locale: 'en' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });

      await writeAndSend(page, '20 30 40 50');

      const alert = warning(page, WARNING_EN);
      await alert.waitFor({ state: 'visible' });
      const alertText = normalize((await alert.textContent()) ?? '');
      expect(alertText).toContain(WARNING_EN);
      expect(alertText).toContain(WARNING_DETAIL_EN);
      expect(alertText.indexOf(WARNING_EN)).toBeLessThan(alertText.indexOf(WARNING_DETAIL_EN));

      expect(await page.getByRole('button', { name: 'Send anyway', exact: true }).isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Edit', exact: true }).isVisible()).toBe(true);
      expect(await sendButton(page).isDisabled()).toBe(true);
      expect(await messages(page).getByText('20 30 40 50', { exact: true }).count()).toBe(0);

      await app.saveScreen('a-phone-number-before-the-meetup-needs-a-second-tap.png');
    },
    TIMEOUT,
  );

  test(
    'Send anyway sends it',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member just before a meetup', locale: 'en' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });
      await warnAbout(page, '20 30 40 50');

      await page.getByRole('button', { name: 'Send anyway', exact: true }).click();

      await expectMessage(page, /You\s*·\s*13:58/, '20 30 40 50');
      await warning(page, WARNING_EN).waitFor({ state: 'detached' });
      expect(await warning(page, WARNING_EN).count()).toBe(0);
      expect(await field(page).inputValue()).toBe('');

      await app.saveScreen('send-anyway-sends-it.png');
    },
    TIMEOUT,
  );

  test(
    'Edit keeps the text to change',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member just before a meetup', locale: 'en' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });
      await warnAbout(page, 'emil@example.com');

      await page.getByRole('button', { name: 'Edit', exact: true }).click();

      await warning(page, WARNING_EN).waitFor({ state: 'detached' });
      expect(await warning(page, WARNING_EN).count()).toBe(0);
      expect(await field(page).inputValue()).toBe('emil@example.com');
      expect(await field(page).evaluate((el) => el === document.activeElement)).toBe(true);
      expect(await sendButton(page).isDisabled()).toBe(false);

      await app.saveScreen('edit-keeps-the-text-to-change.png');
    },
    TIMEOUT,
  );

  test(
    'Changing the text hides the warning',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member just before a meetup', locale: 'en' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });
      await warnAbout(page, 'emil@example.com');

      await field(page).fill('emil@example.co');
      await warning(page, WARNING_EN).waitFor({ state: 'detached' });
      expect(await warning(page, WARNING_EN).count()).toBe(0);

      await field(page).fill('emil@example.com');
      await warning(page, WARNING_EN).waitFor({ state: 'visible' });
      expect(await warning(page, WARNING_EN).isVisible()).toBe(true);

      await app.saveScreen('changing-the-text-hides-the-warning.png');
    },
    TIMEOUT,
  );

  test(
    'A map link is not contact details',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member just before a meetup', locale: 'en' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });

      await writeAndSend(page, 'https://maps.app.goo.gl/abc123');

      await expectMessage(page, /You\s*·\s*\d{1,2}:\d{2}/, 'https://maps.app.goo.gl/abc123');
      expect(await warning(page, WARNING_EN).count()).toBe(0);

      await app.saveScreen('a-map-link-is-not-contact-details.png');
    },
    TIMEOUT,
  );

  test(
    'After the meetup there is no warning',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'en' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });

      await writeAndSend(page, '20 30 40 50');

      await expectMessage(page, /You\s*·\s*10:05/, '20 30 40 50');
      expect(await warning(page, WARNING_EN).count()).toBe(0);

      await app.saveScreen('after-the-meetup-there-is-no-warning.png');
    },
    TIMEOUT,
  );

  test(
    'The warning in Danish',
    async () => {
      await using app = await openApp({ route: ROUTE, world: 'member just before a meetup', locale: 'da' });
      const page = app.page;
      await field(page).waitFor({ state: 'visible' });

      await writeAndSend(page, '20 30 40 50');

      const alert = warning(page, WARNING_DA);
      await alert.waitFor({ state: 'visible' });
      const alertText = normalize((await alert.textContent()) ?? '');
      expect(alertText).toContain(WARNING_DA);
      expect(alertText).toContain(WARNING_DETAIL_DA);
      expect(alertText.indexOf(WARNING_DA)).toBeLessThan(alertText.indexOf(WARNING_DETAIL_DA));

      expect(await page.getByRole('button', { name: 'Send alligevel', exact: true }).isVisible()).toBe(true);
      expect(await page.getByRole('button', { name: 'Ret', exact: true }).isVisible()).toBe(true);

      await app.saveScreen('the-warning-in-danish.png');
    },
    TIMEOUT,
  );
});
