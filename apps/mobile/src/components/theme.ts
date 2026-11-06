/**
 * Design tokens, taken from the storyboards (design-canvas `*.dc.html`, 390 × 844 CSS px; React Native layout
 * units equal CSS px at that width, so every number here is the storyboard's own).
 *
 * Light mode matches the storyboards exactly. Dark mode keeps the brand: the green stays the primary (lighter,
 * with dark text on it so it stays readable), surfaces are warm green-greys, accents keep their hue.
 *
 * Typography: Plus Jakarta Sans, one font family per weight (React Native needs that for custom fonts). Never
 * set `fontWeight` in a style; use `font(weight)` or a `Type` variant, which map the weight to its family.
 */
import { useColorScheme, type TextStyle } from 'react-native';

// ---------------------------------------------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------------------------------------------

const light = {
  /** Page background (every screen). */
  page: '#F3F5F1',
  /** Cards, inputs, tab bar, sheets. */
  surface: '#FFFFFF',
  /** Illustration panels, chat system notes, empty avatar slots. */
  surfaceMuted: '#E9EEE8',
  /** A grey note inside a white card ("Names and photos appear…"). Same as the page in light mode. */
  inset: '#F3F5F1',

  /** Headings and primary text. */
  text: '#18211D',
  /** Secondary copy inside cards (places, body text on cards). */
  textSecondary: '#3E4943',
  /** Long-form prose (consent text, deletion list). */
  textBody: '#2C3631',
  /** Helper text, captions, inactive tabs, "Step 2 of 6". */
  textMuted: '#55605A',
  /** Placeholders, unfilled star outline, dashed empty circles. */
  textFaint: '#9AA59D',

  /** Card borders, dividers, progress tracks. */
  border: '#DCE2DC',
  /** Inputs and outline buttons, sheet handle. */
  borderStrong: '#C9D1CA',
  /** Row separators inside a card. */
  separator: '#EEF1ED',
  /** Dashed outlines ("Suggest another time", empty seats). */
  borderDashed: '#B7C1B9',

  /** Brand green: primary buttons, links, progress, selected states. */
  primary: '#1E6B58',
  /** Pressed primary, link hover, text on mint. */
  primaryPressed: '#174F42',
  onPrimary: '#FFFFFF',

  /** The green hero card ("Confirmed"). */
  brand: '#1E6B58',
  onBrand: '#FFFFFF',
  onBrandMuted: '#D9EBE4',

  /** Mint tint: tags, "safety pledge" and "meet again" cards, the welcome illustration panel. */
  mint: '#E1EFE9',
  onMint: '#174F42',
  mintBody: '#2C4A40',
  mintBorder: '#A9C8BD',

  /** Near-black: dark buttons, selected chips, the selected language, the "You" avatar. */
  ink: '#18211D',
  onInk: '#FFFFFF',

  /** The dark hero card ("Next drop", "Next step", waitlist). */
  hero: '#18211D',
  onHero: '#FFFFFF',
  onHeroMuted: '#C9D1CA',
  onHeroBody: '#E1EFE9',
  heroTrack: '#3A4540',
  heroBorder: '#55605A',

  /** Sun yellow: "Next drop" / "New pod" badges, the waitlist bar, eyebrows on dark cards, the star. */
  accent: '#F2B544',
  onAccent: '#18211D',
  accentSoft: '#F7D58E',
  sage: '#8DBFAE',
  leaf: '#2F8A72',

  /** Amber notices: chat "You haven't met yet", "Did you mean", priority, "Hasn't confirmed". */
  warningBg: '#FFF6E3',
  warningBorder: '#F2D9A0',
  warningText: '#7A5200',
  warningInk: '#4A3A12',
  warningControlBorder: '#C9A85B',
  starStroke: '#C88A12',

  /** Red: report, delete, withdraw, 112. `danger` is the solid destructive button. */
  danger: '#A8361B',
  onDanger: '#FFFFFF',
  dangerBg: '#FFF4F1',
  dangerBorder: '#E8B4A6',
  dangerText: '#8A2E17',
  dangerInk: '#6E2B1A',

  /** Purple: private (sensitive) interests and pods about them. `private` is the solid chip/button. */
  private: '#4B3A8F',
  privatePressed: '#36296B',
  onPrivate: '#FFFFFF',
  privateBg: '#EEEAF7',
  privateBorder: '#D9D2EE',
  privateText: '#4B3A8F',
  privateInk: '#2F2459',

  /** Behind a bottom sheet. */
  scrim: '#59615C',
  /** Disabled buttons. */
  disabledBg: '#DCE2DC',
  disabledText: '#55605A',

  /** Initials avatars (the "You" avatar uses ink). Text on them is `onAvatar`. */
  avatar1: '#F7D58E',
  avatar2: '#8DBFAE',
  avatar3: '#CFC6EE',
  avatar4: '#F4C2B0',
  onAvatar: '#18211D',
};

