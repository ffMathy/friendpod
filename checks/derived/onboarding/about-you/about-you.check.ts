// ail-derived-from: AboutYou@c17554c57564a1ee
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { isTicked, openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

/** Polls a condition until it holds or the time runs out, then returns its last value. */
async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean, ms = 5_000): Promise<T> {
  const until = Date.now() + ms;
  let value = await read();
  while (!accept(value) && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

function firstName(page: Page): Locator {
  return page.getByLabel('First name', { exact: true });
}

function day(page: Page): Locator {
  return page.getByLabel('Date of birth, Day', { exact: true });
}

function month(page: Page): Locator {
  return page.getByLabel('Date of birth, Month', { exact: true });
}

function year(page: Page): Locator {
  return page.getByLabel('Date of birth, Year', { exact: true });
}

function terms(page: Page): Locator {
  return page.getByRole('checkbox', { name: 'I accept the Terms' });
}

function continueButton(page: Page, name = 'Continue'): Locator {
  return page.getByRole('button', { name, exact: true });
}

async function shows(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible', timeout: 10_000 });
  expect(await locator.first().isVisible()).toBe(true);
}

test(
  'The step starts empty and Continue waits',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await shows(page.getByText('Step 1 of 6', { exact: true }));
    await shows(page.getByText('About you', { exact: true }));

    expect(await firstName(page).inputValue()).toBe('');
    expect(await day(page).inputValue()).toBe('');
    expect(await month(page).inputValue()).toBe('');
    expect(await year(page).inputValue()).toBe('');

    expect(await isTicked(terms(page))).toBe(false);
    expect(await continueButton(page).isDisabled()).toBe(true);

    await app.saveScreen('the-step-starts-empty-and-continue-waits.png');
  },
  TIMEOUT,
);

test(
  'The basics lead to step 2',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shows(firstName(page));

    await firstName(page).fill('Emil');
    await day(page).fill('14');
    await month(page).fill('03');
    await year(page).fill('1991');
    await terms(page).click();

    const disabled = await eventually(
      () => continueButton(page).isDisabled(),
      (value) => !value,
    );
    expect(disabled).toBe(false);

    await continueButton(page).click();
    await shows(page.getByText('Where do you live?', { exact: true }));

    await app.saveScreen('the-basics-lead-to-step-2.png');
  },
  TIMEOUT,
);

test(
  'A first name with a digit is refused',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shows(firstName(page));

    await day(page).fill('14');
    await month(page).fill('03');
    await year(page).fill('1991');
    await terms(page).click();
    expect(await eventually(() => isTicked(terms(page)), (value) => value)).toBe(true);

    await firstName(page).fill('Emil2');

    await shows(page.getByText('Use letters only. No contact details.', { exact: true }));
    expect(await continueButton(page).isDisabled()).toBe(true);

    await app.saveScreen('a-first-name-with-a-digit-is-refused.png');
  },
  TIMEOUT,
);

test(
  'A long first name is accepted',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shows(firstName(page));

    const name = 'Maria Josefine Augusta Wilhelmine Charlotte';
    await firstName(page).fill(name);
    await firstName(page).press('End');

    expect(await firstName(page).inputValue()).toBe(name);

    const fits = await firstName(page).evaluate((element) => {
      const input = element as HTMLInputElement;
      return input.scrollWidth <= input.clientWidth;
    });
    if (!fits) {
      const scrolled = await firstName(page).evaluate((element) => (element as HTMLInputElement).scrollLeft);
      expect(scrolled).toBeGreaterThan(0);
    }

    expect(await page.getByText('Use letters only. No contact details.', { exact: true }).count()).toBe(0);

    await app.saveScreen('a-long-first-name-is-accepted.png');
  },
  TIMEOUT,
);

test(
  'Going back from the first step signs out',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    await shows(page.getByRole('button', { name: 'Back', exact: true }));

    await page.getByRole('button', { name: 'Back', exact: true }).click();

    await shows(page.getByText('Continue with email', { exact: true }));

    await app.saveScreen('going-back-from-the-first-step-signs-out.png');
  },
  TIMEOUT,
);

test(
  'The step in Danish',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
    const page = app.page;

    await shows(page.getByText('Trin 1 af 6', { exact: true }));
    await shows(page.getByText('Om dig', { exact: true }));
    await shows(page.getByText('Fornavn', { exact: true }));

    await page.getByLabel('Fornavn', { exact: true }).fill('Emil2');

    await shows(page.getByText('Brug kun bogstaver. Ingen kontaktoplysninger.', { exact: true }));

    await app.saveScreen('the-step-in-danish.png');
  },
  TIMEOUT,
);
