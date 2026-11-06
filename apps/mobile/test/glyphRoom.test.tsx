import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ConfigContext } from 'expo/config';
import type { ReactElement } from 'react';
import { StyleSheet, type TextStyle } from 'react-native';
import appConfig from '../app.config';
import { FontMetrics, Type, glyphRoom, type TypeVariant } from '@/components/theme';
import { NextDropCard } from '@/features/drop/NextDropCard';
import { ProposalCard } from '@/features/pods/ProposalCard';

/*
 * Storyboards 2.2 and 2.4 set the pod's theme at 40px with line-height 1.05, tighter than Plus Jakarta Sans' own
 * 1.26 em line. A browser draws the overflowing glyphs; an Android text view clips them to its box, so on device the
 * g of "baking bread" lost the bottom of its tail. These tests read the font's metrics from the embedded files and replay
 * Android's line-height arithmetic for every preset, so a preset (or a card style) that cuts glyphs again fails here.
 */

const projectRequire = createRequire(path.join(__dirname, '..', 'package.json'));
const ctx = { config: {}, projectRoot: path.join(__dirname, '..') } as unknown as ConfigContext;
const fontPlugin = appConfig(ctx).plugins?.find((entry) => Array.isArray(entry) && entry[0] === 'expo-font');
const fontFiles = (Array.isArray(fontPlugin) ? (fontPlugin[1] as { fonts: string[] }).fonts : []).map((f) => projectRequire.resolve(f));

interface Face {
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  /** The glyph outline's [yMin, yMax] in font units, or null for an empty glyph (space) or an unmapped code point. */
  readonly extent: (codePoint: number) => readonly [number, number] | null;
}

/** Reads head, hhea, a (3,1) format-4 cmap, loca and glyf: enough for the vertical extent of each character. */
function readFace(file: string): Face {
  const buf = readFileSync(file);
  const tables = new Map<string, number>();
  for (let i = 0; i < buf.readUInt16BE(4); i++) {
    const rec = 12 + 16 * i;
    tables.set(buf.toString('latin1', rec, rec + 4), buf.readUInt32BE(rec + 8));
  }
  const at = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`no ${tag} table in ${file}`);
    return offset;
  };
  const head = at('head');
  const hhea = at('hhea');
  const cmap = at('cmap');
  const loca = at('loca');
  const glyf = at('glyf');
  const longLoca = buf.readInt16BE(head + 50) === 1;

  let sub = -1;
  for (let i = 0; i < buf.readUInt16BE(cmap + 2); i++) {
    const rec = cmap + 4 + 8 * i;
    if (buf.readUInt16BE(rec) === 3 && buf.readUInt16BE(rec + 2) === 1) sub = cmap + buf.readUInt32BE(rec + 4);
  }
  if (sub < 0 || buf.readUInt16BE(sub) !== 4) throw new Error(`no (3,1) format-4 cmap in ${file}`);
  const segX2 = buf.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const rangeOffsets = deltas + segX2;

  const glyphId = (cp: number): number => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (cp > buf.readUInt16BE(ends + 2 * i)) continue;
      const start = buf.readUInt16BE(starts + 2 * i);
      if (cp < start) return 0;
      const delta = buf.readUInt16BE(deltas + 2 * i);
      const rangeOffset = buf.readUInt16BE(rangeOffsets + 2 * i);
      if (rangeOffset === 0) return (cp + delta) & 0xffff;
      const g = buf.readUInt16BE(rangeOffsets + 2 * i + rangeOffset + 2 * (cp - start));
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  const offset = (g: number) => (longLoca ? buf.readUInt32BE(loca + 4 * g) : 2 * buf.readUInt16BE(loca + 2 * g));

  return {
    unitsPerEm: buf.readUInt16BE(head + 18),
    ascent: buf.readInt16BE(hhea + 4),
    descent: -buf.readInt16BE(hhea + 6),
    lineGap: buf.readInt16BE(hhea + 8),
    extent: (cp) => {
      const g = glyphId(cp);
      if (g === 0 || offset(g) === offset(g + 1)) return null;
      const glyph = glyf + offset(g);
      return [buf.readInt16BE(glyph + 4), buf.readInt16BE(glyph + 8)];
    },
  };
}

