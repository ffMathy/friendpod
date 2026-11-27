// ail-derived-from: FinalStep@932d6e31757880ca
import { describe, expect, test } from 'bun:test';

import { isTicked, openApp } from '../../../harness/preview';

const PLEDGE = "I'll meet in public places, treat people with respect, and use Report if something feels wrong.";
const TIMEOUT = 180_000;

async function eventually(check: () => Promise<boolean>, timeoutMs = 15_000): Promise<boolean> {
  const end = Date.now() + timeoutMs;
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

describe('FinalStep', () => {
  test(
    'Finish waits for the safety pledge',
    async () => {
      await using app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale: 'en' });
      const page = app.page;

      await page.getByText('Almost done', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByText('Step 6 of 6').first().waitFor({ state: 'visible' });

      const pledge = page.getByRole('checkbox', { name: PLEDGE });
      await pledge.waitFor({ state: 'visible' });
      expect(await isTicked(pledge)).toBe(false);

      const finish = page.getByRole('button', { name: 'Finish', exact: true });
      await finish.waitFor({ state: 'visible' });
      expect(await finish.isDisabled()).toBe(true);

      await pledge.click();
      expect(await eventually(async () => !(await finish.isDisabled()))).toBe(true);

      await app.saveScreen('finish-waits-for-the-safety-pledge.png');
    },
    TIMEOUT,
  );

  test(
    'Finishing opens Home',
    async () => {
      await using app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale: 'en' });
      const page = app.page;

      await page.getByText('Almost done', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });

      const pledge = page.getByRole('checkbox', { name: PLEDGE });
      await pledge.waitFor({ state: 'visible' });
      await pledge.click();

      const finish = page.getByRole('button', { name: 'Finish', exact: true });
      expect(await eventually(async () => !(await finish.isDisabled()))).toBe(true);
      await finish.click();

      expect(await eventually(async () => !new URL(page.url()).pathname.includes('almost-done'), 30_000)).toBe(true);
      await page.getByText('This week', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });

      await app.saveScreen('finishing-opens-home.png');
    },
    TIMEOUT,
  );

  test(
    'The step in Danish',
    async () => {
      await using app = await openApp({ route: '/almost-done', world: 'member on the last onboarding step', locale: 'da' });
      const page = app.page;

      await page.getByText('Næsten færdig', { exact: true }).first().waitFor({ state: 'visible', timeout: 30_000 });
      await page.getByText('Trin 6 af 6').first().waitFor({ state: 'visible' });

      const finish = page.getByRole('button', { name: 'Færdig', exact: true });
      await finish.waitFor({ state: 'visible' });
      expect(await finish.isDisabled()).toBe(true);

      await app.saveScreen('the-step-in-danish.png');
    },
    TIMEOUT,
  );
});
