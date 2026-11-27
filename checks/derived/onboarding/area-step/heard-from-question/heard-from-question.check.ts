// ail-derived-from: HeardFromQuestion@413afd476104e03e
import { expect, test } from 'bun:test';
import { openApp } from '../../../../harness/preview';

type App = Awaited<ReturnType<typeof openApp>>;

/**
 * Reaches "Where do you live?" the way the Given says: after About you.
 * Assumes opening "/" as a signed-in, not-onboarded member lands on About you.
 */
async function goToAreaStepAfterAboutYou(app: App, labels: AboutYouLabels): Promise<void> {
  const page = app.page;
  await page.getByLabel(labels.firstName).fill('Mathias');
  await page.getByLabel(labels.day).fill('14');
  await page.getByLabel(labels.month).fill('3');
  await page.getByLabel(labels.year).fill('1995');
  await page.getByRole('checkbox', { name: labels.terms }).click();
  await page.getByRole('button', { name: labels.continue }).click();
  await page.getByRole('heading', { name: labels.areaTitle }).waitFor();
}

interface AboutYouLabels {
  firstName: string;
  day: string;
  month: string;
  year: string;
  terms: string;
  continue: string;
  areaTitle: string;
}

test('The question lists eight answers and is optional', async () => {
  await using app = await openApp({ route: '/', world: 'new member', locale: 'en' });
  await goToAreaStepAfterAboutYou(app, {
    firstName: 'First name',
    day: 'Date of birth, Day',
    month: 'Date of birth, Month',
    year: 'Date of birth, Year',
    terms: 'I accept the Terms',
    continue: 'Continue',
    areaTitle: 'Where do you live?',
  });
  const page = app.page;

  const group = page.getByRole('radiogroup', { name: 'Where did you hear about Friendpod?' });
  await group.waitFor();
  const groupText = (await page.locator('body').textContent()) ?? '';
  expect(groupText).toContain('Where did you hear about Friendpod?');
  expect(groupText).toContain('(optional)');
  await expect(
    page.getByText('We only count the answers per city and week; it is not saved on your profile.'),
  ).toBeTruthy();
  expect(groupText).toContain('We only count the answers per city and week; it is not saved on your profile.');

  const expected = [
    "A dads' or parents' group",
    'A newcomer event',
    'University or school',
    'A poster at a café or venue',
    'A friend',
    'Social media',
    'News or press',
    'Somewhere else',
  ];
  const radios = group.getByRole('radio');
  expect(await radios.count()).toBe(expected.length);
  const names: string[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    const name = (await radios.nth(i).textContent()) ?? '';
    names.push(name.trim());
  }
  expect(names).toEqual(expected);

  await app.saveScreen('the-question-lists-eight-answers-and-is-optional.png');
});

test('The question in Danish', async () => {
  await using app = await openApp({ route: '/', world: 'new member', locale: 'da' });
  await goToAreaStepAfterAboutYou(app, {
    firstName: 'Fornavn',
    day: 'Fødselsdato, Dag',
    month: 'Fødselsdato, Måned',
    year: 'Fødselsdato, År',
    terms: 'Jeg accepterer Vilkårene',
    continue: 'Fortsæt',
    areaTitle: 'Hvor bor du?',
  });
  const page = app.page;

  const group = page.getByRole('radiogroup', { name: 'Hvor hørte du om Friendpod?' });
  await group.waitFor();
  const bodyText = (await page.locator('body').textContent()) ?? '';
  expect(bodyText).toContain('Hvor hørte du om Friendpod?');
  expect(bodyText).toContain('(valgfrit)');
  expect(await group.getByRole('radio', { name: 'En ven' }).count()).toBe(1);
  expect(await group.getByRole('radio', { name: 'Et andet sted' }).count()).toBe(1);

  await app.saveScreen('the-question-in-danish.png');
});
