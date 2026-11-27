// ail-derived-from: NoPodReasonTexts@dd370bfba6f4943c
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

const EN_REASON =
  "Not enough people near you shared one of your interests and fit everyone's settings this time.";
const DA_REASON =
  'Der var ikke nok folk i nærheden, der delte en af dine interesser og passede til alles indstillinger denne gang.';

test(
  'The reason in English and Danish',
  async () => {
    {
      await using app = await openApp({ route: '/', world: 'member with no pod this week', locale: 'en' });
      const reason = app.page.getByText(EN_REASON, { exact: true });
      await reason.first().waitFor({ state: 'visible' });
      expect(await reason.count()).toBeGreaterThan(0);
      expect(await reason.first().isVisible()).toBe(true);
    }
    {
      await using app = await openApp({ route: '/', world: 'member with no pod this week', locale: 'da' });
      const reason = app.page.getByText(DA_REASON, { exact: true });
      await reason.first().waitFor({ state: 'visible' });
      expect(await reason.count()).toBeGreaterThan(0);
      expect(await reason.first().isVisible()).toBe(true);
      await app.saveScreen('the-reason-in-english-and-danish.png');
    }
  },
  300_000,
);
