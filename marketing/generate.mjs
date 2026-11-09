#!/usr/bin/env node
/**
 * Store, social and README images for Grouper, composed from the real app screens.
 *
 *   npm run marketing                         build the web preview, shoot the screens, compose everything
 *   npm run marketing -- --skip-build         reuse an existing preview build (--build-dir)
 *   npm run marketing -- --only play,social   compose only some groups (play, appstore, social)
 *
 * Options: --build-dir <dir> (default: <tmp>/grouper-marketing/build), --skip-build, --only <groups>.
 *
 * 1. Builds the web preview harness (apps/mobile/preview) and shoots the chosen screens at 390x844 @3x in Danish and
 *    English, with the same scenarios, steps and timezone as `preview:shoot`.
 * 2. Composes HTML templates (brand tokens from apps/mobile/src/components/theme.ts, fonts from the app's own
 *    @expo-google-fonts packages) in Playwright and screenshots them at their final pixel size.
 * 3. Re-encodes every PNG losslessly (indexed when it has 256 colours or fewer, otherwise RGB with per-row filters
 *    and maximum deflate) and keeps whichever file is smaller. No extra dependencies: the writer uses node:zlib.
 *
 * Output: marketing/out/{play,appstore,social}/... (committed; README.md shows them).
 */
/* global document, window, Image */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { serve } from '../apps/mobile/preview/serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.dirname(here);
const appRoot = path.join(repo, 'apps', 'mobile');
const OUT = path.join(here, 'out');
const CACHE = path.join(os.tmpdir(), 'grouper-marketing');

// ---------------------------------------------------------------- brand tokens (blend spec, theme.ts)

const C = {
  skov: '#1B6452',
  skovDeep: '#174F42',
  paper: '#F6F3EC',
  white: '#FFFFFF',
  ink: '#18211D',
  ink2: '#3A423D',
  line: '#E4DFD4',
  solsikkeDeep: '#6A4900',
};

/** The six pod colours in their fixed order (colour index 0..5). */
const POD = [
  { key: 'solsikke', da: 'Solsikke', en: 'Sunflower', base: '#FFD84D', deep: '#6A4900', tint: '#FFF1C2', border: '#FFE793', on: C.ink },
  { key: 'blad', da: 'Blad', en: 'Leaf', base: '#9FD05E', deep: '#395500', tint: '#E6F3D4', border: '#CAE5A5', on: C.ink },
  { key: 'baer', da: 'Bær', en: 'Berry', base: '#F48AB3', deep: '#90124D', tint: '#FDE2EC', border: '#F9BFD5', on: C.ink },
  { key: 'tomat', da: 'Tomat', en: 'Tomato', base: '#F26A4B', deep: '#8C2107', tint: '#FDE2D9', border: '#F9B2A0', on: C.ink },
  { key: 'fjord', da: 'Fjord', en: 'Fjord', base: '#2F6FD6', deep: '#124593', tint: '#DDE7FB', border: '#97B7EC', on: C.white },
  { key: 'blomme', da: 'Blomme', en: 'Plum', base: '#6C3399', deep: '#4F2272', tint: '#EDE1F6', border: '#B99BD1', on: C.white },
];
const pod = (key) => POD.find((p) => p.key === key);

/** A ground: background, text colour, and the poster-mark colours that the spec's section 7.2 table gives it. */
const GROUND = {
  skov: { bg: C.skov, text: C.white, people: C.paper, sun: '#FFD84D' },
  paper: { bg: C.paper, text: C.ink, people: C.skov, sun: '#FFD84D', sunRing: C.solsikkeDeep },
  solsikke: { bg: pod('solsikke').base, text: C.ink, people: C.ink, sun: pod('tomat').base },
  blad: { bg: pod('blad').base, text: C.ink, people: C.ink, sun: C.white },
  baer: { bg: pod('baer').base, text: C.ink, people: C.ink, sun: '#FFD84D' },
  tomat: { bg: pod('tomat').base, text: C.ink, people: C.ink, sun: '#FFD84D' },
  fjord: { bg: pod('fjord').base, text: C.white, people: C.paper, sun: '#FFD84D' },
  blomme: { bg: pod('blomme').base, text: C.white, people: C.paper, sun: '#FFD84D' },
};

// ---------------------------------------------------------------- copy

const TAGLINE = { da: 'Der er en plads til dig.', en: 'There’s a seat saved for you.' };
const HEADLINE = { da: 'Små grupper.<br>Rigtige møder.', en: 'Small groups.<br>Real meetups.' };
const PITCH = {
  da: 'Hver torsdag sætter vi en pod sammen: 4–6 mennesker tæt på dig, der deler noget, du går op i. I mødes i virkeligheden.',
  en: 'Every Thursday we put together a pod of 4–6 people near you who share something you care about. You meet in person.',
};

