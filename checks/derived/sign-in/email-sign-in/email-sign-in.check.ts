// ail-derived-from: EmailSignIn@ad1f6fe3dcfafc4c
import { expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview.ts';

const TIMEOUT = 180_000;

/** Polls `read` until it returns `expected` or the time runs out, then returns the last value read. */
async function eventually<T>(read: () => Promise<T>, expected: T, ms = 10_000): Promise<T> {
  const until = Date.now() + ms;
  let value = await read();
  while (value !== expected && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    value = await read();
  }
  return value;
}

test(
  'Send waits for a whole address',
  async () => {
    await using app = await openApp({ route: '/email', world: 'signed out', locale: 'en' });
    const page = app.page;
    const field = page.getByLabel('Email address');
    const send = page.getByRole('button', { name: 'Send me a sign-in link' });

    await field.fill('emil@example');
    expect(await eventually(() => send.isDisabled(), true)).toBe(true);

    await field.fill('emil@example.com');
    expect(await eventually(() => send.isDisabled(), false)).toBe(false);

    await app.saveScreen('send-waits-for-a-whole-address.png');
  },
  TIMEOUT,
);

test(
  'Sending the link',
  async () => {
    await using app = await openApp({ route: '/email', world: 'signed out', locale: 'en' });
    const page = app.page;

    await page.getByLabel('Email address').fill('  emil@example.com  ');
    await page.getByRole('button', { name: 'Send me a sign-in link' }).click();

    const note = page.getByRole('alert').filter({ hasText: 'Check your inbox' });
    await note.waitFor({ state: 'visible' });
    const text = (await note.textContent()) ?? '';
    expect(text).toContain('Check your inbox');
    expect(text).toContain('We sent a link to emil@example.com. Open it on this phone to sign in.');

    await page.getByRole('button', { name: 'Send a new link' }).waitFor({ state: 'visible' });

    await app.saveScreen('sending-the-link.png');
  },
  TIMEOUT,
);

test(
  'The return key sends the link',
  async () => {
    await using app = await openApp({ route: '/email', world: 'signed out', locale: 'en' });
    const page = app.page;

    const field = page.getByLabel('Email address');
    await field.fill('emil@example.com');
    await field.press('Enter');

    const note = page.getByRole('alert').filter({ hasText: 'Check your inbox' });
    await note.waitFor({ state: 'visible' });
    expect((await note.textContent()) ?? '').toContain('Check your inbox');

    await app.saveScreen('the-return-key-sends-the-link.png');
  },
  TIMEOUT,
);

test(
  'An address kept from an earlier link fills the field',
  async () => {
    await using app = await openApp({ route: '/email', world: 'signed out, email link sent', locale: 'en' });
    const field = app.page.getByLabel('Email address');
    await field.waitFor({ state: 'visible' });

    expect(await eventually(() => field.inputValue(), 'emil@example.com')).toBe('emil@example.com');

    await app.saveScreen('an-address-kept-from-an-earlier-link-fills-the-field.png');
  },
  TIMEOUT,
);

test(
  'Back returns to the welcome screen',
  async () => {
    await using app = await openApp({ route: '/', world: 'signed out', locale: 'en' });
    const page = app.page;

    await page.getByRole('button', { name: 'Continue with email' }).click();
    await page.getByLabel('Email address').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'Back' }).click();

    await page.getByRole('button', { name: 'Continue with email' }).waitFor({ state: 'visible' });
    expect(await page.getByRole('button', { name: 'Continue with email' }).isVisible()).toBe(true);

    await app.saveScreen('back-returns-to-the-welcome-screen.png');
  },
  TIMEOUT,
);

test(
  'The email step in Danish',
  async () => {
    await using app = await openApp({ route: '/email', world: 'signed out', locale: 'da' });
    const page = app.page;

    await page.getByLabel('E-mailadresse').fill('emil@example.com');
    await page.getByRole('button', { name: 'Send mig et login-link' }).click();

    const note = page.getByRole('alert').filter({ hasText: 'Tjek din indbakke' });
    await note.waitFor({ state: 'visible' });
    const text = (await note.textContent()) ?? '';
    expect(text).toContain('Tjek din indbakke');
    expect(text).toContain('Vi har sendt et link til emil@example.com. Åbn det på denne telefon for at logge ind.');

    await app.saveScreen('the-email-step-in-danish.png');
  },
  TIMEOUT,
);
