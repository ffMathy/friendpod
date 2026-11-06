#!/usr/bin/env node
/**
 * Builds the web preview once, serves it, and screenshots app screens next to their storyboards (preview/README.md).
 *
 *   npm -w apps/mobile run preview:shoot -- --only drop-home,pod-plan --out <dir> --build-dir <dir>
 *   npm -w apps/mobile run preview:shoot -- --all --locale da --out <dir> --build-dir <dir> --skip-build
 *
 * Options
 *   --only <id,id,...> | --all   which screens.json entries (one of them is required)
 *   --out <dir>                  output folder (default: <tmp>/grouper-preview/shots)
 *   --build-dir <dir>            web export folder (default: <tmp>/grouper-preview/build); separate per concurrent caller
 *   --skip-build                 reuse the export already in --build-dir
 *   --build-only                 build, then stop
 *   --locale da|en               UI language for every screen (default en)
 *   --color-scheme light|dark    emulated OS appearance (default light)
 *   --storyboards <dir>          folder with the *.dc.html artboards (default: $PREVIEW_STORYBOARDS, then screens.json)
 *
 * Writes, per id: <id>.app.png (390x844, scale 1), <id>.storyboard.png and <id>.side.png when the entry has a
 * storyboard, and <out>/report.json with each screen's console errors, page errors, preview issues and render checks.
 * Exits 1 when a screen failed to render (blank page, unmatched route, uncaught error), 0 otherwise.
 * Needs Playwright with Chromium (resolved with require(), so NODE_PATH works).
 */
/* global document, window, Node -- the functions passed to page.evaluate() run in the browser. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.dirname(here);
const VIEWPORT = { width: 390, height: 844 };

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { only: null, all: false, out: null, buildDir: null, skipBuild: false, buildOnly: false, locale: 'en', colorScheme: 'light', storyboards: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--only') opts.only = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--all') opts.all = true;
    else if (a === '--out') opts.out = value();
    else if (a === '--build-dir') opts.buildDir = value();
    else if (a === '--skip-build') opts.skipBuild = true;
    else if (a === '--build-only') opts.buildOnly = true;
    else if (a === '--locale') opts.locale = value();
    else if (a === '--color-scheme') opts.colorScheme = value();
    else if (a === '--storyboards') opts.storyboards = value();
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else throw new Error(`unknown option ${a}`);
  }
  if (!['en', 'da'].includes(opts.locale)) throw new Error('--locale must be en or da');
  if (!['light', 'dark'].includes(opts.colorScheme)) throw new Error('--color-scheme must be light or dark');
  const tmp = path.join(os.tmpdir(), 'grouper-preview');
  opts.out = path.resolve(opts.out ?? path.join(tmp, 'shots'));
  opts.buildDir = path.resolve(opts.buildDir ?? path.join(tmp, 'build'));
  if (!opts.buildOnly && !opts.all && !opts.only) throw new Error('pass --only <id,...> or --all (or --build-only)');
  return opts;
}

// ---------------------------------------------------------------- build

/** The preview's build environment: web only, stub embedder, Places on the preview network stub. */
export const PREVIEW_ENV = {
  EXPO_PUBLIC_PREVIEW: '1',
  EXPO_PUBLIC_EMBEDDER: 'stub',
  EXPO_PUBLIC_PLACES_KEY: 'preview',
};

function build(buildDir) {
  console.log(`[preview] checking fixtures`);
  const check = spawnSync('npx', ['tsx', path.join(here, 'check.mts')], { cwd: appRoot, stdio: 'inherit' });
  if (check.status !== 0) throw new Error('preview:check failed (fix the scenarios above first)');
  console.log(`[preview] expo export --platform web → ${buildDir}`);
  const started = Date.now();
  const env = { ...process.env, ...PREVIEW_ENV, APP_ENV: 'development' };
  for (const k of ['EXPO_PUBLIC_USE_EMULATORS', 'EXPO_PUBLIC_PLACES']) delete env[k];
  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', buildDir], {
    cwd: appRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.status !== 0 || !existsSync(path.join(buildDir, 'index.html'))) {
    console.error(log.split('\n').filter((l) => !/^\s*_expo\/static|^\.\.\//.test(l)).slice(-60).join('\n'));
    throw new Error('expo export failed');
  }
  console.log(`[preview] built in ${Math.round((Date.now() - started) / 1000)} s`);
}

// ---------------------------------------------------------------- browser helpers

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    throw new Error('Playwright is not installed. Install it where Node can require() it (e.g. globally, with NODE_PATH set), plus Chromium.');
  }
}