/** The store set: screen id (apps/mobile/preview/screens.json), ground, caption and one supporting line. */
const STORE_SET = [
  {
    id: 'Main', ground: 'solsikke', file: '01-welcome',
    da: ['Små grupper. Rigtige møder.', 'Nye venner i en pod på 4–6 mennesker tæt på dig.'],
    en: ['Small groups. Real meetups.', 'New friends in a pod of 4–6 people near you.'],
  },
  {
    id: 'drop-home', ground: 'skov', file: '02-thursday-drop',
    da: ['Et nyt drop hver torsdag', 'Kl. 18.00 sætter vi pods sammen om det, I går op i.'],
    en: ['A new drop every Thursday', 'At 18:00 we put pods together around what you care about.'],
  },
  {
    id: 'onb-interests', ground: 'blad', file: '03-interests',
    da: ['Med dine egne ord', 'Sig, hvad du er til, på dansk eller engelsk. En pod samles om én ting, I deler.'],
    en: ['In your own words', 'Say what you’re into, in Danish or English. A pod forms around one thing you share.'],
  },
  {
    id: 'drop-proposal', ground: 'fjord', file: '04-your-pod',
    da: ['Mød 4–6 mennesker tæt på dig', 'I deler én interesse og bor ikke langt fra hinanden.'],
    en: ['Meet 4–6 people near you', 'You share one interest and live close to each other.'],
  },
  {
    id: 'drop-waiting', ground: 'baer', file: '05-seats-light-up',
    da: ['Se pladserne lyse op', 'Navne og billeder vises, når 4 har sagt ja.'],
    en: ['Watch the seats light up', 'Names and photos appear when 4 people have said yes.'],
  },
  {
    id: 'pod-confirmed', ground: 'blomme', file: '06-the-reveal',
    da: ['Så ser du, hvem der er med', 'Fornavne og billeder, når poden er bekræftet.'],
    en: ['Then you see who’s in', 'First names and photos, once the pod is confirmed.'],
  },
  {
    id: 'pod-scheduled', ground: 'tomat', file: '07-meet-up',
    da: ['Find en tid. Mød hinanden.', 'I stemmer om tid og sted og mødes i virkeligheden.'],
    en: ['Pick a time. Meet in person.', 'Vote on a time and place, then meet for real.'],
  },
  {
    id: 'priv-interests', ground: 'paper', file: '08-private-stays-private',
    da: ['Det private bliver privat', 'En følsom interesse bruges kun til at danne en pod om netop den.'],
    en: ['Private stays private', 'A sensitive interest is only used to form a pod about that interest.'],
  },
];
/** Screens shot besides the store set (README grid). */
const EXTRA_SHOTS = ['pod-chat'];

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = { buildDir: path.join(CACHE, 'build'), skipBuild: false, only: ['play', 'appstore', 'social'] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--build-dir') opts.buildDir = path.resolve(value());
    else if (a === '--skip-build') opts.skipBuild = true;
    else if (a === '--only') opts.only = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
      process.exit(0);
    } else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    throw new Error('Playwright is not installed. Install it where Node can require() it (with Chromium), as for preview:shoot.');
  }
}

// ---------------------------------------------------------------- 1. app screens at @3x

