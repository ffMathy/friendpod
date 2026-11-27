// ail-derived-from: PlanMeetup@5d4320b1b200e7d9
import { expect, test } from 'bun:test';
import type { Locator, Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const POD_ID = 'braetspilpodaarhus46';
const PLANNER = `/pod/${POD_ID}/plan`;
const POD_PAGE = `/pod/${POD_ID}`;
const TIMEOUT = 180_000;

const SAT = 'Saturday 21 Nov, 14:00';
const SUN = 'Sunday 22 Nov, 11:00';

async function eventually(check: () => Promise<boolean>, what: string, ms = 10_000): Promise<void> {
  const until = Date.now() + ms;
  for (;;) {
    if (await check()) {
      return;
    }
    if (Date.now() > until) {
      throw new Error(`Timed out waiting for: ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/** The innermost block holding the option's time heading and its buttons, without the other option's heading. */
function optionCard(page: Page, time: string, otherTime: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: time, exact: true }) })
    .filter({ has: page.getByRole('button') })
    .filter({ hasNot: page.getByRole('heading', { name: otherTime, exact: true }) })
    .last();
}

async function cardText(card: Locator): Promise<string> {
  return ((await card.textContent()) ?? '').replace(/\s+/g, ' ');
}

function yesCount(n: number): RegExp {
  return new RegExp(`(?<!\\d)${n}\\s*yes`);
}

async function hasYesCount(card: Locator, n: number): Promise<boolean> {
  return yesCount(n).test(await cardText(card));
}

async function isLeading(card: Locator, word = 'Leading'): Promise<boolean> {
  return (await cardText(card)).includes(word);
}

async function visible(locator: Locator): Promise<void> {
  await locator.first().waitFor({ state: 'visible', timeout: 15_000 });
}

test(
  'The planner shows the options to vote on',
  async () => {
    await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'en' });
    const page = app.page;

    await visible(page.getByText('Plan the meetup', { exact: true }));
    await visible(page.getByText('Voting closes Tuesday 18:00'));

    await visible(page.getByRole('heading', { name: SAT, exact: true }));
    await visible(page.getByRole('heading', { name: SUN, exact: true }));
    const sat = optionCard(page, SAT, SUN);
    const sun = optionCard(page, SUN, SAT);
    await eventually(async () => (await isLeading(sat)) && (await hasYesCount(sat, 3)), 'Saturday Leading with 3 yes');
    await eventually(() => hasYesCount(sun, 2), 'Sunday with 2 yes');

    const suggest = page.getByRole('button', { name: /Suggest another time \(1 spot left\)/ });
    await visible(suggest);
    expect(await suggest.first().isDisabled()).toBe(false);
    const done = page.getByRole('button', { name: 'Done voting' });
    await visible(done);
    expect(await done.first().isDisabled()).toBe(false);

    const rules = page.getByText(/The option with the most yes votes \(at least 3\) wins when voting closes/);
    await visible(rules);
    const hint = page.getByText('Press and hold an option to report it.');
    await visible(hint);
    const rulesBox = await rules.first().boundingBox();
    const hintBox = await hint.first().boundingBox();
    expect(rulesBox).not.toBeNull();
    expect(hintBox).not.toBeNull();
    if (rulesBox && hintBox) {
      expect(hintBox.y + hintBox.height).toBeGreaterThanOrEqual(rulesBox.y + rulesBox.height - 1);
    }

    await app.saveScreen('the-planner-shows-the-options-to-vote-on.png');
  },
  TIMEOUT,
);

test(
  'A yes and a yes taken back move the lead',
  async () => {
    await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'en' });
    const page = app.page;

    await visible(page.getByRole('heading', { name: SAT, exact: true }));
    const sat = optionCard(page, SAT, SUN);
    const sun = optionCard(page, SUN, SAT);
    await eventually(() => hasYesCount(sat, 3), 'Saturday starts with 3 yes');

    await page.getByRole('button', { name: `Yes to ${SUN}`, exact: true }).click();
    await eventually(() => hasYesCount(sun, 3), 'Sunday has 3 yes');
    await eventually(async () => (await isLeading(sat)) && !(await isLeading(sun)), 'Saturday stays Leading');

    await page.getByRole('button', { name: `Yes to ${SAT}`, exact: true }).click();
    await eventually(() => hasYesCount(sat, 2), 'Saturday has 2 yes');
    await eventually(async () => (await isLeading(sun)) && !(await isLeading(sat)), 'Sunday is Leading');

    await app.saveScreen('a-yes-and-a-yes-taken-back-move-the-lead.png');
  },
  TIMEOUT,
);

test(
  'Done voting returns to the pod',
  async () => {
    await using app = await openApp({ route: POD_PAGE, world: 'member planning a meetup', locale: 'en' });
    const page = app.page;

    const plan = page
      .getByRole('button', { name: 'Plan the meetup' })
      .or(page.getByRole('link', { name: 'Plan the meetup' }));
    await visible(plan);
    await plan.first().click();

    const done = page.getByRole('button', { name: 'Done voting' });
    await visible(done);
    await done.first().click();

    await eventually(async () => (await done.count()) === 0 || !(await done.first().isVisible()), 'planner closed');
    await visible(page.getByText('brætspil'));

    await app.saveScreen('done-voting-returns-to-the-pod.png');
  },
  TIMEOUT,
);

test(
  'A pod with no options yet',
  async () => {
    await using app = await openApp({ route: PLANNER, world: 'member of a confirmed pod', locale: 'en' });
    const page = app.page;

    await visible(
      page.getByText('No times yet. Suggest a time and a public place, and the others can vote on it.'),
    );
    const suggest = page.getByRole('button', { name: /Suggest a time \(3 spots left\)/ });
    await visible(suggest);
    expect(await suggest.first().isDisabled()).toBe(false);
    const back = page.getByRole('button', { name: 'Back to the pod' });
    await visible(back);
    expect(await back.first().isDisabled()).toBe(false);

    await visible(page.getByText(/The option with the most yes votes \(at least 3\) wins when voting closes/));
    expect(await page.getByText('Press and hold an option to report it.').count()).toBe(0);
    const body = (await page.locator('body').textContent()) ?? '';
    expect(body.includes('report')).toBe(false);

    await app.saveScreen('a-pod-with-no-options-yet.png');
  },
  TIMEOUT,
);

test(
  'The planner in Danish',
  async () => {
    await using app = await openApp({ route: PLANNER, world: 'member planning a meetup', locale: 'da' });
    const page = app.page;

    const satDa = 'Lørdag 21. nov. kl. 14.00';
    const sunDa = 'Søndag 22. nov. kl. 11.00';

    await visible(page.getByText('Planlæg mødet', { exact: true }));
    await visible(page.getByText('Afstemningen lukker tirsdag kl. 18.00'));
    await visible(page.getByRole('heading', { name: satDa, exact: true }));
    const sat = optionCard(page, satDa, sunDa);
    await eventually(() => isLeading(sat, 'Fører'), 'Lørdag with Fører');

    const suggest = page.getByRole('button', { name: /Foreslå et nyt tidspunkt \(1 ledig plads\)/ });
    await visible(suggest);
    expect(await suggest.first().isDisabled()).toBe(false);
    const done = page.getByRole('button', { name: 'Færdig med at stemme' });
    await visible(done);
    expect(await done.first().isDisabled()).toBe(false);

    await app.saveScreen('the-planner-in-danish.png');
  },
  TIMEOUT,
);