/** Waits until the visible text stops changing (or the timeout), so async data and fonts have landed. */
async function settle(page, { quietMs = 600, timeoutMs = 8000 } = {}) {
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  const start = Date.now();
  let last = null;
  let stableSince = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate(() => `${document.body?.innerText ?? ''}|${document.images.length}`).catch(() => '');
    if (text !== last) {
      last = text;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) break;
    await page.waitForTimeout(150);
  }
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
}

async function runSteps(page, steps) {
  for (const step of steps ?? []) {
    if (step.fill) await page.locator(step.fill).first().fill(step.text ?? '', { timeout: 5000 });
    else if (step.click) await page.locator(step.click).first().click({ timeout: 5000 });
    else if (step.press) await page.locator(step.press).first().press(step.key ?? 'Enter', { timeout: 5000 });
    else if (step.waitFor) await page.locator(step.waitFor).first().waitFor({ timeout: 8000 });
    else if (step.scroll) await page.locator(step.scroll).first().scrollIntoViewIfNeeded({ timeout: 5000 });
    else if (step.wait) await page.waitForTimeout(step.wait);
    else throw new Error(`unknown step ${JSON.stringify(step)}`);
  }
}

function withQuery(route, params) {
  const [pathname, query = ''] = route.split('?');
  const search = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) search.set(k, v);
  return `${pathname}?${search.toString()}`;
}

async function shootApp(context, baseUrl, entry, opts, file) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 500));
  });
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 500)));
  const url = baseUrl + withQuery(entry.route, { scenario: entry.scenario, locale: opts.locale });
  let stepError = null;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await settle(page);
    try {
      await runSteps(page, entry.steps);
      if (entry.steps?.length) await settle(page);
    } catch (e) {
      stepError = String(e.message ?? e).split('\n')[0];
    }
    await page.screenshot({ path: file });
  } catch (e) {
    pageErrors.push(`navigation: ${String(e.message ?? e).split('\n')[0]}`);
  }
  const probe = await page
    .evaluate(() => {
      const text = (document.body?.innerText ?? '').trim();
      const preview = window.__preview ?? null;
      return { text, finalPath: window.location.pathname, preview };
    })
    .catch(() => ({ text: '', finalPath: null, preview: null }));
  await page.close();
  const requestedPath = entry.route.split('?')[0];
  const unmatched = /Unmatched Route|This screen doesn't exist|Page could not be found/i.test(probe.text);
  const blank = probe.text.length === 0;
  return {
    url,
    finalPath: probe.finalPath,
    redirected: probe.finalPath !== null && probe.finalPath !== requestedPath,
    blank,
    unmatched,
    textSample: probe.text.replace(/\s+/g, ' ').slice(0, 300),
    consoleErrors,
    pageErrors,
    previewIssues: (probe.preview?.issues ?? []).filter((i) => i.kind !== 'error'),
    stepError,
  };
}

/**
 * The artboards are design-canvas files whose runtime (support.js) is not in the export: templated parts
 * (`{{ value }}`, <sc-for>, <sc-if>) would show raw. This renders them once from the artboard's own Component class
 * and initial state (no interaction), so e.g. the chat shows its messages. Returns whether anything was rendered.
 */
