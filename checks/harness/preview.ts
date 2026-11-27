// Renders the app's own screens for the checks: the web preview (apps/mobile/preview) in a headless Chromium, at
// the storyboards' 390×844. With AIL_APP_URL set (the end-to-end checks, run.legacy), it uses the app already running
// there; otherwise (the derived checks) it builds the preview once into .ail/preview and serves it itself.
//
//   await using app = await openApp({ route: '/about', world: 'new member', locale: 'en' });
//   await app.page.getByLabel('First name').fill('Emil');
//   await app.saveScreen('the-step-starts-empty.png');
//
// Playwright with Chromium must be loadable as `playwright` (as apps/mobile/preview/README.md requires).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Browser, type Locator, type Page } from 'playwright';
import { urlFor, type World } from '../e2e/data.ts';

const repo = resolve(import.meta.dir, '..', '..');
const BUILD = join(repo, '.ail', 'preview');

let base: Promise<string> | null = null;
let server: { close: () => Promise<void> } | null = null;
let browser: Promise<Browser> | null = null;

/** Where the app answers: AIL_APP_URL, or a preview built and served by this process. */
function appUrl(): Promise<string> {
  if (process.env.AIL_APP_URL) return Promise.resolve(process.env.AIL_APP_URL);
  base ??= (async () => {
    if (!existsSync(join(BUILD, 'index.html'))) {
      mkdirSync(BUILD, { recursive: true });
      const r = spawnSync('node', ['preview/shoot.mjs', '--build-only', '--build-dir', BUILD], {
        cwd: join(repo, 'apps', 'mobile'),
        stdio: 'inherit',
      });
      if (r.status !== 0) throw new Error('building the web preview failed (run `npm ci` at the repository root)');
    }
    const { serve } = (await import(join(repo, 'apps', 'mobile', 'preview', 'serve.mjs'))) as {
      serve: (dir: string, port?: number) => Promise<{ url: string; close: () => Promise<void> }>;
    };
    const started = await serve(BUILD, 0);
    server = started;
    return started.url;
  })();
  return base;
}

export interface App extends AsyncDisposable {
  readonly page: Page;
  /** Saves the page as a PNG in AIL_SHOTS_DIR, under `name`; does nothing when AIL_SHOTS_DIR is not set. */
  saveScreen(name: string): Promise<void>;
}

/** Opens `route` as the world's user, once its first screen has rendered and its fonts have loaded. */
export async function openApp(opts: { route: string; world: World; locale?: 'en' | 'da' }): Promise<App> {
  browser ??= chromium.launch();
  const context = await (await browser).newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Europe/Copenhagen',
    locale: opts.locale === 'da' ? 'da-DK' : 'en-GB',
  });
  const page = await context.newPage();
  await page.goto(urlFor(await appUrl(), opts.route, opts.world, opts.locale));
  await page.waitForFunction(() => (document.body.innerText ?? '').trim().length > 0);
  await page.evaluate(() => document.fonts.ready);
  return {
    page,
    async saveScreen(name: string) {
      const dir = process.env.AIL_SHOTS_DIR;
      if (!dir) return;
      await page.waitForTimeout(300); // let the last state change settle (transitions, focus rings)
      await page.screenshot({ path: join(dir, name) });
    },
    async [Symbol.asyncDispose]() {
      await context.close();
    },
  };
}

/**
 * Whether a checkbox is ticked, as a user sees it: its tick mark shows. (The app's checkboxes carry no checked state on
 * the web: react-native-web drops `accessibilityState`, so `isChecked()` cannot tell.)
 */
export async function isTicked(box: Locator): Promise<boolean> {
  return (await box.locator('svg').count()) > 0;
}

/** Closes the shared browser, and the preview server when this process started one; the checks call it in afterAll. */
export async function closeApps(): Promise<void> {
  if (browser) await (await browser).close();
  browser = null;
  await server?.close();
  server = null;
  base = null;
}
