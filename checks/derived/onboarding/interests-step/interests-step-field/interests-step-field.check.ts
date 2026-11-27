// ail-derived-from: InterestsStepField@93df91b3a2f14779
import { expect, test } from 'bun:test';
import { openApp } from '../../../../harness/preview.ts';

const TIMEOUT = 300_000;

type App = Awaited<ReturnType<typeof openApp>>;

async function addInterest(app: App, fieldLabel: string, addLabel: string, text: string): Promise<void> {
  const field = app.page.getByLabel(fieldLabel, { exact: true });
  // fill waits until the field can be used (the phone is ready to check interests)
  await field.fill(text);
  await app.page.getByRole('button', { name: addLabel, exact: true }).click();
}

async function waitForText(app: App, text: string): Promise<void> {
  await app.page.getByText(text).first().waitFor({ state: 'visible' });
}

test(
  'A one-letter interest is refused',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
    await addInterest(app, 'Add an interest in your own words', 'Add', 'a');
    await waitForText(app, 'An interest needs at least 2 characters.');
    expect(await app.page.getByText('An interest needs at least 2 characters.').first().isVisible()).toBe(true);
    const field = app.page.getByLabel('Add an interest in your own words', { exact: true });
    expect(await field.inputValue()).toBe('a');
    await app.saveScreen('a-one-letter-interest-is-refused.png');
  },
  TIMEOUT,
);

test(
  'An interest with a phone number is refused',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
    await addInterest(app, 'Add an interest in your own words', 'Add', 'ring me on 12345678');
    const message = 'Interests cannot contain contact details such as phone numbers, emails, links or handles.';
    await waitForText(app, message);
    expect(await app.page.getByText(message).first().isVisible()).toBe(true);
    await app.saveScreen('an-interest-with-a-phone-number-is-refused.png');
  },
  TIMEOUT,
);

test(
  "Someone else's sensitive situation is refused",
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'en' });
    await addInterest(app, 'Add an interest in your own words', 'Add', 'my brother has diabetes');
    const message =
      "This seems to describe someone else's sensitive situation. Describe your own instead, " +
      'for example “parent of an autistic child”.';
    await waitForText(app, message);
    expect(await app.page.getByText(message).first().isVisible()).toBe(true);
    await app.saveScreen('someone-else-s-sensitive-situation-is-refused.png');
  },
  TIMEOUT,
);

test(
  'The notice and a refusal in Danish',
  async () => {
    await using app = await openApp({ route: '/add-interests', world: 'member adding interests', locale: 'da' });
    const notice = app.page.getByText(/^\s*Tip: Interesser, der siger noget om dit helbred/).first();
    await notice.waitFor({ state: 'visible' });
    const noticeText = (await notice.textContent()) ?? '';
    expect(noticeText.trim().startsWith('Tip: Interesser, der siger noget om dit helbred')).toBe(true);

    await addInterest(app, 'Tilføj en interesse med egne ord', 'Tilføj', 'a');
    await waitForText(app, 'En interesse skal have mindst 2 tegn.');
    expect(await app.page.getByText('En interesse skal have mindst 2 tegn.').first().isVisible()).toBe(true);
    await app.saveScreen('the-notice-and-a-refusal-in-danish.png');
  },
  TIMEOUT,
);