function renderDesignCanvasTemplates() {
  const host = document.querySelector('x-dc');
  const script = document.querySelector('script[type="text/x-dc"][data-dc-script]');
  if (!host || !script || !(host.querySelector('sc-for, sc-if') || host.innerHTML.includes('{{'))) return false;
  class DCLogic {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
    setState(patch) {
      Object.assign(this.state, patch);
    }
  }
  let vals;
  try {
    const Component = new Function('DCLogic', `${script.textContent}\nreturn Component;`)(DCLogic);
    vals = new Component({}).renderVals() ?? {};
  } catch {
    vals = {};
  }
  const lookup = (expr, scope) => {
    const e = expr.trim();
    if (e === 'true') return true;
    if (e === 'false') return false;
    return e.split('.').reduce((v, k) => (v === null || v === undefined ? undefined : v[k]), scope);
  };
  const fill = (text, scope) => text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const v = lookup(expr, scope);
    return v === undefined || v === null || typeof v === 'function' ? '' : String(v);
  });
  const single = (text) => /^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/.exec(text)?.[1] ?? null;
  const render = (node, scope) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent.includes('{{')) child.textContent = fill(child.textContent, scope);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'sc-for') {
        const list = lookup(single(child.getAttribute('list') ?? '') ?? '', scope);
        const as = child.getAttribute('as') ?? 'item';
        for (const item of Array.isArray(list) ? list : []) {
          const copy = child.cloneNode(true);
          render(copy, { ...scope, [as]: item });
          while (copy.firstChild) node.insertBefore(copy.firstChild, child);
        }
        child.remove();
        continue;
      }
      if (tag === 'sc-if') {
        if (lookup(single(child.getAttribute('value') ?? '') ?? '', scope)) {
          render(child, scope);
          while (child.firstChild) node.insertBefore(child.firstChild, child);
        }
        child.remove();
        continue;
      }
      for (const attr of [...child.attributes]) {
        if (!attr.value.includes('{{')) continue;
        const expr = single(attr.value);
        const v = expr ? lookup(expr, scope) : undefined;
        if (/^on/i.test(attr.name) || typeof v === 'function') child.removeAttribute(attr.name);
        else if (typeof v === 'boolean') {
          if (v) child.setAttribute(attr.name, '');
          else child.removeAttribute(attr.name);
          if (attr.name === 'checked') child.checked = v;
        } else child.setAttribute(attr.name, fill(attr.value, scope));
      }
      render(child, scope);
    }
  };
  render(host, vals);
  return true;
}