const faces = fontFiles.map(readFace);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** The English and Danish alphabets with ASCII punctuation: the app's own copy. */
const APP_COPY = [...range(0x20, 0x7e), ...[...'ÆØÅæøåé'].map((c) => c.codePointAt(0) ?? 0)];
/** Latin-1 and Latin Extended-A: what people type as a theme (ç, ŗ, Ů, …). */
const LATIN = [...range(0x20, 0x7e), ...range(0xa0, 0x17f)];

/** How far the ink of these characters reaches above and below the baseline, in em, over all five weights. */
function ink(codePoints: readonly number[]): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const face of faces) {
    for (const cp of codePoints) {
      const extent = face.extent(cp);
      if (!extent) continue;
      bottom = Math.max(bottom, -extent[0] / face.unitsPerEm);
      top = Math.max(top, extent[1] / face.unitsPerEm);
    }
  }
  return { top, bottom };
}

/** hdpi to xxxhdpi, including the 2.625 and 2.75 of most current phones. */
const DENSITIES = [1.5, 2, 2.625, 2.75, 3, 3.5, 4];

/**
 * The room (px) between the ink and the edges of an Android text view holding this style, at the worst density: RN
 * ceils the font size and line height to pixels (TextAttributeProps, CustomLineHeightSpan), Paint rounds the ascent and
 * descent, CustomLineHeightSpan puts ceil(leading / 2) above the first line and floor(leading / 2) below the last, and
 * the view's padding adds the rest. Negative means the text view cuts glyphs.
 */
function androidClearance(style: TextStyle, reach: { top: number; bottom: number }): { top: number; bottom: number } {
  const fontSize = Number(style.fontSize);
  const lineHeight = Number(style.lineHeight);
  let top = Infinity;
  let bottom = Infinity;
  for (const d of DENSITIES) {
    const size = Math.ceil(fontSize * d);
    const ascent = Math.round(size * FontMetrics.ascent);
    const descent = Math.round(size * FontMetrics.descent);
    const leading = Math.ceil(lineHeight * d) - (ascent + descent);
    const boxTop = ascent + Math.ceil(leading / 2) + Math.round(Number(style.paddingTop ?? 0) * d);
    const boxBottom = descent + Math.floor(leading / 2) + Math.round(Number(style.paddingBottom ?? 0) * d);
    top = Math.min(top, boxTop - size * reach.top);
    bottom = Math.min(bottom, boxBottom - size * reach.bottom);
  }
  return { top, bottom };
}

/** Tighter than the font's own line: these need (and get) glyph room, sized for anything typed in a Latin script. */
const isTight = (style: TextStyle) => Number(style.lineHeight) < Number(style.fontSize) * (FontMetrics.ascent + FontMetrics.descent);

const presets = (Object.keys(Type) as TypeVariant[]).filter((name) => (Type[name] as TextStyle).lineHeight !== undefined);

describe('glyph room: font metrics', () => {
  it('embeds five faces that share one set of vertical metrics', () => {
    expect(faces).toHaveLength(5);
    for (const face of faces) {
      expect(face.ascent / face.unitsPerEm).toBeCloseTo(FontMetrics.ascent, 6);
      expect(face.descent / face.unitsPerEm).toBeCloseTo(FontMetrics.descent, 6);
      expect(face.lineGap).toBe(0);
    }
  });

  it('bounds the ink of Latin-1 and Latin Extended-A in every weight', () => {
    const latin = ink(LATIN);
    expect(FontMetrics.inkTop).toBeGreaterThanOrEqual(latin.top);
    expect(FontMetrics.inkBottom).toBeGreaterThanOrEqual(latin.bottom);
    // The cedillas and the ring of Å reach past the line metrics, so a line box cut to them still clips.
    expect(latin.top).toBeGreaterThan(FontMetrics.ascent);
    expect(latin.bottom).toBeGreaterThan(FontMetrics.descent);
  });
});

