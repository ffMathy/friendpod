// ail-derived-from: InfoMeetingSafely@3185a1a4125ca71b
import { expect, test } from 'bun:test';

import { openApp } from '../../../harness/preview.ts';

type Page = Awaited<ReturnType<typeof openApp>>['page'];

const ROUTE = '/info/safety';

/** Asserts that each text appears on the page, in the given order, and returns the page text. */
async function expectInOrder(page: Page, texts: readonly string[]): Promise<void> {
  const body = await page.locator('body').innerText();
  let from = 0;
  for (const text of texts) {
    const at = body.indexOf(text, from);
    expect(at, `"${text}" should appear after position ${from}`).toBeGreaterThanOrEqual(0);
    from = at + text.length;
  }
}

test('The tips for a member, with the pledge', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'en' });
  const page = app.page;

  await expect(page.getByRole('heading', { name: 'Meeting safely' }).first().isVisible()).resolves.toBe(true);
  await expect(
    page.getByText('A few habits that keep every meetup comfortable.', { exact: true }).first().isVisible(),
  ).resolves.toBe(true);
  await expect(page.getByText('In danger right now? Call 112.', { exact: true }).first().isVisible()).resolves.toBe(
    true,
  );
  await expectInOrder(page, ['A few habits that keep every meetup comfortable.', 'In danger right now? Call 112.']);

  await expect(page.getByRole('heading', { name: 'Before you go' }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByRole('heading', { name: 'At the meetup' }).first().isVisible()).resolves.toBe(true);

  const beforeTips = [
    'Meet in a public place in daytime or early evening.',
    'Arrange your own transport.',
    'Tell a friend where you are going.',
    'Never share your home address.',
  ];
  const atTips = [
    'You can leave at any time.',
    'Drink only if you want to, and at your own pace.',
    'Use Report in the pod if something feels wrong.',
  ];
  for (const tip of [...beforeTips, ...atTips]) {
    await expect(page.getByText(tip, { exact: true }).first().isVisible()).resolves.toBe(true);
  }
  await expectInOrder(page, ['Before you go', ...beforeTips, 'At the meetup', ...atTips]);

  const pledge = "I'll meet in public places, treat people with respect, and use Report if something feels wrong.";
  await expect(page.getByRole('heading', { name: 'Our safety pledge' }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByText(pledge, { exact: true }).first().isVisible()).resolves.toBe(true);
  await expectInOrder(page, [...atTips, 'Our safety pledge', pledge]);

  await app.saveScreen('the-tips-for-a-member-with-the-pledge.png');
});

test('Signed out, the tips without the pledge', async () => {
  await using app = await openApp({ route: ROUTE, world: 'signed out', locale: 'en' });
  const page = app.page;

  await expect(page.getByRole('heading', { name: 'Before you go' }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByRole('heading', { name: 'At the meetup' }).first().isVisible()).resolves.toBe(true);

  await expect(page.getByRole('heading', { name: 'Our safety pledge' }).count()).resolves.toBe(0);
  await expect(page.getByText('Our safety pledge', { exact: true }).count()).resolves.toBe(0);

  await app.saveScreen('signed-out-the-tips-without-the-pledge.png');
});

test('Meeting safely in Danish', async () => {
  await using app = await openApp({ route: ROUTE, world: 'member this week', locale: 'da' });
  const page = app.page;

  await expect(page.getByRole('heading', { name: 'Mød hinanden trygt' }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByText('I fare lige nu? Ring 112.', { exact: true }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByRole('heading', { name: 'Inden mødet' }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByRole('heading', { name: 'Under mødet' }).first().isVisible()).resolves.toBe(true);
  await expect(page.getByRole('heading', { name: 'Vores sikkerhedsløfte' }).first().isVisible()).resolves.toBe(true);

  await app.saveScreen('meeting-safely-in-danish.png');
});
