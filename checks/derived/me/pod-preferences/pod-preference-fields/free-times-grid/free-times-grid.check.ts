// ail-derived-from: FreeTimesGrid@dea49ede3029275e
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { isTicked, openApp } from '../../../../../harness/preview';

const TIMEOUT_MS = 180_000;

/** Waits until the box shows (or stops showing) its tick, then returns what it shows. */
async function tickedSoon(box: Locator, want: boolean, timeoutMs = 5_000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  let ticked = await isTicked(box);
  while (ticked !== want && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    ticked = await isTicked(box);
  }
  return ticked;
}

test(
  'Ticking and unticking a time',
  async () => {
    await using app = await openApp({ route: '/settings/preferences', world: 'member this week', locale: 'en' });
    const page = app.page;

    const saturdayEvening = page.getByRole('checkbox', { name: 'Saturday, evening', exact: true });
    const sundayDaytime = page.getByRole('checkbox', { name: 'Sunday, daytime', exact: true });
    await saturdayEvening.waitFor({ state: 'visible' });
    await sundayDaytime.waitFor({ state: 'visible' });

    // Tick Saturday, evening (if it already shows a tick, flip it off first so the tick itself is exercised).
    if (await isTicked(saturdayEvening)) {
      await saturdayEvening.click();
      expect(await tickedSoon(saturdayEvening, false)).toBe(false);
    }
    await saturdayEvening.click();
    expect(await tickedSoon(saturdayEvening, true)).toBe(true);

    // Untick Sunday, daytime (if it shows no tick yet, tick it first so the untick itself is exercised).
    if (!(await isTicked(sundayDaytime))) {
      await sundayDaytime.click();
      expect(await tickedSoon(sundayDaytime, true)).toBe(true);
    }
    await sundayDaytime.click();
    expect(await tickedSoon(sundayDaytime, false)).toBe(false);

    expect(await isTicked(saturdayEvening)).toBe(true);
    expect(await isTicked(sundayDaytime)).toBe(false);

    await app.saveScreen('ticking-and-unticking-a-time.png');
  },
  TIMEOUT_MS,
);

test(
  'The grid in Danish',
  async () => {
    await using app = await openApp({ route: '/settings/preferences', world: 'member this week', locale: 'da' });
    const page = app.page;

    for (const text of ['Hvornår har du typisk tid?', 'Hverdage', 'Lørdag', 'Søndag', 'Dag', 'Aften']) {
      const shown = page.getByText(text, { exact: true }).first();
      await shown.waitFor({ state: 'visible' });
      expect(await shown.isVisible()).toBe(true);
    }

    await app.saveScreen('the-grid-in-danish.png');
  },
  TIMEOUT_MS,
);
