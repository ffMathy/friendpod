// ail-derived-from: PrivatePodPage@099ba2114749f7eb
// End-to-end check of PrivatePodPage (ail/pod-page/private-pod-page): each test is one of its scenarios, by name,
// played through the running app as a user would, with what the user sees: labels, roles, copy texts and colours.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Locator, Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const GRAVID = '/pod/privatepodaarhusweek';
const INK = 'rgb(24, 33, 29)';
const WHITE = 'rgb(255, 255, 255)';
const INK_2 = 'rgb(58, 66, 61)';

const visible = async (page: Page, text: string) => {
  await page.getByText(text, { exact: true }).first().waitFor();
  return page.getByText(text, { exact: true }).first().isVisible();
};
/** The colour of a text and the colour behind it (the first ancestor with a background), as the user sees them. */
const colours = (el: Locator) =>
  el.evaluate((node) => {
    let behind: string | null = null;
    for (let e: Element | null = node; e && !behind; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') behind = c;
    }
    return { text: getComputedStyle(node).color, behind };
  });
const SWITCH = 'Show my photo to this pod';
const HINT = 'In a pod about a private interest, photos stay hidden until each person chooses to show theirs. Yours shows once you turn this on.';

test('The private reveal hides photos until shown', async () => {
  await using app = await openApp({ route: GRAVID, world: 'member of a confirmed private pod', locale: 'en' });
  const { page } = app;
  const name = page.getByRole('heading', { name: 'gravid', exact: true });
  await name.waitFor();
  expect(await visible(page, 'Confirmed')).toBe(true);
  expect(await page.getByRole('img', { name: 'Private interest', exact: true }).isVisible()).toBe(true);
  expect(await colours(name)).toEqual({ text: INK, behind: WHITE });
  const line = page.getByRole('link', { name: 'Line', exact: true });
  expect(await line.getByRole('img', { name: 'Photo of Line', exact: true }).count()).toBe(1);
  for (const member of ['Mads', 'Sara', 'Nikolaj']) {
    const row = page.getByRole('link', { name: member, exact: true });
    expect(await row.getByRole('img', { name: `Photo of ${member}` }).count()).toBe(0);
    expect((await colours(row.getByText(member[0] ?? '', { exact: true }))).behind).toBe(INK_2);
  }
  expect(await page.getByRole('switch', { name: SWITCH, exact: true }).isVisible()).toBe(true);
  expect(await page.getByText(HINT, { exact: true }).isVisible()).toBe(true);
  expect(await visible(page, 'In their own words')).toBe(true);
  expect(await page.getByText('Moved to Aarhus in the summer, always up for a walk by the water').isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Plan the meetup', exact: true }).isVisible()).toBe(true);
  expect(await visible(page, 'Pick a time by Tuesday 18:00')).toBe(true);
});

test('The private pod the day before its meetup', async () => {
  await using app = await openApp({ route: GRAVID, world: 'member the day before a private meetup', locale: 'en' });
  const { page } = app;
  const name = page.getByRole('heading', { name: 'gravid', exact: true });
  await name.waitFor();
  expect(await visible(page, '5 people near Aarhus C')).toBe(true);
  expect(await colours(name)).toEqual({ text: INK, behind: WHITE });
  expect(await page.getByRole('img', { name: 'Private', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('heading', { name: 'The meetup chat is open', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('button', { name: 'Open chat', exact: true }).isVisible()).toBe(true);
  expect(await visible(page, 'Saturday 5 Dec, 14:00')).toBe(true);
  expect(await visible(page, "You're coming.")).toBe(true);
  expect(await page.getByRole('link', { name: "Nikolaj hasn't confirmed", exact: true }).isVisible()).toBe(true);
  // The page ends with the switch: it comes after the last member row.
  const members = await page.getByRole('link', { name: "Nikolaj hasn't confirmed", exact: true }).boundingBox();
  const toggle = await page.getByRole('switch', { name: SWITCH, exact: true }).boundingBox();
  expect(members && toggle && toggle.y > members.y).toBe(true);
});

test('The private reveal in Danish', async () => {
  await using app = await openApp({ route: GRAVID, world: 'member of a confirmed private pod', locale: 'da' });
  const { page } = app;
  expect(await visible(page, 'Bekræftet')).toBe(true);
  expect(await page.getByRole('heading', { name: 'gravid', exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('switch', { name: 'Vis mit billede i denne pod', exact: true }).isVisible()).toBe(true);
});
