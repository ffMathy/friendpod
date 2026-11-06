/**
 * Design tokens from the founder-approved storyboards (Grouper storyboards, 390×844 frames): colours for light and a
 * derived dark scheme, spacing, radii, the type scale and Plus Jakarta Sans per weight.
 *
 * Fonts are embedded natively by the expo-font config plugin (app.config.ts), so nothing loads at runtime. React Native
 * cannot synthesise weights for a custom font, so every weight is its own family: always take a weight from `Fonts`
 * (or `Type`), never set `fontWeight` next to a Plus Jakarta family. On Android an asset font plus `fontWeight` ≥ 700
 * makes RN look for `<family>_bold.ttf`, miss it and fall back to the system font.
 */
import { Platform, useColorScheme, type TextStyle } from 'react-native';

const light = {
  // Ground and surfaces
  ground: '#F3F5F1',
  surface: '#FFFFFF',
  /** A note box inside a white card ("Names and photos appear when…"), the copy-link field. */
  inset: '#F3F5F1',
  /** Illustration panels, placeholder avatars, chat system notices. */
  subtle: '#E9EEE8',
  /** Hairlines between rows inside a card. */
  divider: '#EEF1ED',
  border: '#DCE2DC',
  borderStrong: '#C9D1CA',
  /** Dashed outlines: empty seats, "Suggest another time". */
  dashed: '#B7C1B9',
  // Text
  ink: '#18211D',
  inkSoft: '#3E4943',
  muted: '#55605A',
  /** Decorative only (dashed circles, disabled glyphs); below AA for text. */
  faint: '#9AA59D',
  /** Text and icons on an ink-filled control (main CTA, selected chip). */
  onInk: '#FFFFFF',
  // Brand green
  primary: '#1E6B58',
  primaryPressed: '#174F42',
  onPrimary: '#FFFFFF',
  mint: '#E1EFE9',
  onMint: '#2C4A40',
  /** Strong text on mint: interest chips, "You're in", "Leading". */
  mintText: '#174F42',
  mintBorder: '#A9C8BD',
  // Amber: drops, deadlines, nudges
  amber: '#F2B544',
  onAmber: '#18211D',
  amberSoft: '#F7D58E',
  amberBg: '#FFF6E3',
  amberBorder: '#F2D9A0',
  amberText: '#7A5200',
  amberInk: '#4A3A12',
  /** The darker edge round an amber-filled star (a starred interest, storyboard 5.2). Decorative. */
  amberStroke: '#C88A12',
  /** An amber mark on an ink-filled control (the star on a starred chip): needs 3:1 against `ink` (WCAG 1.4.11). */
  starOnInk: '#F2B544',
  // Coral: danger, report, block, delete
  coralBg: '#FFF4F1',
  coralBorder: '#E8B4A6',
  coralText: '#8A2E17',
  coralTextSoft: '#6E2B1A',
  coralStrong: '#A8361B',
  onCoralStrong: '#FFFFFF',
  // Violet: private (sensitive) interests
  violet: '#4B3A8F',
  onViolet: '#FFFFFF',
  violetBg: '#EEEAF7',
  violetBorder: '#D9D2EE',
  violetText: '#2F2459',
  violetAvatar: '#CFC6EE',
  // Feature cards
  /** The dark "Next drop" / "Next step" / waitlist counter card. */
  night: '#18211D',
  onNight: '#FFFFFF',
  nightMuted: '#C9D1CA',
  nightSoft: '#E1EFE9',
  nightTrack: '#3A4540',
  nightBorder: '#55605A',
  /** The green "Confirmed" pod hero card. */
  forest: '#1E6B58',
  onForest: '#FFFFFF',
  forestMuted: '#D9EBE4',
  // States
  disabledBg: '#DCE2DC',
  disabledText: '#55605A',
  scrim: 'rgba(24, 33, 29, 0.55)',
  /**
   * The backdrop behind a bottom sheet route (storyboards 2.3, 4.2 draw the screen below as a flat #59615C): ink at
   * 70 %, which turns the ground into #5A615D and a white card into #5D6461.
   */
  sheetBackdrop: 'rgba(24, 33, 29, 0.7)',
};