async function shootStoryboard(context, file, out) {
  const page = await context.newPage();
  await page.goto(`file://${file}`, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => undefined);
  await page.evaluate(renderDesignCanvasTemplates).catch(() => false);
  await page.evaluate(() => document.fonts.ready).catch(() => undefined);
  const fontLoaded = await page.evaluate(() => document.fonts.check('16px "Plus Jakarta Sans"')).catch(() => false);
  await page.screenshot({ path: out });
  await page.close();
  return fontLoaded;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

async function sideBySide(browser, entry, storyboardPng, appPng, out, opts) {
  const page = await browser.newPage({ viewport: { width: VIEWPORT.width * 2 + 72, height: VIEWPORT.height + 96 }, deviceScaleFactor: 1 });
  const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
  const label = (title, sub) =>
    `<div class="label"><b>${escapeHtml(title)}</b><span>${escapeHtml(sub)}</span></div>`;
  await page.setContent(`<!doctype html><html><head><style>
    body{margin:0;background:#2B2F2D;font:13px/1.35 system-ui,sans-serif;color:#F3F5F1}
    .row{display:flex;gap:24px;padding:16px 24px}
    .col{display:flex;flex-direction:column;gap:8px}
    .label{height:48px;display:flex;flex-direction:column;justify-content:flex-end}
    .label span{color:#B9C2BC;font-size:12px}
    img{width:390px;height:844px;display:block;border-radius:6px;box-shadow:0 0 0 1px #4A514D}
  </style></head><body><div class="row">
    <div class="col">${label(`Storyboard · ${entry.title}`, entry.storyboard)}<img src="${img(storyboardPng)}"></div>
    <div class="col">${label(`App · ${entry.id}`, `${entry.route}  ·  scenario ${entry.scenario}  ·  ${opts.locale}`)}<img src="${img(appPng)}"></div>
  </div></body></html>`);
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
}

// ---------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.skipBuild) {
    rmSync(opts.buildDir, { recursive: true, force: true });
    build(opts.buildDir);
  } else if (!existsSync(path.join(opts.buildDir, 'index.html'))) {
    throw new Error(`--skip-build: no build in ${opts.buildDir}`);
  }
  if (opts.buildOnly) return;

  const config = JSON.parse(readFileSync(path.join(here, 'screens.json'), 'utf8'));
  const storyboardDir = opts.storyboards ?? process.env.PREVIEW_STORYBOARDS ?? config.storyboardDir ?? null;
  const known = new Map(config.screens.map((s) => [s.id, s]));
  const ids = opts.all ? config.screens.map((s) => s.id) : opts.only;
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) throw new Error(`unknown screen id(s): ${unknown.join(', ')}`);

  mkdirSync(opts.out, { recursive: true });
  const { chromium } = loadPlaywright();
  const { url: baseUrl, close } = await serve(opts.buildDir, 0);
  const browser = await chromium.launch();
  const report = { builtAt: new Date().toISOString(), buildDir: opts.buildDir, locale: opts.locale, colorScheme: opts.colorScheme, baseUrl, screens: [] };
  let failed = 0;
  try {
    for (const id of ids) {
      const entry = known.get(id);
      // A fresh context per screen: no sessionStorage or cache carried over between scenarios.
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        timezoneId: 'Europe/Copenhagen',
        locale: opts.locale === 'da' ? 'da-DK' : 'en-GB',
        colorScheme: opts.colorScheme,
      });
      const appPng = path.join(opts.out, `${id}.app.png`);
      const result = await shootApp(context, baseUrl, entry, opts, appPng);
      const row = { id, title: entry.title, route: entry.route, scenario: entry.scenario, storyboard: entry.storyboard, files: { app: appPng }, ...result };
      const storyboardFile = entry.storyboard && storyboardDir ? path.join(storyboardDir, entry.storyboard) : null;
      if (storyboardFile && existsSync(storyboardFile)) {
        const sbPng = path.join(opts.out, `${id}.storyboard.png`);
        row.storyboardFontLoaded = await shootStoryboard(context, storyboardFile, sbPng);
        row.files.storyboard = sbPng;
        if (existsSync(appPng)) {
          const sidePng = path.join(opts.out, `${id}.side.png`);
          await sideBySide(browser, entry, sbPng, appPng, sidePng, opts);
          row.files.side = sidePng;
        }
      } else if (entry.storyboard) {
        row.storyboardMissing = storyboardFile ?? '(no storyboard folder: pass --storyboards or set PREVIEW_STORYBOARDS)';
      }
      await context.close();
      row.ok = !row.blank && !row.unmatched && row.pageErrors.length === 0 && !row.stepError;
      if (!row.ok) failed += 1;
      report.screens.push(row);
      const flags = [row.blank && 'BLANK', row.unmatched && 'UNMATCHED', row.redirected && `redirected→${row.finalPath}`, row.pageErrors.length && `${row.pageErrors.length} page error(s)`, row.consoleErrors.length && `${row.consoleErrors.length} console error(s)`, row.stepError && 'step failed']
        .filter(Boolean)
        .join(', ');
      console.log(`[preview] ${row.ok ? 'ok  ' : 'FAIL'} ${id}${flags ? `  (${flags})` : ''}`);
    }
  } finally {
    await browser.close();
    await close();
    writeFileSync(path.join(opts.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(`[preview] ${ids.length - failed}/${ids.length} rendered; report: ${path.join(opts.out, 'report.json')}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`[preview] ${e.message ?? e}`);
  process.exit(1);
});