describe('glyph room: type presets', () => {
  it('keeps the storyboard sizes and line heights of the tight titles', () => {
    expect(Type.theme).toMatchObject({ fontSize: 40, lineHeight: 42 });
    expect(Type.hero).toMatchObject({ fontSize: 36, lineHeight: 40 });
    expect(Type.title).toMatchObject({ fontSize: 30, lineHeight: 35 });
    expect(Type.titleMd).toMatchObject({ fontSize: 26, lineHeight: 31 });
    expect(Type.titleSm).toMatchObject({ fontSize: 24, lineHeight: 29 });
    expect(Type.headline).toMatchObject({ fontSize: 22, lineHeight: 27 });
    expect(Type.counter).toMatchObject({ fontSize: 48, lineHeight: 54 });
  });

  it.each(presets)('%s draws every glyph inside its text view on Android', (name) => {
    const style = Type[name] as TextStyle;
    const clearance = androidClearance(style, isTight(style) ? ink(LATIN) : ink(APP_COPY));
    expect(clearance.top).toBeGreaterThanOrEqual(0);
    expect(clearance.bottom).toBeGreaterThanOrEqual(0);
  });

  it.each(presets)('%s keeps its layout box at the line height: the glyph room is cancelled by margins', (name) => {
    const style = Type[name] as TextStyle;
    expect(Number(style.paddingTop ?? 0) + Number(style.marginTop ?? 0)).toBe(0);
    expect(Number(style.paddingBottom ?? 0) + Number(style.marginBottom ?? 0)).toBe(0);
    if (!isTight(style)) expect(style.paddingTop ?? style.paddingBottom).toBeUndefined();
  });

  it('gives no room to a line at or above the font line, and room on both sides to a tighter one', () => {
    expect(glyphRoom(16, 24)).toEqual({});
    expect(glyphRoom(40, 42)).toEqual({ paddingTop: 6, paddingBottom: 7, marginTop: -6, marginBottom: -7 });
  });
});

// The cards render the presets: their resolved styles must keep the room (no margin or padding override).

const POD_ID = 'abcdefghijklmnopqrst';
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), useLocalSearchParams: () => ({ podId: 'abcdefghijklmnopqrst' }) }));
jest.mock('@/features/session/SessionProvider', () => ({ useUid: () => 'me' }));
jest.mock('@/firebase/callables', () => ({ callFunction: jest.fn(), toAppError: (e: unknown) => e }));

const ts = (ms: number) => ({ toMillis: () => ms });
function card(over: Record<string, unknown> = {}) {
  return {
    state: 'proposed',
    myStatus: 'invited',
    themeLabel: 'baking bread',
    themeSensitive: false,
    sizeTarget: 5,
    acceptedCount: 2,
    acceptBy: ts(Date.now() + 86_400_000),
    reasons: [{ code: 'NEAR_YOU', km: 10 }],
    areaLabel: 'Aarhus C',
    ...over,
  } as never;
}

let client: QueryClient | undefined;
async function renderWith(ui: ReactElement) {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
afterEach(() => {
  client?.clear();
  client = undefined;
});

const flat = (el: { props: { style?: unknown } }) => (StyleSheet.flatten(el.props.style as never) ?? {}) as TextStyle;

describe('glyph room: the cards', () => {
  it.each([
    ['the proposal card (2.2)', {}],
    ['the waiting card (2.4)', { myStatus: 'accepted', acceptedCount: 3 }],
  ])('%s draws the whole theme title, at 40/42', async (_, over) => {
    await renderWith(<ProposalCard podId={POD_ID} card={card(over)} />);
    const title = flat(screen.getByRole('header', { name: 'baking bread' }));
    expect(title).toMatchObject({ fontSize: 40, lineHeight: 42, ...glyphRoom(40, 42) });
    const clearance = androidClearance(title, ink(LATIN));
    expect(clearance.bottom).toBeGreaterThanOrEqual(0);
    expect(clearance.top).toBeGreaterThanOrEqual(0);
  });

  it("the next drop's 32/37 time takes the room of its own size", async () => {
    await renderWith(<NextDropCard user={{ status: 'active', participation: { mode: 'auto' } } as never} now={Date.now()} />);
    const time = flat(screen.getByRole('header'));
    expect(time).toMatchObject({ fontSize: 32, lineHeight: 37, ...glyphRoom(32, 37) });
    const clearance = androidClearance(time, ink(APP_COPY));
    expect(clearance.bottom).toBeGreaterThanOrEqual(0);
    expect(clearance.top).toBeGreaterThanOrEqual(0);
  });
});