function buildPreview(buildDir) {
  console.log(`[marketing] building the web preview → ${buildDir}`);
  const r = spawnSync('node', [path.join(appRoot, 'preview', 'shoot.mjs'), '--build-only', '--build-dir', buildDir], {
    cwd: appRoot,
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error('preview build failed');
}

function withQuery(route, params) {
  const [pathname, query = ''] = route.split('?');
  const search = new URLSearchParams(query);
  for (const [k, v] of Object.entries(params)) search.set(k, v);
  return `${pathname}?${search.toString()}`;
}

/** Waits until the visible text stops changing, the network is idle and fonts are in (as preview/shoot.mjs does). */
async function settle(page, { quietMs = 700, timeoutMs = 9000 } = {}) {
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

/** The background colour behind the top edge of the screen, for the status bar drawn above it. */
function topColor() {
  let el = document.elementFromPoint(300, 2);
  while (el) {
    const bg = window.getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
    el = el.parentElement;
  }
  return 'rgb(246, 243, 236)';
}

async function shootScreens(browser, buildDir, ids, shotsDir) {
  const config = JSON.parse(readFileSync(path.join(appRoot, 'preview', 'screens.json'), 'utf8'));
  const known = new Map(config.screens.map((s) => [s.id, s]));
  const { url: baseUrl, close } = await serve(buildDir, 0);
  const meta = {};
  try {
    for (const locale of ['da', 'en']) {
      mkdirSync(path.join(shotsDir, locale), { recursive: true });
      for (const id of ids) {
        const entry = known.get(id);
        if (!entry) throw new Error(`unknown screen id ${id}`);
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 3,
          timezoneId: 'Europe/Copenhagen',
          locale: locale === 'da' ? 'da-DK' : 'en-GB',
          colorScheme: 'light',
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        await page.goto(baseUrl + withQuery(entry.route, { scenario: entry.scenario, locale }), { waitUntil: 'networkidle', timeout: 30000 });
        await settle(page);
        await runSteps(page, entry.steps);
        if (entry.steps?.length) await settle(page);
        const file = path.join(shotsDir, locale, `${id}.png`);
        await page.screenshot({ path: file });
        meta[`${locale}/${id}`] = { top: await page.evaluate(topColor) };
        await context.close();
        if (errors.length) throw new Error(`${id} (${locale}) threw: ${errors[0]}`);
        console.log(`[marketing] shot ${locale}/${id}`);
      }
    }
  } finally {
    await close();
  }
  writeFileSync(path.join(shotsDir, 'meta.json'), JSON.stringify(meta, null, 2));
  return meta;
}

// ---------------------------------------------------------------- 2. templates

const fontUrl = (rel) => pathToFileURL(path.join(repo, 'node_modules', '@expo-google-fonts', rel)).href;
const FONT_FACES = `
@font-face{font-family:'Bricolage Grotesque';font-weight:700;src:url('${fontUrl('bricolage-grotesque/700Bold/BricolageGrotesque_700Bold.ttf')}')}
@font-face{font-family:'Bricolage Grotesque';font-weight:800;src:url('${fontUrl('bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf')}')}
@font-face{font-family:'Plus Jakarta Sans';font-weight:400;src:url('${fontUrl('plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf')}')}
@font-face{font-family:'Plus Jakarta Sans';font-weight:500;src:url('${fontUrl('plus-jakarta-sans/500Medium/PlusJakartaSans_500Medium.ttf')}')}
@font-face{font-family:'Plus Jakarta Sans';font-weight:600;src:url('${fontUrl('plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf')}')}
@font-face{font-family:'Plus Jakarta Sans';font-weight:700;src:url('${fontUrl('plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf')}')}
@font-face{font-family:'Plus Jakarta Sans';font-weight:800;src:url('${fontUrl('plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf')}')}
`;

const BASE_CSS = `
${FONT_FACES}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;overflow:hidden}
.display{font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;letter-spacing:-0.035em}
.headline{font-family:'Bricolage Grotesque','Plus Jakarta Sans',system-ui,sans-serif;font-weight:700;letter-spacing:-0.015em}
`;

/** Dot mark (spec 7.1): sun, four people, the saved seat as a ring. */
function dotMark(size, g) {
  const ring = g.sunRing ? ` stroke="${g.sunRing}" stroke-width="${((1.75 * 40) / size).toFixed(2)}"` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="6.6" fill="${g.sun}"${ring}/><circle cx="20" cy="6.4" r="4.1" fill="${g.people}"/><circle cx="32.9" cy="15.8" r="3.25" fill="none" stroke="${g.people}" stroke-width="1.7"/><circle cx="28" cy="31" r="4.1" fill="${g.people}"/><circle cx="12" cy="31" r="4.1" fill="${g.people}"/><circle cx="7.1" cy="15.8" r="4.1" fill="${g.people}"/></svg>`;
}

/** Poster mark (spec 7.2): people around a sun; the saved seat dashed (open) or solid (yours). */
function posterMark(width, g, { seat = 'dashed' } = {}) {
  const fig = (x, y) => `<g transform="translate(${x} ${y})"><circle cx="0" cy="-9" r="8"/><path d="M-12.5 17V14A12.5 12.5 0 0 1 12.5 14V17Z"/></g>`;
  const ring = g.sunRing ? ` stroke="${g.sunRing}" stroke-width="${((1.75 * 120) / width).toFixed(2)}"` : '';
  const seatAttrs = seat === 'dashed' ? 'stroke-width="2.4" stroke-dasharray="4 3.2"' : 'stroke-width="3"';
  return `<svg width="${width}" height="${(width * 112) / 120}" viewBox="0 0 120 112" aria-hidden="true">
    <circle cx="60" cy="60" r="23" fill="${g.sun}"${ring}/>
    <g fill="${g.people}">${fig(60, 18)}${fig(84.7, 94)}${fig(35.3, 94)}${fig(20.1, 47)}</g>
    <g transform="translate(99.9 47)" fill="none" stroke="${g.people}" ${seatAttrs} stroke-linecap="round"><circle cx="0" cy="-9" r="8"/><path d="M-12.5 17V14A12.5 12.5 0 0 1 12.5 14V17"/></g>
  </svg>`;
}

/** Lockup: dot mark + lowercase wordmark (spec 7.1: mark 36, gap 8, wordmark 29). */
function lockup(scale, g) {
  return `<div style="display:flex;align-items:center;gap:${8 * scale}px">${dotMark(36 * scale, g)}<span class="display" style="font-size:${29 * scale}px;line-height:1;padding-bottom:${3 * scale}px;color:${g.text}">grouper</span></div>`;
}

/**
 * A flat phone: Ink body, a status bar in the colour of the screen's top edge, the app screen at 390x844 points.
 * `w` is the screen width in px.
 */
function phone(src, top, w, { radius } = {}) {
  const k = w / 390;
  const bezel = Math.round(12 * k);
  const r = radius ?? Math.round(54 * k);
  const statusH = Math.round(50 * k);
  const dark = luminance(top) < 0.4;
  const fg = dark ? '#FFFFFF' : C.ink;
  const bars = [4, 6, 8, 10].map((h) => `<i style="display:block;width:${3 * k}px;height:${h * k}px;background:${fg};border-radius:${k}px"></i>`).join('');
  return `<div class="phone" style="width:${w + 2 * bezel}px;padding:${bezel}px;background:${C.ink};border-radius:${r + bezel}px;flex-shrink:0">
    <div style="border-radius:${r}px;overflow:hidden;background:${top};position:relative">
      <div style="height:${statusH}px;display:flex;align-items:center;justify-content:space-between;padding:${6 * k}px ${30 * k}px 0 ${36 * k}px;color:${fg};font:600 ${15 * k}px/1 'Plus Jakarta Sans',sans-serif">
        <span>9:41</span>
        <span style="position:absolute;left:50%;top:${11 * k}px;width:${108 * k}px;height:${30 * k}px;margin-left:${-54 * k}px;background:${C.ink};border-radius:${15 * k}px"></span>
        <span style="display:flex;align-items:flex-end;gap:${2 * k}px">${bars}<span style="display:block;margin-left:${6 * k}px;width:${24 * k}px;height:${11 * k}px;border:${1.2 * k}px solid ${fg};border-radius:${3 * k}px;padding:${1.5 * k}px"><i style="display:block;height:100%;width:80%;background:${fg};border-radius:${1.5 * k}px"></i></span></span>
      </div>
      <img src="${src}" style="display:block;width:${w}px;height:${(w * 844) / 390}px">
    </div>
  </div>`;
}
/** Total phone height for a screen width. */
const phoneHeight = (w) => (w * 844) / 390 + Math.round(50 * (w / 390)) + 2 * Math.round(12 * (w / 390));

function luminance(css) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(css) ?? [];
  let rgb = m.length ? [m[1], m[2], m[3]].map(Number) : [0, 0, 0];
  if (css.startsWith('#')) rgb = [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16));
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

function page(width, height, body, css = '', bg = C.paper) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
  body{width:${width}px;height:${height}px;background:${bg}}
  ${css}</style></head><body>${body}</body></html>`;
}

/** Store screenshot: caption block on a brand ground, the phone below it, sized to fill what is left. */
function storeShot({ W, H, item, locale, shot, top }) {
  const g = GROUND[item.ground];
  const k = W / 1080;
  const [caption, sub] = item[locale];
  for (const [label, fg] of [['caption', g.text]]) {
    const ratio = contrast(fg, g.bg);
    if (ratio < 4.5) throw new Error(`${item.file} ${label} contrast ${ratio.toFixed(2)} < 4.5`);
  }
  const pad = Math.round(80 * k);
  const body = `<div id="root" style="width:${W}px;height:${H}px;background:${g.bg};display:flex;flex-direction:column;align-items:center;padding:${pad}px ${pad}px 0">
    <div id="cap" data-fit-box="caption" style="width:100%;height:${Math.round(420 * k)}px;flex-shrink:0;overflow:hidden;color:${g.text}">
      ${lockup(1.35 * k, g)}
      <div class="display" style="margin-top:${44 * k}px;font-size:${96 * k}px;line-height:1.02;text-wrap:balance">${caption}</div>
      <div style="margin-top:${24 * k}px;font-size:${38 * k}px;line-height:1.3;font-weight:500;max-width:${860 * k}px;text-wrap:pretty">${sub}</div>
    </div>
    <div id="ph" style="flex:1;display:flex;align-items:flex-start;justify-content:center;width:100%;padding-top:${56 * k}px"></div>
  </div>
  <script>
    window.__fit = (src, top, html) => {
      const ph = document.getElementById('ph');
      const avail = ph.getBoundingClientRect().height - ${56 * k} - ${pad};
      return avail;
    };
  </script>`;
  return { html: page(W, H, body, '', g.bg), fill: { src: shot, top } };
}

// ---------------------------------------------------------------- 3. PNG writer (indexed when it fits)

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** Writes an 8-bit RGB or indexed PNG; RGB rows get the filter with the smallest sum of absolute values. */
function writePng(width, height, { palette, indices, rgb }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = palette ? 3 : 2;
  const bpp = palette ? 1 : 3;
  const src = palette ? indices : rgb;
  const stride = width * bpp;
  const raw = Buffer.alloc((stride + 1) * height);
  const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    const prev = y ? (y - 1) * stride : -1;
    let best = 0;
    let bestSum = Infinity;
    for (let f = 0; f < (palette ? 1 : 5); f += 1) {
      const out = cand[f];
      let sum = 0;
      for (let x = 0; x < stride; x += 1) {
        const v = src[row + x];
        const a = x >= bpp ? src[row + x - bpp] : 0;
        const b = prev >= 0 ? src[prev + x] : 0;
        const c = x >= bpp && prev >= 0 ? src[prev + x - bpp] : 0;
        let pred = 0;
        if (f === 1) pred = a;
        else if (f === 2) pred = b;
        else if (f === 3) pred = (a + b) >> 1;
        else if (f === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const d = (v - pred) & 0xff;
        out[x] = d;
        sum += d < 128 ? d : 256 - d;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
  }
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (palette) parts.push(chunk('PLTE', Buffer.from(palette)));
  parts.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/**
 * In the browser: decodes a PNG and returns its pixels as RGB, plus an exact palette and indices when the image has
 * 256 colours or fewer. Lossless either way.
 */
function readPixelsInPage({ dataUrl }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);
      const n = img.width * img.height;
      const toB64 = (u8) => {
        let bin = '';
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(bin);
      };
      const index = new Map();
      const indices = new Uint8Array(n);
      let fits = true;
      for (let i = 0; i < n && fits; i += 1) {
        const key = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
        let k = index.get(key);
        if (k === undefined) {
          if (index.size === 256) fits = false;
          else {
            k = index.size;
            index.set(key, k);
          }
        }
        indices[i] = k ?? 0;
      }
      if (fits) {
        const pal = [];
        for (const c of index.keys()) pal.push((c >> 16) & 255, (c >> 8) & 255, c & 255);
        resolve({ width: img.width, height: img.height, palette: pal, indices: toB64(indices) });
        return;
      }
      const rgb = new Uint8Array(n * 3);
      for (let i = 0; i < n; i += 1) {
        rgb[i * 3] = data[i * 4];
        rgb[i * 3 + 1] = data[i * 4 + 1];
        rgb[i * 3 + 2] = data[i * 4 + 2];
      }
      resolve({ width: img.width, height: img.height, rgb: toB64(rgb) });
    };
    img.src = dataUrl;
  });
}

// ---------------------------------------------------------------- render helpers

let pixelPage = null;
/** Saves a screenshot losslessly re-encoded (indexed when it has <= 256 colours), keeping the smaller file. */
async function savePng(buffer, file) {
  const r = await pixelPage.evaluate(readPixelsInPage, { dataUrl: `data:image/png;base64,${buffer.toString('base64')}` });
  const ours = r.palette
    ? writePng(r.width, r.height, { palette: r.palette, indices: Buffer.from(r.indices, 'base64') })
    : writePng(r.width, r.height, { rgb: Buffer.from(r.rgb, 'base64') });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, ours.length < buffer.length ? ours : buffer);
}

let renderSeq = 0;
/** Renders an HTML document at exactly W x H px (scale 1), after the brand fonts have loaded. */
async function render(browser, html, W, H, file, prepare) {
  const htmlFile = path.join(CACHE, 'html', `${renderSeq++}-${path.basename(file, '.png')}.html`);
  mkdirSync(path.dirname(htmlFile), { recursive: true });
  writeFileSync(htmlFile, html);
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
  const ok = await p.evaluate(async () => {
    const faces = ['700 40px "Bricolage Grotesque"', '800 40px "Bricolage Grotesque"', '500 20px "Plus Jakarta Sans"', '700 20px "Plus Jakarta Sans"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, 'grouper ÆØÅ')));
    await document.fonts.ready;
    return faces.every((f) => document.fonts.check(f, 'grouper ÆØÅ'));
  });
  if (!ok) throw new Error(`fonts did not load for ${file}`);
  if (prepare) await prepare(p);
  await p.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => (i.onload = r))))));
  const overflow = await p.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('[data-fit]')) {
      const r = el.getBoundingClientRect();
      const outside = r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight;
      if (el.scrollWidth > el.clientWidth + 1 || outside) bad.push(`${el.dataset.fit} (${el.scrollWidth} in ${el.clientWidth})`);
    }
    for (const el of document.querySelectorAll('[data-fit-box]')) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) bad.push(`${el.dataset.fitBox} (box ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`);
    }
    return bad;
  });
  if (overflow.length) throw new Error(`${file}: text overflows in ${overflow.join(', ')}`);
  const buf = await p.screenshot({ type: 'png' });
  await p.close();
  await savePng(buf, file);
  console.log(`[marketing] ${path.relative(repo, file)}`);
}

