// End-to-end check of InterestsWithoutConsent (ail/interests/interests-without-consent): each test is one of its
// scenarios, by name, played through the running app as a user would, with what the user sees: labels, roles and the
// copy texts.
import { afterAll, expect, setDefaultTimeout, test } from 'bun:test';
import type { Page } from 'playwright';
import { closeApps, openApp } from '../../../harness/preview.ts';

setDefaultTimeout(60_000);
afterAll(closeApps);

const REFUSED =
  "This interest may be sensitive, so we only save it if you've agreed to sensitive interests. Nothing was sent or saved. You can give consent in Settings → Privacy.";
const NOTICE =
  "Tip: interests that say something about your health, beliefs, sexuality, politics, ethnic origin or union membership are only saved if you have agreed to sensitive interests (Settings → Privacy). We then keep them private and use them only as a pod's theme. Only add things about yourself.";

async function onInterests(locale: 'en' | 'da' = 'en') {
  const app = await openApp({ route: '/interests', world: 'member without private-interest consent', locale });
  await app.page.getByText(locale === 'en' ? '4 of 20' : '4 af 20', { exact: true }).waitFor();
  return app;
}
const field = (page: Page, locale: 'en' | 'da' = 'en') =>
  page.getByLabel(locale === 'en' ? 'Add an interest in your own words' : 'Tilføj en interesse med egne ord', { exact: true });

async function add(page: Page, text: string, locale: 'en' | 'da' = 'en') {
  await field(page, locale).fill(text);
  await page.getByRole('button', { name: locale === 'en' ? 'Add' : 'Tilføj', exact: true }).click();
}

test('The private card is Off', async () => {
  await using app = await onInterests();
  const { page } = app;
  expect(await page.getByRole('heading', { name: 'Private interests', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Off', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByText(NOTICE, { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Agree to sensitive interests' }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'How private interests work' }).count()).toBe(0);
});

test('A sensitive interest is refused on the phone', async () => {
  await using app = await onInterests();
  const { page } = app;
  await add(page, 'gravid');
  await page.getByText(REFUSED, { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'Sensitive interests: give consent', exact: true }).isVisible()).toBe(true);
  expect(await field(page).inputValue()).toBe('gravid');
  expect(await page.getByText('4 of 20', { exact: true }).isVisible()).toBe(true);
});

test('Keep this private is refused without the consent', async () => {
  await using app = await onInterests();
  const { page } = app;
  await page.getByRole('button', { name: 'More for sourdough', exact: true }).click();
  await page.getByRole('button', { name: 'Keep this private', exact: true }).click();
  await page.getByText(REFUSED, { exact: true }).waitFor();
  expect(await page.getByRole('button', { name: 'More for sourdough', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('sourdough', { exact: true }).count()).toBe(1);
  expect(await page.getByText('Off', { exact: true }).isVisible()).toBe(true);
});

test('The refusal leads to the consent', async () => {
  await using app = await onInterests();
  const { page } = app;
  await add(page, 'gravid');
  await page.getByRole('button', { name: 'Sensitive interests: give consent', exact: true }).click();
  await page.waitForURL(/\/settings\/sensitive-consent/);
  await page.getByText('Sensitive interests', { exact: true }).first().waitFor();
});

test('Agree to sensitive interests leads to the consent', async () => {
  await using app = await onInterests();
  const { page } = app;
  await page.getByRole('link', { name: 'Agree to sensitive interests' }).click();
  await page.waitForURL(/\/settings\/sensitive-consent/);
  await page.getByText('Sensitive interests', { exact: true }).first().waitFor();
});

test('Without consent in Danish', async () => {
  await using app = await onInterests('da');
  const { page } = app;
  expect(await page.getByRole('heading', { name: 'Private interesser', exact: true }).isVisible()).toBe(true);
  expect(await page.getByText('Slået fra', { exact: true }).isVisible()).toBe(true);
  expect(await page.getByRole('link', { name: 'Sig ja til følsomme interesser' }).isVisible()).toBe(true);
  await add(page, 'gravid', 'da');
  await page
    .getByText(
      'Interessen kan være følsom, så vi gemmer den kun, hvis du har sagt ja til følsomme interesser. Intet blev sendt eller gemt. Du kan give samtykke under Indstillinger → Privatliv.',
      { exact: true },
    )
    .waitFor();
});