/** Same hues on a deep green-black ground; every text pair is WCAG AA (≥ 4.5:1), most are AAA. */
const dark: Record<keyof typeof light, string> = {
  ground: '#0F1513',
  surface: '#18201C',
  inset: '#131A17',
  subtle: '#1F2924',
  divider: '#25302A',
  border: '#2B3631',
  borderStrong: '#3D4A43',
  dashed: '#4A5750',
  ink: '#E8EDE9',
  inkSoft: '#C3CDC6',
  muted: '#9BA69E',
  faint: '#6B776F',
  onInk: '#0F1513',
  primary: '#5FB49B',
  primaryPressed: '#4C9A83',
  onPrimary: '#0B1210',
  mint: '#173229',
  onMint: '#BFE0D3',
  mintText: '#A8D8C6',
  mintBorder: '#2F5A4B',
  amber: '#F2B544',
  onAmber: '#18211D',
  amberSoft: '#F7D58E',
  amberBg: '#2D2414',
  amberBorder: '#5A4720',
  amberText: '#F4C873',
  amberInk: '#F1DDB0',
  amberStroke: '#C88A12',
  /** Ink is near-white here, so the star turns deep amber (5.8:1). */
  starOnInk: '#7A5200',
  coralBg: '#2F1A15',
  coralBorder: '#6A3426',
  coralText: '#F2A48E',
  coralTextSoft: '#E9B8AA',
  coralStrong: '#E2765A',
  onCoralStrong: '#0B1210',
  violet: '#B5A6F0',
  onViolet: '#120E24',
  violetBg: '#231E3A',
  violetBorder: '#40386A',
  violetText: '#D8D0F5',
  violetAvatar: '#CFC6EE',
  night: '#222C27',
  onNight: '#F1F4F2',
  nightMuted: '#B8C3BB',
  nightSoft: '#D5E6DE',
  nightTrack: '#3A4741',
  nightBorder: '#5A6760',
  forest: '#1D4A3E',
  onForest: '#F1F4F2',
  forestMuted: '#CFE5DC',
  disabledBg: '#26302B',
  disabledText: '#97A39B',
  scrim: 'rgba(0, 0, 0, 0.6)',
  sheetBackdrop: 'rgba(0, 0, 0, 0.7)',
};

export const Colors = { light, dark } as const;

export type Palette = { readonly [K in keyof typeof Colors.light]: string };
export type ColorName = keyof Palette;

/** An avatar's colours: the circle and the initial on it. */
export interface AvatarFill {
  readonly bg: string;
  readonly fg: string;
}

/** The brand-green avatar fill (white initial). */
export const AvatarFillGreen = { bg: '#1E6B58', fg: '#FFFFFF' } as const;

/** Member avatar fills, in the storyboard order. The same in both schemes: they are light enough for ink text. */
export const AvatarFills = [
  { bg: '#F7D58E', fg: '#18211D' },
  { bg: '#8DBFAE', fg: '#18211D' },
  { bg: '#CFC6EE', fg: '#18211D' },
  { bg: '#F4C2B0', fg: '#18211D' },
  AvatarFillGreen,
] as const;

/**
 * What the green fill turns into on the green "Confirmed" hero (storyboard 3.1), where it would vanish: the mint tint
 * with dark mint text. The same in both schemes, like the other fills.
 */
export const AvatarFillOnForest = { bg: '#E1EFE9', fg: '#2C4A40' } as const;

/** The welcome illustration's circles (green, amber, mint shades). Decorative, so fixed in both schemes. */
export const HeroColors = ['#1E6B58', '#F2B544', '#8DBFAE', '#F7D58E', '#2F8A72'] as const;

/**
 * Spacing in points. `gutter` is the side padding of tab and pod screens (20), `gutterWide` that of welcome and
 * onboarding (24). The original xs–xl keep their values.
 */
export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  gutter: 20,
  gutterWide: 24,
} as const;

/** Corner radii. Pill-shaped controls use height / 2 (see `Sizes`). */
export const Radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 22,
  hero: 26,
  heroLg: 28,
  pill: 999,
} as const;

