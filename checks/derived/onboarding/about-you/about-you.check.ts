// ail-derived-from: AboutYou@25b3223a1f0f2e89
import { expect, test } from 'bun:test';
import { isTicked, openApp } from '../../../harness/preview';

const TIMEOUT = 180_000;

/** Waits until `check` resolves to true, polling, or fails after `ms`. */
async function eventually(check: () => Promise<boolean>, ms = 10_000): Promise<boolean> {
  const end = Date.now() + ms;
  for (;;) {
    if (await check()) {
      return true;
    }
    if (Date.now() > end) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

test(
  'The step starts empty and Continue waits',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await page.getByText('Step 1 of 6', { exact: true }).first().waitFor();
    await page.getByText('About you', { exact: true }).first().waitFor();

    expect(await page.getByLabel('First name').inputValue()).toBe('');
    expect(await page.getByLabel('Date of birth, Day').inputValue()).toBe('');
    expect(await page.getByLabel('Date of birth, Month').inputValue()).toBe('');
    expect(await page.getByLabel('Date of birth, Year').inputValue()).toBe('');

    const box = page.getByRole('checkbox', { name: 'I accept the Terms' });
    expect(await isTicked(box)).toBe(false);

    const next = page.getByRole('button', { name: 'Continue', exact: true });
    expect(await next.isDisabled()).toBe(true);

    await app.saveScreen('the-step-starts-empty-and-continue-waits.png');
  },
  TIMEOUT,
);

test(
  'The basics lead to step 2',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await page.getByLabel('First name').fill('Emil');
    await page.getByLabel('Date of birth, Day').fill('14');
    await page.getByLabel('Date of birth, Month').fill('03');
    await page.getByLabel('Date of birth, Year').fill('1991');
    await page.getByRole('checkbox', { name: 'I accept the Terms' }).click();

    const next = page.getByRole('button', { name: 'Continue', exact: true });
    expect(await eventually(async () => !(await next.isDisabled()))).toBe(true);

    await next.click();
    await page.getByText('Where do you live?', { exact: true }).first().waitFor();

    await app.saveScreen('the-basics-lead-to-step-2.png');
  },
  TIMEOUT,
);

test(
  'A first name with a digit is refused',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await page.getByLabel('Date of birth, Day').fill('14');
    await page.getByLabel('Date of birth, Month').fill('03');
    await page.getByLabel('Date of birth, Year').fill('1991');
    await page.getByRole('checkbox', { name: 'I accept the Terms' }).click();

    await page.getByLabel('First name').fill('Emil2');

    await page.getByText('Use letters only. No contact details.', { exact: true }).first().waitFor();
    const next = page.getByRole('button', { name: 'Continue', exact: true });
    expect(await next.isDisabled()).toBe(true);

    await app.saveScreen('a-first-name-with-a-digit-is-refused.png');
  },
  TIMEOUT,
);

test(
  'A long first name is accepted',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;
    const name = 'Maria Josefine Augusta Wilhelmine Charlotte';

    const field = page.getByLabel('First name');
    await field.fill(name);

    expect(await field.inputValue()).toBe(name);
    expect(await page.getByText('Use letters only. No contact details.').count()).toBe(0);

    await app.saveScreen('a-long-first-name-is-accepted.png');
  },
  TIMEOUT,
);

test(
  'Going back from the first step signs out',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'Back', exact: true }).click();

    await page.getByText('Continue with email', { exact: true }).first().waitFor();

    await app.saveScreen('going-back-from-the-first-step-signs-out.png');
  },
  TIMEOUT,
);

test(
  'The step in Danish',
  async () => {
    await using app = await openApp({ route: '/about', world: 'new member', locale: 'da' });
    const page = app.page;

    await page.getByText('Trin 1 af 6', { exact: true }).first().waitFor();
    await page.getByText('Om dig', { exact: true }).first().waitFor();
    await page.getByText('Fornavn', { exact: true }).first().waitFor();

    await page.getByLabel('Fornavn').fill('Emil2');

    await page.getByText('Brug kun bogstaver. Ingen kontaktoplysninger.', { exact: true }).first().waitFor();

    await app.saveScreen('the-step-in-danish.png');
  },
  TIMEOUT,
);
