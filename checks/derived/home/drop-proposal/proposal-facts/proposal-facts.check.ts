// ail-derived-from: ProposalFacts@29641329ce4c1332
import { expect, test } from 'bun:test';

import { openApp } from '../../../../harness/preview';

type SeatCounts = { you: number; open: number };

test('The facts of the brætspil proposal', async () => {
  await using app = await openApp({ route: '/', world: 'member with a pod proposal', locale: 'en' });
  const page = app.page;

  // And 5 people, ages 29–38
  const size = page.getByText('5 people, ages 29–38', { exact: true });
  await size.first().waitFor({ state: 'visible' });
  expect(await size.count()).toBeGreaterThan(0);

  // And Near Aarhus C · everyone within about 10 km of you
  const area = page.getByText('Near Aarhus C · everyone within about 10 km of you', { exact: true });
  await area.first().waitFor({ state: 'visible' });
  expect(await area.count()).toBeGreaterThan(0);

  // And Some of you also share sourdough and trail running
  const share = page.getByText('Some of you also share sourdough and trail running', { exact: true });
  await share.first().waitFor({ state: 'visible' });
  expect(await share.count()).toBeGreaterThan(0);

  // And Names and photos appear when 4 people have said yes.
  const note = page.getByText('Names and photos appear when 4 people have said yes.', { exact: true });
  await note.first().waitFor({ state: 'visible' });
  expect(await note.count()).toBeGreaterThan(0);

  // Then the card shows You and four open seats.
  // The seats are hidden from screen readers, so they are found as they look: size.seat (44px) circles,
  // You with its text, the open ones drawn with a dashed ring.
  const seats: SeatCounts = await page.evaluate(() => {
    const isSeat = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      return Math.abs(rect.width - 44) < 1 && Math.abs(rect.height - 44) < 1;
    };
    const dashed = (el: Element): boolean => {
      if (window.getComputedStyle(el).borderTopStyle === 'dashed') return true;
      return Array.from(el.querySelectorAll('circle')).some((c) => {
        const dash = c.getAttribute('stroke-dasharray') ?? window.getComputedStyle(c).strokeDasharray;
        return dash !== '' && dash !== 'none';
      });
    };
    let you = 0;
    let open = 0;
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (!isSeat(el) || (el.parentElement !== null && isSeat(el.parentElement))) {
        continue;
      }
      const text = (el.textContent ?? '').trim();
      if (text === 'You') {
        you += 1;
      } else if (text === '' && dashed(el)) {
        open += 1;
      }
    }
    return { you, open };
  });
  expect(seats.you).toBeGreaterThanOrEqual(1);
  expect(seats.open).toBe(4);

  await app.saveScreen('the-facts-of-the-br-tspil-proposal.png');
});