// ---------------------------------------------------------------- the sets

async function storeSet(browser, shots, meta, { W, H, dir }) {
  for (const locale of ['da', 'en']) {
    for (const item of STORE_SET) {
      const shot = pathToFileURL(path.join(shots, locale, `${item.id}.png`)).href;
      const top = meta[`${locale}/${item.id}`].top;
      const { html } = storeShot({ W, H, item, locale, shot, top });
      const phoneHtml = (w) => phone(shot, top, w);
      await render(browser, html, W, H, path.join(OUT, dir, locale, `${item.file}.png`), async (p) => {
        const avail = await p.evaluate(() => window.__fit());
        // Fit the phone to the space left under the caption, never wider than 66% of the canvas.
        let w = Math.min(W * 0.66, 860);
        while (phoneHeight(w) > avail && w > 200) w -= 2;
        const markup = phoneHtml(Math.floor(w));
        await p.evaluate((m) => {
          document.getElementById('ph').innerHTML = m;
        }, markup);
      });
    }
  }
}

function iconHtml(size) {
  const svg = readFileSync(path.join(appRoot, 'assets', 'images', 'source', 'icon.svg'), 'utf8')
    .replace(/width="1024" height="1024"/, `width="${size}" height="${size}"`);
  return page(size, size, svg, 'svg{display:block}', C.skov);
}