/** Control heights (minimums: text may grow with the user's font size). Touch targets are ≥ 44. */
export const Sizes = {
  button: 54,
  buttonMd: 48,
  buttonSm: 44,
  buttonXs: 40,
  input: 54,
  inputMd: 50,
  chip: 36,
  touch: 44,
} as const;

/** The storyboard type scale, in points. */
export const FontSize = {
  xxs: 11,
  xs: 12,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 17,
  xxl: 18,
  h5: 20,
  h4: 22,
  h3: 24,
  h2: 26,
  h1: 30,
  hero: 36,
  theme: 40,
  counter: 48,
} as const;

export type FontWeightName = 'regular' | 'medium' | 'semibold' | 'bold' | 'extrabold';

/**
 * The embedded Plus Jakarta Sans faces, one family per weight. Android names an asset font by its file name; iOS by
 * the PostScript name inside the file. Keep in sync with the expo-font entry in app.config.ts.
 */
export const IOS_FONT_FAMILY: Readonly<Record<FontWeightName, string>> = {
  regular: 'PlusJakartaSans-Regular',
  medium: 'PlusJakartaSans-Medium',
  semibold: 'PlusJakartaSans-SemiBold',
  bold: 'PlusJakartaSans-Bold',
  extrabold: 'PlusJakartaSans-ExtraBold',
};
export const ANDROID_FONT_FAMILY: Readonly<Record<FontWeightName, string>> = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};
export const FontFamily: Readonly<Record<FontWeightName, string>> = Platform.select({ ios: IOS_FONT_FAMILY, default: ANDROID_FONT_FAMILY });

const NUMERIC_WEIGHT = { regular: '400', medium: '500', semibold: '600', bold: '700', extrabold: '800' } as const;

/** A family plus the weight to declare with it (also the shape React Navigation's theme fonts take). */
export interface FontFace {
  readonly fontFamily: string;
  readonly fontWeight: '400' | '500' | '600' | '700' | '800';
}

function face(weight: FontWeightName): FontFace {
  // iOS picks the face by PostScript name and also matches the weight, so a missing font falls back to the system
  // font at the right weight. Android must not see a bold weight (see the file comment): it reads the face from the file.
  return Platform.OS === 'ios'
    ? { fontFamily: FontFamily[weight], fontWeight: NUMERIC_WEIGHT[weight] }
    : { fontFamily: FontFamily[weight], fontWeight: '400' };
}

/** Text style fragments per weight: `[Fonts.bold, { fontSize: 15 }]`. */
export const Fonts: Readonly<Record<FontWeightName, FontFace>> = {
  regular: face('regular'),
  medium: face('medium'),
  semibold: face('semibold'),
  bold: face('bold'),
  extrabold: face('extrabold'),
};

