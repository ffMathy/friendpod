// ail-derived-from: MeetupFeedback@23a51b48ec31d4db
import { expect, test } from 'bun:test';
import type { Locator } from 'playwright';

import { openApp } from '../../../../harness/preview.ts';

const ROUTE = '/pod/braetspilpodaarhus46/feedback';
const POD_URL = /\/pod\/braetspilpodaarhus46\/?(\?.*)?$/;
const TIMEOUT = 180_000;
const OTHERS = ['Mette', 'Jonas', 'Sofie', 'Ahmed'];

async function visibleCount(locator: Locator): Promise<number> {
  const total = await locator.count();
  let visible = 0;
  for (let i = 0; i < total; i += 1) {
    if (await locator.nth(i).isVisible()) {
      visible += 1;
    }
  }
  return visible;
}

test(
  'Not there myself leaves only the pod question',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'en' });
    const page = app.page;
    await page.getByText('How did it go?', { exact: true }).first().waitFor();

    const notThere = page.getByRole('checkbox', { name: "I wasn't there myself" });
    await notThere.waitFor();
    await notThere.click();

    await page
      .getByText('Then you can skip who came and who to meet again. Just tell us about the pod below.', { exact: true })
      .first()
      .waitFor();

    for (const name of OTHERS) {
      expect(await visibleCount(page.getByRole('checkbox', { name: `${name} was there` }))).toBe(0);
      expect(await visibleCount(page.getByRole('radio', { name: `Yes, meet ${name} again` }))).toBe(0);
      expect(await visibleCount(page.getByRole('radio', { name: `No, don't meet ${name} again` }))).toBe(0);
      expect(await visibleCount(page.getByText(name, { exact: true }))).toBe(0);
    }
    expect(await visibleCount(page.getByText('Was there', { exact: true }))).toBe(0);
    expect(await visibleCount(page.getByText('Meet again', { exact: true }))).toBe(0);
    expect(await visibleCount(page.getByText('How was it overall?', { exact: true }))).toBe(0);
    expect(await visibleCount(page.getByRole('radiogroup', { name: 'How was it overall?' }))).toBe(0);
    for (let n = 1; n <= 5; n += 1) {
      expect(await visibleCount(page.getByRole('radio', { name: `${n} of 5` }))).toBe(0);
    }

    expect(
      await visibleCount(
        page.getByText('Then you can skip who came and who to meet again. Just tell us about the pod below.', {
          exact: true,
        }),
      ),
    ).toBeGreaterThan(0);
    expect(await visibleCount(page.getByRole('button', { name: 'Keep pod' }))).toBe(1);
    expect(await visibleCount(page.getByRole('button', { name: 'Not for me' }))).toBe(1);

    await app.saveScreen('not-there-myself-leaves-only-the-pod-question.png');
  },
  TIMEOUT,
);

test(
  'Keep pod sends the answers and returns to the pod',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'en' });
    const page = app.page;
    await page.getByText('How did it go?', { exact: true }).first().waitFor();

    const four = page.getByRole('radio', { name: '4 of 5' });
    await four.waitFor();
    await four.click();
    await page.getByRole('button', { name: 'Keep pod' }).click();

    await page.waitForURL(POD_URL);
    await page.getByText('The meetup chat is open', { exact: true }).first().waitFor();
    expect(await visibleCount(page.getByText('The meetup chat is open', { exact: true }))).toBeGreaterThan(0);
    expect(await visibleCount(page.getByText('How did it go?', { exact: true }))).toBe(0);

    await app.saveScreen('keep-pod-sends-the-answers-and-returns-to-the-pod.png');
  },
  TIMEOUT,
);

test(
  'Not for me also sends the answers',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'en' });
    const page = app.page;
    await page.getByText('How did it go?', { exact: true }).first().waitFor();

    const notForMe = page.getByRole('button', { name: 'Not for me' });
    await notForMe.waitFor();
    await notForMe.click();

    await page.waitForURL(POD_URL);
    await page.getByText('The meetup chat is open', { exact: true }).first().waitFor();
    expect(await visibleCount(page.getByText('The meetup chat is open', { exact: true }))).toBeGreaterThan(0);

    await app.saveScreen('not-for-me-also-sends-the-answers.png');
  },
  TIMEOUT,
);

test(
  'A pod the member is not in',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
    const page = app.page;

    await page.getByText('This pod no longer exists.', { exact: true }).first().waitFor();
    expect(await visibleCount(page.getByText('This pod no longer exists.', { exact: true }))).toBeGreaterThan(0);

    expect(await visibleCount(page.getByRole('radio'))).toBe(0);
    expect(await visibleCount(page.getByRole('checkbox'))).toBe(0);
    expect(await visibleCount(page.getByText('How was it overall?', { exact: true }))).toBe(0);
    expect(await visibleCount(page.getByText('Meet this pod again?', { exact: true }))).toBe(0);
    expect(await visibleCount(page.getByRole('button', { name: 'Keep pod' }))).toBe(0);
    expect(await visibleCount(page.getByRole('button', { name: 'Not for me' }))).toBe(0);

    await app.saveScreen('a-pod-the-member-is-not-in.png');
  },
  TIMEOUT,
);

test(
  'The form in Danish',
  async () => {
    await using app = await openApp({ route: ROUTE, world: 'member the morning after a meetup', locale: 'da' });
    const page = app.page;

    await page.getByText('Hvordan gik det?', { exact: true }).first().waitFor();
    for (const text of ['Hvordan gik det?', 'Hvem var der?', 'Var der', 'Ses igen', 'Hvordan var det alt i alt?']) {
      expect(await visibleCount(page.getByText(text, { exact: true }))).toBeGreaterThan(0);
    }
    expect(await visibleCount(page.getByRole('button', { name: 'Behold poden' }))).toBe(1);
    expect(await visibleCount(page.getByRole('button', { name: 'Nej tak' }))).toBe(1);

    await app.saveScreen('the-form-in-danish.png');
  },
  TIMEOUT,
);