function featureGraphic(locale) {
  const g = GROUND.skov;
  return page(1024, 500, `
    <div style="position:relative;width:1024px;height:500px;background:${C.skov};padding:64px 72px;color:#fff">
      ${lockup(1.3, g)}
      <div class="display" data-fit="headline" style="margin-top:44px;font-size:${locale === 'da' ? 72 : 74}px;line-height:1.02;width:600px">${HEADLINE[locale]}</div>
      <div class="headline" data-fit="tagline" style="margin-top:22px;font-size:32px;line-height:1.15;width:600px">${TAGLINE[locale]}</div>
      <div style="position:absolute;right:70px;top:80px">${posterMark(320, g)}</div>
    </div>`, '', C.skov);
}

function heroBanner(locale, shots, meta) {
  const g = GROUND.skov;
  const ids = [['drop-home', -4], ['drop-proposal', 0], ['pod-confirmed', 4]];
  const phones = ids
    .map(([id, rot], i) => {
      const src = pathToFileURL(path.join(shots, locale, `${id}.png`)).href;
      const left = [0, 250, 500][i];
      const ty = i === 1 ? 0 : 90;
      return `<div style="position:absolute;left:${left}px;top:${ty}px;transform:rotate(${rot}deg);z-index:${i === 1 ? 2 : 1}">${phone(src, meta[`${locale}/${id}`].top, 250)}</div>`;
    })
    .join('');
  return page(1600, 800, `
    <div style="position:relative;width:1600px;height:800px;background:${C.skov};overflow:hidden;color:#fff">
      <div style="position:absolute;left:96px;top:96px;width:640px">
        ${lockup(1.6, g)}
        <div class="display" data-fit="headline" style="margin-top:64px;font-size:96px;line-height:1.0">${HEADLINE[locale]}</div>
        <div class="headline" style="margin-top:28px;font-size:40px;line-height:1.15">${TAGLINE[locale]}</div>
        <div style="margin-top:28px;font-size:22px;line-height:1.5;font-weight:500;color:#fff;max-width:560px">${PITCH[locale]}</div>
      </div>
      <div style="position:absolute;left:800px;top:84px;width:800px;height:900px">
        ${phones}
      </div>
    </div>`, '', C.skov);
}

