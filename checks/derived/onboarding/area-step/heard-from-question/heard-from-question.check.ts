// ail-derived-from: HeardFromQuestion@24d940c5a2d0e90d
import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import { openApp } from '../../../../harness/preview.ts';

const TIMEOUT = 300_000;
const I18N_DIR = join(import.meta.dir, '../../../../../apps/mobile/src/i18n');

type Strings = Map<string, string>;

/** Flattens every JSON file of one locale into "namespace:key.path" -> text. */
const loadLocale = (locale: string): Strings => {
  const out: Strings = new Map();
  const walk = (prefix: string, value: unknown): void => {
    if (typeof value === 'string') {
      out.set(prefix, value);
    } else if (value !== null && typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(prefix === '' ? key : `${prefix}.${key}`, child);
      }
    }
  };
  for (const file of readdirSync(join(I18N_DIR, locale))) {
    if (!file.endsWith('.json')) continue;
    const ns = file.slice(0, -'.json'.length);
    walk(`${ns}:`, JSON.parse(readFileSync(join(I18N_DIR, locale, file), 'utf8')));
  }
  return out;
};

/** The Danish text of the app's own copy whose English text is `english`, or null. */
const danishFor = (english: string): string | null => {
  const en = loadLocale('en');
  const da = loadLocale('da');
  for (const [key, text] of en) {
    if (text === english) {
      const translated = da.get(key);
      if (translated !== undefined) return translated;
    }
  }
  return null;
};

const field = (page: Page, locale: 'en' | 'da', label: string, index: number): Locator => {
  if (locale === 'en') return page.getByLabel(label, { exact: true });
  const translated = danishFor(label);
  return translated !== null ? page.getByLabel(translated, { exact: true }) : page.getByRole('textbox').nth(index);
};

/** Fills About you as Emil (born 14 March 1991) and presses Continue. */
const completeAboutYou = async (page: Page, locale: 'en' | 'da'): Promise<void> => {
  await field(page, locale, 'First name', 0).fill('Emil');
  await field(page, locale, 'Date of birth, Day', 1).fill('14');
  await field(page, locale, 'Date of birth, Month', 2).fill('3');
  await field(page, locale, 'Date of birth, Year', 3).fill('1991');

  const termsName = locale === 'en' ? 'I accept the Terms' : danishFor('I accept the Terms');
  const terms =
    termsName !== null ? page.getByRole('checkbox', { name: termsName }) : page.getByRole('checkbox').first();
  await terms.click();

  const continueName = locale === 'en' ? 'Continue' : danishFor('Continue');
  if (continueName === null) throw new Error('No Danish text for "Continue" in apps/mobile/src/i18n/da');
  await page.getByRole('button', { name: continueName, exact: true }).click();
};

const radioNames = async (group: Locator): Promise<string[]> => {
  const radios = group.getByRole('radio');
  const count = await radios.count();
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const radio = radios.nth(i);
    const label = (await radio.getAttribute('aria-label')) ?? (await radio.textContent()) ?? '';
    names.push(label.trim());
  }
  return names;
};

test(
  'The question lists eight answers and is optional',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await completeAboutYou(page, 'en');
    await page.getByText('Where do you live?', { exact: true }).first().waitFor();

    const heading = page.getByText(/Where did you hear about Friendpod\?\s*\(optional\)/).first();
    await heading.waitFor();
    expect(await heading.isVisible()).toBe(true);

    const hint = page.getByText(
      'We only count the answers per city and week; it is not saved on your profile.',
      { exact: true },
    );
    await hint.waitFor();
    expect(await hint.isVisible()).toBe(true);

    const group = page.getByRole('radiogroup', { name: 'Where did you hear about Friendpod?' });
    await group.waitFor();
    expect(await radioNames(group)).toEqual([
      "A dads' or parents' group",
      'A newcomer event',
      'University or school',
      'A poster at a café or venue',
      'A friend',
      'Social media',
      'News or press',
      'Somewhere else',
    ]);

    await app.saveScreen('the-question-lists-eight-answers-and-is-optional.png');
  },
  TIMEOUT,
);

test(
  'The question in Danish',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
    const page = app.page;

    await page.getByText('Om dig', { exact: true }).first().waitFor();
    await completeAboutYou(page, 'da');
    await page.getByText('Hvor bor du?', { exact: true }).first().waitFor();

    const heading = page.getByText(/Hvor hørte du om Friendpod\?\s*\(valgfrit\)/).first();
    await heading.waitFor();
    expect(await heading.isVisible()).toBe(true);

    const group = page.getByRole('radiogroup', { name: 'Hvor hørte du om Friendpod?' });
    await group.waitFor();
    const friend = group.getByRole('radio', { name: 'En ven', exact: true });
    const elsewhere = group.getByRole('radio', { name: 'Et andet sted', exact: true });
    expect(await friend.count()).toBe(1);
    expect(await elsewhere.count()).toBe(1);
    expect(await friend.isVisible()).toBe(true);
    expect(await elsewhere.isVisible()).toBe(true);

    await app.saveScreen('the-question-in-danish.png');
  },
  TIMEOUT,
);