export type PaletteKey = keyof typeof light;
export type Palette = { readonly [K in PaletteKey]: string };

const dark: Palette = {
  page: '#111513',
  surface: '#1A1F1C',
  surfaceMuted: '#252C28',
  inset: '#151A17',

  text: '#EDF1EC',
  textSecondary: '#C5CEC7',
  textBody: '#D6DDD7',
  textMuted: '#A0ABA4',
  textFaint: '#6E7972',

  border: '#2C3531',
  borderStrong: '#3D4843',
  separator: '#242B27',
  borderDashed: '#4C5852',

  primary: '#5FC2A1',
  primaryPressed: '#4BAA8A',
  onPrimary: '#0B1F18',

  brand: '#1D5747',
  onBrand: '#FFFFFF',
  onBrandMuted: '#C6E2D7',

  mint: '#1C3830',
  onMint: '#A9DCC8',
  mintBody: '#C1DBD1',
  mintBorder: '#3C6A5C',

  ink: '#EDF1EC',
  onInk: '#141917',

  hero: '#232C28',
  onHero: '#FFFFFF',
  onHeroMuted: '#B8C3BB',
  onHeroBody: '#D3E5DD',
  heroTrack: '#3A4641',
  heroBorder: '#606C66',

  accent: '#F2B544',
  onAccent: '#18211D',
  accentSoft: '#E9C67D',
  sage: '#7FB3A2',
  leaf: '#3A9A80',

  warningBg: '#2D2614',
  warningBorder: '#5C4A22',
  warningText: '#F0C46C',
  warningInk: '#EADDBD',
  warningControlBorder: '#8C7238',
  starStroke: '#E0A93A',

  danger: '#C9482B',
  onDanger: '#FFFFFF',
  dangerBg: '#331C17',
  dangerBorder: '#6E3628',
  dangerText: '#F3A893',
  dangerInk: '#EDCBC1',

  private: '#6E5AC8',
  privatePressed: '#5A47AE',
  onPrivate: '#FFFFFF',
  privateBg: '#29233F',
  privateBorder: '#463C6E',
  privateText: '#BCAEF2',
  privateInk: '#DDD6F7',

  scrim: 'rgba(0, 0, 0, 0.6)',
  disabledBg: '#2C3531',
  disabledText: '#97A29B',

  avatar1: '#E9C67D',
  avatar2: '#86B9A8',
  avatar3: '#C3B9EA',
  avatar4: '#E8B6A4',
  onAvatar: '#18211D',
};

export const Colors: { readonly light: Palette; readonly dark: Palette } = { light, dark };

export type ColorScheme = 'light' | 'dark';

export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === 'dark' ? 'dark' : 'light';
}

/** The palette for the system appearance. */
export function usePalette(): Palette {
  return Colors[useColorSchemeName()];
}

/** The four initials-avatar colours, in order; pick one with `avatarColor(seed)`. */
export const AVATAR_KEYS = ['avatar1', 'avatar2', 'avatar3', 'avatar4'] as const satisfies readonly PaletteKey[];

/** A stable avatar colour for a uid or name (same person, same colour, on every screen). */
export function avatarColorKey(seed: string): (typeof AVATAR_KEYS)[number] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_KEYS[h % AVATAR_KEYS.length] ?? 'avatar1';
}

// ---------------------------------------------------------------------------------------------------------------
// Space, radius, borders, sizes
// ---------------------------------------------------------------------------------------------------------------

/** The spacing steps the storyboards use (gaps and paddings), keyed by their pixel value. */
export const Space = {
  2: 2,
  4: 4,
  6: 6,
  8: 8,
  10: 10,
  12: 12,
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  22: 22,
  24: 24,
  28: 28,
  32: 32,
  40: 40,
} as const;

/** Page layout. */
export const Layout = {
  /** Side padding of onboarding, sign-in and form screens. */
  gutter: 24,
  /** Side padding of tab screens and pod screens. */
  gutterCompact: 20,
  /** Gap between a screen's blocks. */
  gap: 16,
  /** Gap between blocks on onboarding steps. */
  gapLoose: 24,
  /** Bottom padding under the pinned action area (also the minimum safe-area inset). */
  bottom: 32,
  /** Padding inside a standard card. */
  cardPadding: 16,
  /** Padding inside hero cards (proposal, next drop, confirmed). */
  heroPadding: 22,
} as const;