function ogImage(locale, shots, meta) {
  const g = GROUND.skov;
  const src = pathToFileURL(path.join(shots, locale, 'drop-proposal.png')).href;
  return page(1200, 630, `
    <div style="position:relative;width:1200px;height:630px;background:${C.skov};overflow:hidden;color:#fff">
      <div style="position:absolute;left:80px;top:80px;width:640px">
        ${lockup(1.5, g)}
        <div class="display" data-fit="headline" style="margin-top:56px;font-size:84px;line-height:1.0">${HEADLINE[locale]}</div>
        <div class="headline" style="margin-top:26px;font-size:36px;line-height:1.15">${TAGLINE[locale]}</div>
      </div>
      <div style="position:absolute;left:770px;top:70px;width:520px;height:520px;border-radius:50%;background:${pod('solsikke').base}"></div>
      <div style="position:absolute;left:820px;top:90px">${phone(src, meta[`${locale}/drop-proposal`].top, 300)}</div>
    </div>`, '', C.skov);
}

const STEPS = {
  da: [
    ['Tilføj interesser', 'Med dine egne ord, på dansk eller engelsk.'],
    ['Torsdag kl. 18.00', 'Ugens drop sætter pods sammen tæt på dig.'],
    ['Pladserne lyser op', 'Ved 4 ja er poden bekræftet, og I ser hinanden.'],
    ['Mød hinanden', 'I finder en tid og et sted og ses i virkeligheden.'],
  ],
  en: [
    ['Add your interests', 'In your own words, Danish or English.'],
    ['Thursday, 18:00', 'The weekly drop forms pods near you.'],
    ['Seats light up', 'At 4 yeses the pod is confirmed and you see who’s in.'],
    ['Meet up', 'Pick a time and place, then meet in person.'],
  ],
};

