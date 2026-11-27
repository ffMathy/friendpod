// ail-derived-from: DropWaiting@9b47c68686763504
import { expect, test } from 'bun:test';
import type { Page } from 'playwright';

import { openApp } from '../../../harness/preview';

const TIMEOUT = 300_000;
const WORLD = 'member waiting for the others';

/** Visible text of the whole page, whitespace collapsed, so text composed from several elements reads as one. */
async function pageText(page: Page): Promise<string> {
  const text = await page.evaluate(() => document.body.innerText);
  return text.replace(/\s+/g, ' ');
}

/** Waits until the page's visible text contains `text`, then asserts it (for a readable failure). */
async function expectPageText(page: Page, text: string): Promise<void> {
  try {
    await page.waitForFunction(
      (t: string) => document.body.innerText.replace(/\s+/g, ' ').includes(t),
      text,
      { timeout: 15_000 },
    );
  } catch {
    // fall through to the assertion below, which reports what the page reads
  }
  expect(await pageText(page)).toContain(text);
}

test(
  'Waiting for the others',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    await expectPageText(page, 'Your weekly drop');
    await expectPageText(page, 'Week 46');

    await expectPageText(page, "You're in");
    await expectPageText(page, 'Open until Sat 18:00');
    await expectPageText(page, 'A pod around');
    await expectPageText(page, 'brætspil');

    await expectPageText(page, '3 of 5 said yes');
    await page.getByText('You', { exact: true }).first().waitFor({ state: 'visible' });
    await expectPageText(page, '4 needed');

    await expectPageText(
      page,
      "We'll let you know the moment the pod is confirmed. If someone says no, we may invite someone else who fits.",
    );

    const okay = page.getByRole('button', { name: 'Okay', exact: true });
    await okay.waitFor({ state: 'visible' });
    const leave = page.getByText('Changed your mind? Leave this pod', { exact: true });
    await leave.waitFor({ state: 'visible' });

    const okayBox = await okay.boundingBox();
    const leaveBox = await leave.boundingBox();
    expect(okayBox).not.toBeNull();
    expect(leaveBox).not.toBeNull();
    if (okayBox !== null && leaveBox !== null) {
      expect(leaveBox.y).toBeGreaterThanOrEqual(okayBox.y + okayBox.height);
    }

    await app.saveScreen('waiting-for-the-others.png');
  },
  TIMEOUT,
);

test(
  'Okay moves the pod to Your pods',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    const okay = page.getByRole('button', { name: 'Okay', exact: true });
    await okay.waitFor({ state: 'visible' });
    await okay.click();

    await expectPageText(page, 'This week');
    await expectPageText(page, 'Next drop');
    await expectPageText(page, 'in 6 days and 8 hours');

    await expectPageText(page, 'Your pods · 0 of 2 active');
    await expectPageText(page, 'brætspil');
    await expectPageText(page, 'Waiting for the others · 3 of 5 said yes');

    await app.saveScreen('okay-moves-the-pod-to-your-pods.png');
  },
  TIMEOUT,
);

test(
  'The waiting pod opens from Your pods',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'en' });
    const page = app.page;

    const okay = page.getByRole('button', { name: 'Okay', exact: true });
    await okay.waitFor({ state: 'visible' });
    await okay.click();
    await expectPageText(page, 'Your pods');

    const pod = page.getByText('brætspil', { exact: true }).first();
    await pod.waitFor({ state: 'visible' });
    await pod.click();

    await page.waitForURL(/\/pod\//, { timeout: 15_000 });
    await expectPageText(page, '3 of 5 said yes');

    await app.saveScreen('the-waiting-pod-opens-from-your-pods.png');
  },
  TIMEOUT,
);

test(
  'Waiting in Danish',
  async () => {
    await using app = await openApp({ route: '/', world: WORLD, locale: 'da' });
    const page = app.page;

    await expectPageText(page, 'Ugens drop');
    await expectPageText(page, 'Du er med');
    await expectPageText(page, 'Åben til lør. kl. 18.00');
    await expectPageText(page, '3 af 5 har sagt ja');
    await expectPageText(page, '4 skal sige ja');

    await page.getByRole('button', { name: 'Okay', exact: true }).waitFor({ state: 'visible' });
    await page.getByText('Fortrudt? Forlad poden', { exact: true }).waitFor({ state: 'visible' });

    await app.saveScreen('waiting-in-danish.png');
  },
  TIMEOUT,
);