export const Radius = {
  /** Thin tracks (age slider). */
  track: 2,
  /** Progress bars: half their height. */
  bar: 3,
  /** Availability grid cells, chat system note. */
  sm: 10,
  /** Inputs, rating buttons, notes inside cards, square "Add" button. */
  md: 14,
  /** Notices, list-link rows, consent checkbox card. */
  lg: 16,
  /** Member action rows, places list. */
  xl: 18,
  /** Standard card. */
  card: 20,
  /** Plan option / plan / chat cards. */
  cardLg: 22,
  /** Hero cards (next drop, next step, waitlist). */
  hero: 26,
  /** Proposal card, confirmed card, sheets (top corners), the welcome illustration. */
  panel: 28,
  /** Pills: buttons, chips, badges, avatars. */
  pill: 999,
} as const;

export const BorderWidth = {
  /** Card, input and outline-button borders. */
  hairline: 1,
  /** Selected option card, focused input, dashed outlines, avatar ring. */
  strong: 2,
} as const;

export const Size = {
  /** Minimum touch target (DESIGN accessibility rule). */
  hitTarget: 44,
  /** Full-width primary/secondary button. */
  button: 54,
  /** Hero-card button ("Yes, I'm coming", "Keep pod"). */
  buttonMedium: 48,
  /** Half-width pill ("Skip this week", "Add to calendar", "5 km"). */
  buttonCompact: 44,
  /** Inline small pill ("Add a photo", "Yes"/"No" vote). Gets hitSlop up to 44. */
  buttonSmall: 40,
  /** Text input. */
  input: 54,
  /** Interest add field, search field, date and time inputs. */
  inputCompact: 52,
  /** Selectable / removable interest chip. */
  chip: 36,
  /** Static mint tag. */
  tag: 30,
  /** Badge ("Next drop", "18+ only"). */
  badge: 28,
  /** Small badge ("Leading", "3 new"). */
  badgeSmall: 24,
  /** Onboarding progress bar. */
  progress: 6,
  /** Tab bar height without the bottom safe-area inset. */
  tabBar: 64,
  icon: 24,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------------------------------------------

export type FontWeight = '400' | '500' | '600' | '700' | '800';

/** One family per weight; the names are the keys `useFonts` registers (see `fonts.ts`). */
export const FontFamily: Readonly<Record<FontWeight, string>> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
};

/** The style for a weight: its family, never `fontWeight`. */
export function font(weight: FontWeight = '400'): { fontFamily: string } {
  return { fontFamily: FontFamily[weight] };
}

interface TypeSpec {
  readonly size: number;
  readonly weight: FontWeight;
  /** letter-spacing in em, as in the storyboards. */
  readonly tracking?: number;
  /** line-height as a multiple of the size; the storyboards' `normal` is about 1.26. */
  readonly leading?: number;
  readonly upper?: boolean;
}

