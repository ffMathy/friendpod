// ail-derived-from: NextDropPoster@0e96d8a9a5d113aa
import { expect, test } from 'bun:test';
import { openApp } from '../../../../harness/preview';

const TIMEOUT = 300_000;

test(
  'The next drop on Tuesday',
  async () => {
    await using app = await openApp({ route: '/', world: 'member this week', locale: 'en' });
    const page = app.page;

    const poster = page.getByRole('link', {
      name: /^Next drop,? Thursday 18:00[.,] in 2 days and 6 hours[.,] You're in this week\.?$/,
    });
    await poster.waitFor({ state: 'visible' });
    expect(await poster.isVisible()).toBe(true);

    const title = page.getByRole('heading', { name: 'This week', exact: true });
    await title.waitFor({ state: 'visible' });
    expect(await title.isVisible()).toBe(true);

    const week = page.getByText('Week 46', { exact: true });
    await week.waitFor({ state: 'visible' });
    expect(await week.isVisible()).toBe(true);

    const posterText = (await poster.textContent()) ?? '';
    expect(posterText).toContain('Next drop');
    expect(posterText).toContain('Thursday 18:00');
    expect(posterText).toContain('in 2 days and 6 hours');
    expect(posterText).toContain("You're in this week");

    const skip = page.getByRole('button', { name: 'Skip this week', exact: true });
    const pause = page.getByRole('button', { name: 'Pause matching', exact: true });
    await skip.waitFor({ state: 'visible' });
    await pause.waitFor({ state: 'visible' });
    expect(await skip.isVisible()).toBe(true);
    expect(await pause.isVisible()).toBe(true);

    await app.saveScreen('the-next-drop-on-tuesday.png');
  },
  TIMEOUT,
);

test(
  'Right after the drop the next one is a week away',
  async () => {
    await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
    const page = app.page;

    const notThisTime = page.getByRole('button', { name: 'Not this time', exact: true });
    await notThisTime.waitFor({ state: 'visible' });
    await notThisTime.click();

    const tooFar = page.getByText('Too far', { exact: true });
    await tooFar.waitFor({ state: 'visible' });
    await tooFar.click();

    const decline = page.getByRole('button', { name: 'Decline this pod', exact: true });
    await decline.waitFor({ state: 'visible' });
    await decline.click();

    const poster = page.getByRole('link', {
      name: /^Next drop,? Thursday 18:00[.,] in 6 days and 23 hours([.,]|$)/,
    });
    await poster.waitFor({ state: 'visible' });
    expect(await poster.isVisible()).toBe(true);

    const posterText = (await poster.textContent()) ?? '';
    expect(posterText).toContain('Next drop');
    expect(posterText).toContain('Thursday 18:00');
    expect(posterText).toContain('in 6 days and 23 hours');

    await app.saveScreen('right-after-the-drop-the-next-one-is-a-week-away.png');
  },
  TIMEOUT,
);