function howItWorks(locale, shots, meta) {
  const panels = [['onb-interests', 'blad'], ['drop-home', 'skov'], ['drop-waiting', 'baer'], ['pod-scheduled', 'tomat']];
  const cols = panels
    .map(([id, ground], i) => {
      const g = GROUND[ground];
      const src = pathToFileURL(path.join(shots, locale, `${id}.png`)).href;
      const [title, body] = STEPS[locale][i];
      return `<div style="position:relative;width:376px;height:568px;border-radius:28px;background:${g.bg};overflow:hidden;color:${g.text}">
        <div style="padding:30px 32px 0">
          <div style="display:flex;align-items:center;gap:14px">
            <span class="display" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:${g.text};color:${g.bg};font-size:24px;letter-spacing:0">${i + 1}</span>
          </div>
          <div class="display" data-fit="step-${i}" style="margin-top:16px;font-size:34px;line-height:1.05;white-space:nowrap;overflow:hidden">${title}</div>
          <div style="margin-top:10px;font-size:19px;line-height:1.4;font-weight:500;height:54px">${body}</div>
        </div>
        <div style="position:absolute;left:58px;top:226px">${phone(src, meta[`${locale}/${id}`].top, 236)}</div>
      </div>`;
    })
    .join('');
  return page(1600, 600, `<div style="width:1600px;height:600px;background:${C.paper};display:flex;gap:16px;padding:16px">${cols}</div>`);
}

function colourSystem() {
  const cards = POD.map((p, i) => {
    const swatch = (n, hex, fg, border) => `<div style="height:38px;border-radius:12px;background:${hex};${border ? `border:1.5px solid ${border};` : ''}color:${fg};font-size:15px;font-weight:700;padding:0 14px;display:flex;align-items:center;justify-content:space-between"><span>${n}</span><span>${hex}</span></div>`;
    const chip = `<span style="align-self:flex-start;display:inline-flex;align-items:center;gap:10px;height:44px;padding:0 20px 0 16px;border-radius:22px;background:${p.tint};border:1.5px solid ${p.border};font-weight:700;font-size:19px;color:${C.ink}"><i style="display:block;width:13px;height:13px;border-radius:50%;background:${p.base};box-shadow:0 0 0 2px ${p.deep}"></i>${p.da}</span>`;
    return `<div style="width:229px;display:flex;flex-direction:column;gap:10px">
      <div style="height:206px;border-radius:22px;background:${p.base};padding:22px;display:flex;flex-direction:column;justify-content:space-between;color:${p.on}">
        <span class="display" style="font-size:40px;line-height:1">${i}</span>
        <div><div class="display" style="font-size:40px;line-height:1.02">${p.da}</div><div class="headline" style="font-size:24px;margin-top:4px">${p.en}</div></div>
      </div>
      ${swatch('base', p.base, p.on)}${swatch('deep', p.deep, '#FFFFFF')}${swatch('tint', p.tint, C.ink, p.border)}
      <div style="margin-top:4px">${chip}</div>
    </div>`;
  }).join('');
  const chrome = [['Skov', C.skov, 'everything you tap · the house poster'], ['Paper', C.paper, 'the ground'], ['Ink', C.ink, 'text']]
    .map(([n, hex, job]) => `<div style="display:flex;align-items:center;gap:12px"><span style="width:40px;height:40px;border-radius:50%;background:${hex};border:1.5px solid ${C.line}"></span><span style="font-size:19px;color:${C.ink2}"><b style="color:${C.ink}">${n}</b> ${hex} · ${job}</span></div>`)
    .join('');
  return page(1600, 760, `
    <div data-fit-box="colour-system" style="width:1600px;height:760px;overflow:hidden;background:${C.white};padding:56px 64px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between">
        <div><div class="display" style="font-size:52px;line-height:1">Seks podfarver · Six pod colours</div>
        <div style="margin-top:12px;font-size:20px;color:${C.ink2};font-weight:500">Every pod gets one colour, from its theme. Private pods stay quiet: no colour.</div></div>
        ${lockup(1.3, GROUND.paper)}
      </div>
      <div style="margin-top:36px;display:flex;gap:19px">${cards}</div>
      <div style="margin-top:36px;padding-top:28px;border-top:1px solid ${C.line};display:flex;gap:48px">${chrome}</div>
    </div>`, '', C.white);
}

