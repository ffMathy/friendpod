// ail-derived-from: WaitlistShareCard@839fbde59682c3fe
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const TIMEOUT = 180_000;

test(
  'The share card for Odense',
  async () => {
    await using app = await openApp({ route: '/', world: 'member in a city on the waitlist', locale: 'en' });
    const page = app.page;

    const title = page.getByText('Help Odense open sooner', { exact: true });
    await title.waitFor({ state: 'visible' });
    expect(await title.isVisible()).toBe(true);

    const body = page.getByText(
      "Know someone who'd like to meet new people? Every person who joins brings your first pod closer.",
      { exact: true },
    );
    await body.waitFor({ state: 'visible' });
    expect(await body.isVisible()).toBe(true);

    const share = page.getByRole('button', { name: 'Share invite link', exact: true });
    await share.waitFor({ state: 'visible' });
    expect(await share.isVisible()).toBe(true);

    const link = page.getByText('friendpod.dk/c/odense', { exact: true });
    await link.waitFor({ state: 'visible' });
    expect(await link.isVisible()).toBe(true);

    const copy = page.getByRole('button', { name: 'Copy invite link', exact: true });
    await copy.waitFor({ state: 'visible' });
    expect(await copy.isVisible()).toBe(true);
    expect((await copy.textContent())?.trim()).toBe('Copy');

    await app.saveScreen('the-share-card-for-odense.png');
  },
  TIMEOUT,
);
