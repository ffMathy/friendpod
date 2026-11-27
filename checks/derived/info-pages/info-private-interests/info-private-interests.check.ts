// ail-derived-from: InfoPrivateInterests@775704214fb73d06
import { expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview';

const ROUTE = '/info/sensitive-interests';
const TIMEOUT = 300_000;

test(
  'The page says how private interests are protected',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
    const page = app.page;

    await page.getByRole('heading', { name: 'Private interests', exact: true }).first().waitFor({ state: 'visible' });
    await expect(page.getByRole('heading', { name: 'Private interests', exact: true }).first().isVisible()).resolves.toBe(
      true,
    );

    const lede = page.getByText('Some interests say more about you than others. This is how we look after them.', {
      exact: true,
    });
    expect(await lede.isVisible()).toBe(true);

    expect(await page.getByText('When you add an interest', { exact: true }).isVisible()).toBe(true);
    const notice = page.getByText(
      'If it says something about your health, beliefs, sexuality, politics, ethnic origin or union membership, ' +
        'we only save it if you have agreed to sensitive interests. We then keep it private and use it only as ' +
        'the theme of a pod. Only add things that are about you.',
      { exact: true },
    );
    expect(await notice.isVisible()).toBe(true);

    const headingNames = ['What counts as private', 'Where we keep them', 'Who sees them', 'If you change your mind'];
    for (const name of headingNames) {
      expect(await page.getByRole('heading', { name, exact: true }).isVisible()).toBe(true);
    }

    const who = page.getByText(
      'Only people invited to a pod built around the interest, and only if they added it too.',
      { exact: true },
    );
    expect(await who.isVisible()).toBe(true);

    const risk = page.getByText(
      'We cannot verify who people are, so only share in a pod what you are comfortable with.',
      { exact: true },
    );
    expect(await risk.isVisible()).toBe(true);
    await risk.scrollIntoViewIfNeeded();

    const riskBox = await risk.boundingBox();
    expect(riskBox).not.toBeNull();
    const withdraw = page.getByText(
      'You can withdraw your consent at any time. We then delete all your private interests and take you out of ' +
        'pods built around them. To stop one interest only, remove it.',
      { exact: true },
    );
    const others = [
      lede,
      notice,
      who,
      withdraw,
      ...headingNames.map((name) => page.getByRole('heading', { name, exact: true })),
    ];
    for (const other of others) {
      const box = await other.boundingBox();
      expect(box).not.toBeNull();
      if (box !== null && riskBox !== null) {
        expect(riskBox.y).toBeGreaterThanOrEqual(box.y + box.height);
      }
    }

    await app.saveScreen('the-page-says-how-private-interests-are-protected.png');
  },
  TIMEOUT,
);

test(
  'Private interests in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'da' });
    const page = app.page;

    // isVisible does not wait: wait for the page to render first.
    await page.getByRole('heading', { name: 'Private interesser', exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('Når du tilføjer en interesse', { exact: true }).waitFor({ state: 'visible' });
    expect(
      await page.getByRole('heading', { name: 'Private interesser', exact: true }).first().isVisible(),
    ).toBe(true);
    expect(await page.getByText('Når du tilføjer en interesse', { exact: true }).isVisible()).toBe(true);
    for (const name of ['Hvad der tæller som privat', 'Hvor vi gemmer dem', 'Hvem der ser dem', 'Hvis du fortryder']) {
      expect(await page.getByRole('heading', { name, exact: true }).isVisible()).toBe(true);
    }

    await app.saveScreen('private-interests-in-danish.png');
  },
  TIMEOUT,
);