/** `font(700)` → `Fonts.bold`, for code that thinks in CSS weights. */
export function font(weight: 400 | 500 | 600 | 700 | 800): FontFace {
  const name = ({ 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold' } as const)[weight];
  return Fonts[name];
}

/** Letter spacing in points from the storyboards' em values. */
const em = (size: number, value: number) => Math.round(size * value * 100) / 100;

/**
 * Plus Jakarta Sans' vertical metrics in em, the same in all five weights (hhea = OS/2 typo, USE_TYPO_METRICS). A
 * `normal` line is ascent + descent = 1.26 em tall. The ink goes a little further: over Latin-1 and Latin Extended-A in
 * every weight, Å and Ů reach 1.044 em above the baseline, and the cedillas (ç, ŗ) reach 0.263 em below it (g, j and y
 * reach 0.222). test/glyphRoom.test.tsx reads these numbers from the embedded font files.
 */
export const FontMetrics = { ascent: 1.038, descent: 0.222, inkTop: 1.044, inkBottom: 0.263 } as const;

/** The padding a tight title draws its overflowing glyphs in, and the negative margins that cancel it. */
export interface GlyphRoom {
  readonly paddingTop?: number;
  readonly paddingBottom?: number;
  readonly marginTop?: number;
  readonly marginBottom?: number;
}

/**
 * The room a text needs outside its line box so no glyph is cut, for a `lineHeight` below the font's 1.26 em. The
 * storyboards set titles at 1.05 to 1.15. Like CSS, React Native takes the shortfall half above the first line and half
 * below the last (Android's CustomLineHeightSpan). A browser still draws the overflow, but a text view clips to its box,
 * so "baking bread" (40/42) lost the bottom 4 dp of its g on Android, and Å would lose its ring.
 *
 * The text is padded by the overflow plus 1 for the whole-pixel rounding of font metrics, and equal negative margins
 * pull the padding back out of the layout. Lines are spaced and placed as in the storyboard, and the ink draws inside
 * the view. Space these texts with the parent's `gap` or padding, because a vertical margin or padding set on the text
 * itself replaces this compensation. A style that changes the size of a preset recomputes the room:
 * `{ ...Type.title, ...tightLine(32, 37) }`.
 */
export function glyphRoom(fontSize: number, lineHeight: number): GlyphRoom {
  const halfLeading = (lineHeight - fontSize * (FontMetrics.ascent + FontMetrics.descent)) / 2;
  if (halfLeading >= 0) return {};
  const top = Math.ceil(fontSize * (FontMetrics.inkTop - FontMetrics.ascent) - halfLeading + 1);
  const bottom = Math.ceil(fontSize * (FontMetrics.inkBottom - FontMetrics.descent) - halfLeading + 1);
  return { paddingTop: top, paddingBottom: bottom, marginTop: -top, marginBottom: -bottom };
}

/**
 * Android variant of the glyph room. Android's text view clips glyphs at its content box (padding included), so the
 * padding of `glyphRoom` does not save the descender there: on the device "baking bread" (40/42) still lost the tail of
 * its g. Android instead gets a line tall enough for the ink (the font's 1.307 em plus 1 for rounding), and equal
 * negative margins pull the extra back out of the layout, so a one-line title takes exactly the storyboard's space.
 * A title that wraps keeps the font's own leading between its lines, a little looser than drawn.
 */
export function androidGlyphRoom(fontSize: number, lineHeight: number): { readonly lineHeight: number } & GlyphRoom {
  const inkLine = Math.ceil(fontSize * (FontMetrics.inkTop + FontMetrics.inkBottom)) + 1;
  if (lineHeight >= inkLine) return { lineHeight };
  const extra = inkLine - lineHeight;
  const top = Math.floor(extra / 2);
  return { lineHeight: inkLine, marginTop: -top, marginBottom: -(extra - top) };
}

/** A size and line height plus the glyph room it needs on this platform (see `glyphRoom`, `androidGlyphRoom`). */
export function tightLineFor(os: string, fontSize: number, lineHeight: number): { readonly fontSize: number; readonly lineHeight: number } & GlyphRoom {
  return os === 'android' ? { fontSize, ...androidGlyphRoom(fontSize, lineHeight) } : { fontSize, lineHeight, ...glyphRoom(fontSize, lineHeight) };
}

/** `tightLineFor` on the running platform. */
export function tightLine(fontSize: number, lineHeight: number): { readonly fontSize: number; readonly lineHeight: number } & GlyphRoom {
  return tightLineFor(Platform.OS, fontSize, lineHeight);
}

/**
 * Text presets (no colour; add `{ color: p.ink }` etc.). Line heights follow the storyboards: 1.5 for paragraphs,
 * about 1.15 for titles. Titles tighter than the font's own line take their glyph room from `tightLine`.
 */
export const Type = {
  /** Welcome hero, 36/800. */
  hero: { ...Fonts.extrabold, ...tightLine(FontSize.hero, 40), letterSpacing: em(FontSize.hero, -0.03) },
  /** A pod's theme on the proposal card, 40/800 (storyboards 2.2, 2.4: line-height 1.05). */
  theme: { ...Fonts.extrabold, ...tightLine(FontSize.theme, 42), letterSpacing: em(FontSize.theme, -0.03) },
  /** Screen titles, 30/800. */
  title: { ...Fonts.extrabold, ...tightLine(FontSize.h1, 35), letterSpacing: em(FontSize.h1, -0.02) },
  /** Modal screen titles ("Suggest a time", "Report Jonas"), 26/800. */
  titleMd: { ...Fonts.extrabold, ...tightLine(FontSize.h2, 31), letterSpacing: em(FontSize.h2, -0.02) },
  /** Sheet titles and in-card headlines ("No pod for you this week"), 24/800. */
  titleSm: { ...Fonts.extrabold, ...tightLine(FontSize.h3, 29), letterSpacing: em(FontSize.h3, -0.02) },
  /** Card headlines ("Still coming tomorrow at 14:00?"), 22/800. */
  headline: { ...Fonts.extrabold, ...tightLine(FontSize.h4, 27) },
  /** Card titles ("Saturday 15 Nov, 14:00"), 18/800. */
  heading: { ...Fonts.extrabold, fontSize: FontSize.xxl, lineHeight: 24 },
  /** Small card titles ("Help Odense open sooner"), 17/800. */
  headingSm: { ...Fonts.extrabold, fontSize: FontSize.xl, lineHeight: 23 },
  /** Section titles and field labels, 15/700. */
  section: { ...Fonts.bold, fontSize: FontSize.base, lineHeight: 21 },
  /** Grouped-list labels ("WHAT YOU'VE AGREED TO"), 13/700 uppercase. */
  overline: { ...Fonts.bold, fontSize: FontSize.sm, lineHeight: 18, letterSpacing: em(FontSize.sm, 0.04), textTransform: 'uppercase' },
  /** Labels on dark cards ("NEXT STEP", "ODENSE WAITLIST"), 13/800 uppercase. */
  overlineStrong: { ...Fonts.extrabold, fontSize: FontSize.sm, lineHeight: 18, letterSpacing: em(FontSize.sm, 0.06), textTransform: 'uppercase' },
  /** Lead paragraphs, 16/400. */
  body: { ...Fonts.regular, fontSize: FontSize.lg, lineHeight: 24 },
  /** Paragraphs in cards, 15/400. */
  bodyMd: { ...Fonts.regular, fontSize: FontSize.base, lineHeight: 22 },
  /** Small paragraphs, 14/400. */
  bodySm: { ...Fonts.regular, fontSize: FontSize.md, lineHeight: 21 },
  /** Helper text under fields and cards, 13/400. */
  caption: { ...Fonts.regular, fontSize: FontSize.sm, lineHeight: 19 },
  /** Fine print, 12/400. */
  micro: { ...Fonts.regular, fontSize: FontSize.xs, lineHeight: 17 },
  /** Row titles ("Private interests"), 16/600. */
  rowTitle: { ...Fonts.semibold, fontSize: FontSize.lg, lineHeight: 22 },
  /** Buttons, 16/700. */
  button: { ...Fonts.bold, fontSize: FontSize.lg, lineHeight: 21 },
  /** Compact buttons and chips, 14/700. */
  buttonSm: { ...Fonts.bold, fontSize: FontSize.md, lineHeight: 19 },
  /** Interest chips, 14/600. */
  chip: { ...Fonts.semibold, fontSize: FontSize.md, lineHeight: 19 },
  /** Text inputs, 17/400. */
  input: { ...Fonts.regular, fontSize: FontSize.xl },
  /** Big counters (waitlist), 48/800. */
  counter: { ...Fonts.extrabold, ...tightLine(FontSize.counter, 54), letterSpacing: em(FontSize.counter, -0.03) },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof Type;

export function usePalette(): Palette {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/**
 * The status bar's icons and clock per scheme: dark on the light ground, light on the dark one. Every screen meets the
 * status bar with the ground, white or a dimmed sheet backdrop (the dark and green cards sit below the header), so one
 * style per scheme holds everywhere.
 */
export const StatusBarStyles = { light: 'dark-content', dark: 'light-content' } as const;

export type StatusBarContent = (typeof StatusBarStyles)[keyof typeof StatusBarStyles];

export function useStatusBarStyle(): StatusBarContent {
  return StatusBarStyles[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/** Picks a stable avatar fill for a uid or name (the same person keeps the same colour everywhere). */
export function avatarFill(seed: string): (typeof AvatarFills)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AvatarFills[h % AvatarFills.length] ?? AvatarFills[0];
}