function instagram(variant, shots, meta) {
  if (variant === 1) {
    const g = GROUND.skov;
    return page(1080, 1080, `
      <div style="position:relative;width:1080px;height:1080px;background:${C.skov};padding:96px;color:#fff">
        ${lockup(1.8, g)}
        <div style="position:absolute;right:96px;top:84px"><span style="display:inline-flex;align-items:center;height:64px;padding:0 30px;border-radius:32px;background:#fff;color:${C.ink};font-weight:700;font-size:28px">København</span></div>
        <div style="margin:110px 0 0 0;display:flex;justify-content:center">${posterMark(440, g)}</div>
        <div class="display" data-fit="tagline" style="position:absolute;left:96px;right:96px;bottom:96px;font-size:104px;line-height:1.0">Der er en plads<br>til dig.</div>
      </div>`, '', C.skov);
  }
  const g = GROUND.tomat;
  const src = pathToFileURL(path.join(shots, 'da', 'drop-home.png')).href;
  return page(1080, 1080, `
    <div style="position:relative;width:1080px;height:1080px;background:${g.bg};overflow:hidden;color:${g.text}">
      <div style="position:absolute;left:88px;top:88px;width:520px">
        ${lockup(1.6, g)}
        <div class="display" data-fit="headline" style="margin-top:72px;font-size:74px;line-height:1.0">Hver torsdag<br>kl. 18.00</div>
        <div class="headline" style="margin-top:28px;font-size:36px;line-height:1.2">Små grupper.<br>Rigtige møder.</div>
        <span style="display:inline-flex;align-items:center;margin-top:36px;height:60px;padding:0 28px;border-radius:30px;background:#fff;color:${C.ink};font-weight:700;font-size:26px">Aarhus</span>
      </div>
      <div style="position:absolute;left:600px;top:110px;transform:rotate(4deg)">${phone(src, meta['da/drop-home'].top, 380)}</div>
    </div>`, '', g.bg);
}

// ---------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.skipBuild) {
    rmSync(opts.buildDir, { recursive: true, force: true });
    buildPreview(opts.buildDir);
  } else if (!existsSync(path.join(opts.buildDir, 'index.html'))) {
    throw new Error(`--skip-build: no preview build in ${opts.buildDir}`);
  }
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  try {
    pixelPage = await browser.newPage();
    const shots = path.join(CACHE, 'shots');
    rmSync(shots, { recursive: true, force: true });
    const meta = await shootScreens(browser, opts.buildDir, [...STORE_SET.map((s) => s.id), ...EXTRA_SHOTS], shots);

    if (opts.only.includes('play')) {
      rmSync(path.join(OUT, 'play'), { recursive: true, force: true });
      await render(browser, iconHtml(512), 512, 512, path.join(OUT, 'play', 'icon-512.png'));
      for (const locale of ['da', 'en']) {
        await render(browser, featureGraphic(locale), 1024, 500, path.join(OUT, 'play', locale, 'feature-graphic.png'));
      }
      await storeSet(browser, shots, meta, { W: 1080, H: 1920, dir: 'play' });
    }
    if (opts.only.includes('appstore')) {
      rmSync(path.join(OUT, 'appstore'), { recursive: true, force: true });
      await storeSet(browser, shots, meta, { W: 1320, H: 2868, dir: 'appstore' });
    }
    if (opts.only.includes('social')) {
      rmSync(path.join(OUT, 'social'), { recursive: true, force: true });
      const s = (f) => path.join(OUT, 'social', f);
      for (const locale of ['en', 'da']) {
        await render(browser, heroBanner(locale, shots, meta), 1600, 800, s(`hero-banner-${locale}.png`));
        await render(browser, ogImage(locale, shots, meta), 1200, 630, s(`og-image-${locale}.png`));
        await render(browser, howItWorks(locale, shots, meta), 1600, 600, s(`how-it-works-${locale}.png`));
      }
      await render(browser, colourSystem(), 1600, 760, s('colour-system.png'));
      await render(browser, instagram(1, shots, meta), 1080, 1080, s('launch-da-koebenhavn-1080.png'));
      await render(browser, instagram(2, shots, meta), 1080, 1080, s('launch-da-aarhus-1080.png'));
    }
  } finally {
    await browser.close();
  }

  let total = 0;
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = path.join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  if (existsSync(OUT)) walk(OUT);
  console.log(`[marketing] done: ${(total / 1024 / 1024).toFixed(1)} MB in ${path.relative(repo, OUT)}`);
}

main().catch((e) => {
  console.error(`[marketing] ${e.stack ?? e}`);
  process.exit(1);
});