/** Every size/weight/tracking/leading combination the storyboards use. */
export const TypeScale = {
  /** 48/800 waitlist counter. */
  counter: { size: 48, weight: '800', tracking: -0.03, leading: 1.1 },
  /** 40/800 pod theme on the proposal card. */
  theme: { size: 40, weight: '800', tracking: -0.03, leading: 1.05 },
  /** 36/800 welcome headline. */
  display: { size: 36, weight: '800', tracking: -0.03, leading: 1.1 },
  /** 34/800 pod theme on the confirmed card. */
  themeCompact: { size: 34, weight: '800', tracking: -0.03, leading: 1.05 },
  /** 32/800 "Thursday 18:00". */
  countdown: { size: 32, weight: '800', tracking: -0.02, leading: 1.2 },
  /** 30/800 screen title (h1). */
  title: { size: 30, weight: '800', tracking: -0.02, leading: 1.15 },
  /** 28/800 long screen title (consent). */
  titleCompact: { size: 28, weight: '800', tracking: -0.02, leading: 1.15 },
  /** 26/800 title of a full-screen form with a close button ("Suggest a time", "Report Jonas"). */
  titleModal: { size: 26, weight: '800', tracking: -0.02, leading: 1.2 },
  /** 24/800 sheet title, empty-state title, pod name in a header. */
  headline: { size: 24, weight: '800', tracking: -0.02, leading: 1.25 },
  /** 22/800 question on a hero card ("Still coming tomorrow at 14:00?"). */
  headlineCompact: { size: 22, weight: '800', leading: 1.2 },
  /** 22/800 the wordmark. */
  wordmark: { size: 22, weight: '800', tracking: -0.02, leading: 1.2 },
  /** 20/800 a value on a card ("Aarhus C"). */
  stat: { size: 20, weight: '800', leading: 1.25 },
  /** 18/800 card title (plan option date). */
  cardTitle: { size: 18, weight: '800', leading: 1.3 },
  /** 17/800 numbers ("28–42", "3 of 5 said yes", rating digits). */
  numeral: { size: 17, weight: '800', leading: 1.3 },
  /** 17/400 text inputs. */
  input: { size: 17, weight: '400', leading: 1.3 },
  /** 16/400 lede paragraph under a title. */
  lede: { size: 16, weight: '400', leading: 1.5 },
  /** 16/700 button label. */
  button: { size: 16, weight: '700', leading: 1.25 },
  /** 16/600 list row title. */
  rowTitle: { size: 16, weight: '600', leading: 1.3 },
  /** 15/700 section heading (h2), field label, legend. */
  heading: { size: 15, weight: '700', leading: 1.35 },
  /** 15/400 body text. */
  body: { size: 15, weight: '400', leading: 1.5 },
  /** 15/600 emphasised body: member names, link rows, selected radio. */
  bodyStrong: { size: 15, weight: '600', leading: 1.4 },
  /** 14/400 small text on cards. */
  small: { size: 14, weight: '400', leading: 1.5 },
  /** 14/600 chips, row links. */
  smallStrong: { size: 14, weight: '600', leading: 1.4 },
  /** 14/700 small button labels, inline links. */
  smallBold: { size: 14, weight: '700', leading: 1.3 },
  /** 13/400 helper text and captions. */
  caption: { size: 13, weight: '400', leading: 1.5 },
  /** 13/600 "Step 2 of 6", deadlines, column headers. */
  captionStrong: { size: 13, weight: '600', leading: 1.4 },
  /** 13/700 badge labels, small links, member status. */
  captionBold: { size: 13, weight: '700', leading: 1.3 },
  /** 13/800 accent badges ("Next drop"). */
  badge: { size: 13, weight: '800', leading: 1.3 },
  /** 13/700 uppercase section label inside a card ("WHAT YOU'VE AGREED TO"). */
  overline: { size: 13, weight: '700', tracking: 0.04, leading: 1.3, upper: true },
  /** 13/800 uppercase eyebrow on a dark card ("ODENSE WAITLIST"). */
  eyebrow: { size: 13, weight: '800', tracking: 0.06, leading: 1.3, upper: true },
  /** 12/800 uppercase eyebrow, compact ("NEXT STEP"). */
  eyebrowCompact: { size: 12, weight: '800', tracking: 0.06, leading: 1.3, upper: true },
  /** 12/400 fine print (feedback explainer, chat system note). */
  micro: { size: 12, weight: '400', leading: 1.45 },
  /** 12/600 tab label. */
  microStrong: { size: 12, weight: '600', leading: 1.3 },
  /** 12/700 chat author line, column headers. */
  microBold: { size: 12, weight: '700', leading: 1.3 },
  /** 12/800 active tab label, small badges ("Leading", "3 new"). */
  microHeavy: { size: 12, weight: '800', leading: 1.3 },
} as const satisfies Record<string, TypeSpec>;

export type TypeVariant = keyof typeof TypeScale;

/** The text style for a variant, optionally at another weight (family swapped, size and spacing kept). */
export function typeStyle(variant: TypeVariant, weight?: FontWeight): TextStyle {
  const spec: TypeSpec = TypeScale[variant];
  return {
    fontFamily: FontFamily[weight ?? spec.weight],
    fontSize: spec.size,
    lineHeight: Math.round(spec.size * (spec.leading ?? 1.26)),
    ...(spec.tracking ? { letterSpacing: Math.round(spec.size * spec.tracking * 100) / 100 } : {}),
    ...(spec.upper ? { textTransform: 'uppercase' as const } : {}),
  };
}

/** Ready-made text styles for every variant: `style={[Type.heading, { color: p.text }]}`. */
export const Type = Object.fromEntries(Object.keys(TypeScale).map((v) => [v, typeStyle(v as TypeVariant)])) as Readonly<
  Record<TypeVariant, TextStyle>
>;
