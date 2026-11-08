/**
 * Design tokens for direction E "Blend" (blend-spec.md; storyboards are 390 × 844 CSS px, and React Native layout
 * units equal CSS px at that width, so every number here is the spec's own).
 *
 * One line: a pod colour for every group, a poster for every ritual, a seat saved for you.
 *
 * - **Chrome** (identical in every pod): warm Paper ground, white cards, Ink text, and Skov green for everything you
 *   tap. Small text never sits on a mid-tone colour field.
 * - **Six pod colours** (`POD_PALETTE`): Solsikke, Blad, Bær, Tomat, Fjord, Blomme, each with base / deep / tint.
 *   Which one a pod gets comes from its concept id (`@/lib/podColor`); `usePodColors(color)` gives the roles.
 * - **Dark mode** (decision 10): Paper → Night, Skov light for actions, pod fields and tints go deep with white type,
 *   dots and seats get a tint ring.
 *
 * Typography: Bricolage Grotesque shouts (display, screen titles, pod names), Plus Jakarta Sans reads (everything
 * else). One font family per weight (React Native needs that for custom fonts): never set `fontWeight` in a style;
 * use `font(weight)`, `fontDisplay(weight)` or a `Type` variant, which map the weight to its family.
 */
import { useColorScheme, type TextStyle } from 'react-native';
import { POD_COLORS, type PodColor } from '@/lib/podColor';

export { POD_COLORS, type PodColor };

// ---------------------------------------------------------------------------------------------------------------
// Colour: chrome
// ---------------------------------------------------------------------------------------------------------------

const light = {
  /** Paper: the page ground of every screen. */
  page: '#F6F3EC',
  /** White: cards, inputs, sheets, the tab bar, foot panels, private chips, pills on fields. */
  surface: '#FFFFFF',
  /** A note inside a white card (Paper fill, no border). Same as the page in light mode. */
  inset: '#F6F3EC',

  /** Ink: headings and text. */
  text: '#18211D',
  /** Ink 2: secondary text, text on tints, quiet links, neutral icons, "Hasn't confirmed". */
  textSecondary: '#3A423D',
  /** Muted: meta, counts, eyebrows, placeholders, inactive tab. Never on a tint (use textSecondary there). */
  textMuted: '#4A514C',

  /** Line: card borders (decorative). */
  border: '#E4DFD4',
  /** Divider: rows inside a card. */
  separator: '#EEEAE2',
  /** Outline: the 1.5 px border of secondary buttons, suggestion chips, plain-clash chips, the sheet handle. */
  borderStrong: '#C9C3B6',
  /** Field: input borders, open (dashed) seats, unsettled chips, unchecked boxes. Non-text, >= 3:1. */
  field: '#8A857A',
  /** Track: empty progress segments, the off switch. */
  track: '#DDD8CD',

  /** Skov: everything you tap (primary buttons, Add, progress, switches/checkbox/radio "on"). */
  primary: '#1B6452',
  /** Skov deep: pressed primary. */
  primaryPressed: '#174F42',
  /** White on Skov (7.0:1). */
  onPrimary: '#FFFFFF',
  /** Skov deep: links, focused input border. */
  link: '#174F42',
  /** Active tab label and icon. */
  tabActive: '#174F42',
  /** Skov tint: the active tab pill only. */
  tabActiveBg: '#E1EFE9',
  tabInactive: '#4A514C',

  /** The house poster field (welcome, the Thursday drop) and the app icon: Skov in both modes. */
  house: '#1B6452',
  /** Display type and pills' text on the house field. */
  onHouse: '#FFFFFF',

  /** Ink fill: status pills, You, unread badge, selected segment/choice, the Apple button. */
  ink: '#18211D',
  onInk: '#FFFFFF',

  /** Needs you (your own deadline): Solsikke pill/marker, always with a 1.5 px Ink border. */
  needsYou: '#FFD84D',
  onNeedsYou: '#18211D',
  needsYouBorder: '#18211D',

  /** Danger: text, icon and 1.5 px border of destructive outline buttons and the safety alert. Never a fill. */
  danger: '#C41E3A',
  /** Pressed destructive outline button. */
  dangerPressedBg: '#F6F3EC',

  /** Private stays quiet: white fill, 1.5 px Ink border, Ink lock and word. */
  privateBg: '#FFFFFF',
  privateBorder: '#18211D',
  privateText: '#18211D',
  /** Avatars and lit seats in a private pod (Ink 2, white initial). */
  privateFill: '#3A423D',

  /** Behind a bottom sheet. */
  scrim: 'rgba(24, 33, 29, 0.5)',
  /** Disabled buttons. */
  disabledBg: '#DDD8CD',
  disabledText: '#4A514C',
  /** The round knob of a switch. */
  switchThumb: '#FFFFFF',
};

export type PaletteKey = keyof typeof light;
export type Palette = { readonly [K in PaletteKey]: string };

const dark: Palette = {
  page: '#131916',
  surface: '#1D2521',
  inset: '#131916',

  text: '#F2EFE8',
  textSecondary: '#C9CFCB',
  textMuted: '#AEB5B0',

  border: '#2E3833',
  separator: '#262E2A',
  borderStrong: '#56625C',
  field: '#858C87',
  track: '#2E3833',

  primary: '#7FCDB0',
  primaryPressed: '#A3DCC6',
  onPrimary: '#18211D',
  link: '#7FCDB0',
  tabActive: '#7FCDB0',
  tabActiveBg: '#1F3B33',
  tabInactive: '#AEB5B0',

  house: '#1B6452',
  onHouse: '#FFFFFF',

  ink: '#F2EFE8',
  onInk: '#18211D',

  needsYou: '#FFD84D',
  onNeedsYou: '#18211D',
  needsYouBorder: '#18211D',

  danger: '#F69B96',
  dangerPressedBg: '#131916',

  privateBg: '#1D2521',
  privateBorder: '#F2EFE8',
  privateText: '#F2EFE8',
  privateFill: '#C9CFCB',

  scrim: 'rgba(0, 0, 0, 0.6)',
  disabledBg: '#2E3833',
  disabledText: '#AEB5B0',
  switchThumb: '#F2EFE8',
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

// ---------------------------------------------------------------------------------------------------------------
// Colour: the six pod colours
// ---------------------------------------------------------------------------------------------------------------

export interface PodSwatch {
  /** Danish and English names ("seks podfarver"). */
  readonly da: string;
  readonly en: string;
  /** Fields (the reveal), lit seats, dot fill, the sun. Text on it: display type only, in `onBase`. */
  readonly base: string;
  /** Avatars, dot/seat rings, icons, the pod name on its tint (>= 7.3:1). White text on it. */
  readonly deep: string;
  /** Chips, bands, card tops, the chat disc, your chat bubble. Ink or Ink 2 text only. */
  readonly tint: string;
  /** Display type on the base field: Ink on Solsikke/Blad/Bær/Tomat, white on Fjord/Blomme. */
  readonly onBase: string;
  /** The 1 px border every tint surface carries (base at 40%), so Tomat and Bær tints never rely on tint alone. */
  readonly tintBorder: string;
}

/** Index order = colour index (see `@/lib/podColor`). Light-mode values; `podColors()` derives dark. */
export const POD_PALETTE: { readonly [K in PodColor]: PodSwatch } = {
  solsikke: { da: 'Solsikke', en: 'Sunflower', base: '#FFD84D', deep: '#6A4900', tint: '#FFF1C2', onBase: '#18211D', tintBorder: 'rgba(255, 216, 77, 0.4)' },
  blad: { da: 'Blad', en: 'Leaf', base: '#9FD05E', deep: '#395500', tint: '#E6F3D4', onBase: '#18211D', tintBorder: 'rgba(159, 208, 94, 0.4)' },
  baer: { da: 'Bær', en: 'Berry', base: '#F48AB3', deep: '#90124D', tint: '#FDE2EC', onBase: '#18211D', tintBorder: 'rgba(244, 138, 179, 0.4)' },
  tomat: { da: 'Tomat', en: 'Tomato', base: '#F26A4B', deep: '#8C2107', tint: '#FDE2D9', onBase: '#18211D', tintBorder: 'rgba(242, 106, 75, 0.4)' },
  fjord: { da: 'Fjord', en: 'Fjord', base: '#2F6FD6', deep: '#124593', tint: '#DDE7FB', onBase: '#FFFFFF', tintBorder: 'rgba(47, 111, 214, 0.4)' },
  blomme: { da: 'Blomme', en: 'Plum', base: '#6C3399', deep: '#4F2272', tint: '#EDE1F6', onBase: '#FFFFFF', tintBorder: 'rgba(108, 51, 153, 0.4)' },
};

/**
 * The roles a pod colour plays, resolved for light or dark mode. `null` (a private pod or interest) gives the quiet
 * set: no colour anywhere, Ink/white with a lock.
 */
export interface PodColors {
  /** The colour, or null for private. */
  readonly color: PodColor | null;
  /** The reveal field (light: base; dark: deep). Private: none (the private reveal is a white card). */
  readonly field: string;
  /** Display type on the field. */
  readonly onField: string;
  /** Tint surfaces: chips, bands, card tops, the chat disc, your chat bubble (dark: deep). */
  readonly surface: string;
  /** The 1 px border of a tint surface (light: base @ 40%; dark: base). Private: the 1.5 px Ink border colour. */
  readonly surfaceBorder: string;
  /** Text on the tint surface (light: Ink; dark: white). */
  readonly onSurface: string;
  /** Secondary text on the tint surface (light: Ink 2; dark: white). */
  readonly onSurfaceMuted: string;
  /** The pod name on its band (light: deep; dark: tint). Private: text. */
  readonly name: string;
  /** Leading icons of facts and rows inside the pod (light: deep; dark: tint). Private: Ink 2. */
  readonly icon: string;
  /** Dot and lit-seat fill (base). Private: privateFill. */
  readonly dot: string;
  /** Dot and lit-seat ring (light: deep; dark: tint). Private: none (same as the dot). */
  readonly dotRing: string;
  /** Named member avatar fill (deep) and its initial (white). Private: Ink 2 / white (dark: light grey / Ink). */
  readonly avatar: string;
  readonly onAvatar: string;
  /** Dark mode: the 2 px tint ring around a named avatar; light: transparent. */
  readonly avatarRing: string;
  /** "Not confirmed" avatar: fill, dashed border, initial. */
  readonly pendingBg: string;
  readonly pendingBorder: string;
  readonly pendingText: string;
  /** The pod badge (PodMark): people, sun, sun ring. */
  readonly markPeople: string;
  readonly markSun: string;
  readonly markSunRing: string;
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The pod colour roles for a colour (or `null`, private) in a scheme. */
export function podColors(color: PodColor | null | undefined, scheme: ColorScheme): PodColors {
  const p = Colors[scheme];
  if (color === null || color === undefined) {
    return {
      color: null,
      field: p.surface,
      onField: p.text,
      surface: p.privateBg,
      surfaceBorder: p.privateBorder,
      onSurface: p.text,
      onSurfaceMuted: p.textSecondary,
      name: p.text,
      icon: p.textSecondary,
      dot: p.privateFill,
      dotRing: p.privateFill,
      avatar: p.privateFill,
      onAvatar: scheme === 'dark' ? '#18211D' : '#FFFFFF',
      avatarRing: 'transparent',
      pendingBg: p.surface,
      pendingBorder: p.field,
      pendingText: p.text,
      markPeople: p.text,
      markSun: 'transparent',
      markSunRing: p.text,
    };
  }
  const s = POD_PALETTE[color];
  if (scheme === 'dark') {
    return {
      color,
      field: s.deep,
      onField: '#FFFFFF',
      surface: s.deep,
      surfaceBorder: s.base,
      onSurface: '#FFFFFF',
      onSurfaceMuted: '#FFFFFF',
      name: s.tint,
      icon: s.tint,
      dot: s.base,
      dotRing: s.tint,
      avatar: s.deep,
      onAvatar: '#FFFFFF',
      avatarRing: s.tint,
      pendingBg: p.page,
      pendingBorder: s.tint,
      pendingText: p.text,
      markPeople: s.tint,
      markSun: s.base,
      markSunRing: s.tint,
    };
  }
  return {
    color,
    field: s.base,
    onField: s.onBase,
    surface: s.tint,
    surfaceBorder: rgba(s.base, 0.4),
    onSurface: p.text,
    onSurfaceMuted: p.textSecondary,
    name: s.deep,
    icon: s.deep,
    dot: s.base,
    dotRing: s.deep,
    avatar: s.deep,
    onAvatar: '#FFFFFF',
    avatarRing: 'transparent',
    pendingBg: s.tint,
    pendingBorder: s.deep,
    pendingText: p.text,
    markPeople: s.deep,
    markSun: s.base,
    markSunRing: s.deep,
  };
}

/** `podColors()` for the system appearance: `const c = usePodColors(podColorFor({ conceptId }))`. */
export function usePodColors(color: PodColor | null | undefined): PodColors {
  return podColors(color, useColorSchemeName());
}

/** Solsikke base and deep: the sun of the mark (deep is its ring on light grounds, decision 6). */
export const SUN = { base: '#FFD84D', deep: '#6A4900' } as const;

// ---------------------------------------------------------------------------------------------------------------
// Space, radius, borders, sizes
// ---------------------------------------------------------------------------------------------------------------

/** The spacing steps (gaps and paddings), keyed by their pixel value. */
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
  /** Side padding of the welcome, onboarding, sign-in and form screens. */
  gutter: 24,
  /** Side padding of tab screens and pod screens. */
  gutterCompact: 20,
  /** Gap between a screen's blocks. */
  gap: 16,
  /** Gap between blocks on onboarding steps. */
  gapLoose: 24,
  /** Bottom padding under the pinned action area (also the minimum safe-area inset). */
  bottom: 32,
  /** Top padding of a tab screen's content (the title starts here). */
  tabTop: 40,
  /** Padding inside a standard card. */
  cardPadding: 16,
  /** Side padding inside hero cards (proposal, waiting) and their tint band. */
  heroPadding: 20,
  /** How far the foot panel overlaps the bottom of a poster field. */
  footOverlap: 28,
} as const;

export const Radius = {
  /** Thin tracks (age slider). */
  track: 2,
  /** Progress segments: half their height. */
  bar: 3,
  /** Availability grid cells, chat system note. */
  sm: 10,
  /** Inputs, the Add button, notes inside cards, tiles. */
  md: 14,
  /** Notes, info cards, option cards. */
  lg: 16,
  /** Member action rows, places list. */
  xl: 18,
  /** Cards and foot panels. */
  card: 22,
  /** Plan option / plan / chat cards (same as card). */
  cardLg: 22,
  /** Hero cards (proposal, waiting), the pod band's bottom corners, sheets' top corners. */
  hero: 28,
  /** Same as hero (kept name). */
  panel: 28,
  /** Pills: buttons, chips, badges, avatars. */
  pill: 999,
} as const;

export const BorderWidth = {
  /** Card borders, Divider rows, tint borders. */
  hairline: 1,
  /** Inputs, secondary buttons, chips, the private ring, needs-you pill. */
  control: 1.5,
  /** Selected option card, focused input, dashed seats, avatar rings. */
  strong: 2,
} as const;

export const Size = {
  /** Minimum touch target (DESIGN accessibility rule). */
  hitTarget: 44,
  /** Full-width primary/secondary button (screen CTA). */
  button: 54,
  /** Button in a card. */
  buttonMedium: 48,
  /** Small button (half-width pairs, in rows). */
  buttonCompact: 44,
  /** Inline small pill; gets hitSlop up to 44. Prefer 44. */
  buttonSmall: 40,
  /** Standalone text input. */
  input: 54,
  /** The input + Add pair, search field, date and time inputs. */
  inputCompact: 52,
  /** Removable chip and suggestion chip (visual; the target is 44). */
  chip: 36,
  /** Display chip (pod, private, unsettled, clash). */
  tag: 32,
  /** Status pill, pill on a field. */
  badge: 28,
  /** Needs-you pill (incl. its 1.5 px border). */
  badgeNeedsYou: 30,
  /** Unread badge ("3 new"). */
  badgeSmall: 24,
  /** Onboarding progress segments. */
  progress: 6,
  /** Seats on proposal/waiting. */
  seat: 44,
  /** The pod badge in bands. */
  podBadge: 48,
  /** Pod dot in chips and rows. */
  dot: 10,
  /** Tab bar height without the bottom safe-area inset. */
  tabBar: 64,
  icon: 24,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------------------------------------------

export type FontWeight = '400' | '500' | '600' | '700' | '800';
/** Bricolage Grotesque ships 700 and 800 in the app. */
export type DisplayWeight = '700' | '800';

/** Plus Jakarta Sans, one family per weight; the names are the keys `useFonts` registers (see `fonts.ts`). */
export const FontFamily: Readonly<Record<FontWeight, string>> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
};

/** Bricolage Grotesque (static opsz 14 cut), one family per weight. */
export const DisplayFontFamily: Readonly<Record<DisplayWeight, string>> = {
  '700': 'BricolageGrotesque_700Bold',
  '800': 'BricolageGrotesque_800ExtraBold',
};

/** The style for a Plus Jakarta Sans weight: its family, never `fontWeight`. */
export function font(weight: FontWeight = '400'): { fontFamily: string } {
  return { fontFamily: FontFamily[weight] };
}

/** The style for a Bricolage Grotesque weight (display type): its family, never `fontWeight`. */
export function fontDisplay(weight: DisplayWeight = '800'): { fontFamily: string } {
  return { fontFamily: DisplayFontFamily[weight] };
}

interface TypeSpec {
  readonly size: number;
  /** Line height in px (from the spec's table). */
  readonly line: number;
  readonly weight: FontWeight;
  /** Bricolage Grotesque (display) instead of Plus Jakarta Sans. Display specs use weight 700 or 800. */
  readonly display?: boolean;
  /** letter-spacing in em, as in the spec (converted to px). */
  readonly tracking?: number;
  readonly upper?: boolean;
}

/**
 * Every type role. Display roles (Bricolage): displayXL, displayL, title*, headline*, podName, wordmark and the older
 * names mapped onto them (counter, theme, themeCompact, display, countdown). Everything else is Plus Jakarta Sans.
 */
export const TypeScale = {
  // Display: Bricolage Grotesque ------------------------------------------------------------------------------
  /** Display XL 56/58/800, −3.5%: the pod name on the reveal field. Fit steps: displayXL52, displayXL48, displayXL40. */
  displayXL: { size: 56, line: 58, weight: '800', display: true, tracking: -0.035 },
  displayXL52: { size: 52, line: 54, weight: '800', display: true, tracking: -0.035 },
  /** "Thursday 18:00" on the drop field. */
  displayXL48: { size: 48, line: 50, weight: '800', display: true, tracking: -0.035 },
  displayXL40: { size: 40, line: 42, weight: '800', display: true, tracking: -0.035 },
  /** Display L 44/46/800, −3.5%: the welcome headline; the pod name in the proposal/waiting band. */
  displayL: { size: 44, line: 46, weight: '800', display: true, tracking: -0.035 },
  /** Title 30/32/800, −2%: screen titles; the pod name in the pod band. */
  title: { size: 30, line: 32, weight: '800', display: true, tracking: -0.02 },
  /** 28/30 title for long screen titles (consent). */
  titleCompact: { size: 28, line: 30, weight: '800', display: true, tracking: -0.02 },
  /** 26/28 title of a full-screen form with a close button, and of full-screen sheets. */
  titleModal: { size: 26, line: 28, weight: '800', display: true, tracking: -0.02 },
  /** Headline 22/26/700, −1.5%: field sublines ("Next drop"), card questions, sheet titles, "3 of 5 said yes". */
  headline: { size: 22, line: 26, weight: '700', display: true, tracking: -0.015 },
  /** Same as headline (kept name: the question on a card). */
  headlineCompact: { size: 22, line: 26, weight: '700', display: true, tracking: -0.015 },
  /** Pod name in rows and cards 18/22/800. */
  podName: { size: 18, line: 22, weight: '800', display: true, tracking: -0.015 },
  /** The lowercase "grouper" next to the dot mark (welcome). */
  wordmark: { size: 29, line: 29, weight: '800', display: true, tracking: -0.035 },
  /** Kept names, mapped to display roles: counter and theme = Display L; themeCompact = Display XL 40; display =
   * Display L (welcome headline); countdown = Display XL 48 ("Thursday 18:00"). */
  counter: { size: 44, line: 46, weight: '800', display: true, tracking: -0.035 },
  theme: { size: 44, line: 46, weight: '800', display: true, tracking: -0.035 },
  themeCompact: { size: 40, line: 42, weight: '800', display: true, tracking: -0.035 },
  display: { size: 44, line: 46, weight: '800', display: true, tracking: -0.035 },
  countdown: { size: 48, line: 50, weight: '800', display: true, tracking: -0.035 },

  // Reading and UI: Plus Jakarta Sans ---------------------------------------------------------------------------
  /** Card title 18/24/800: dates and times ("Saturday 15 Nov, 14:00"). */
  cardTitle: { size: 18, line: 24, weight: '800' },
  /** 20/26/800 a value on a card ("Aarhus C"). */
  stat: { size: 20, line: 26, weight: '800' },
  /** 17/22/800 numbers ("28–42"). */
  numeral: { size: 17, line: 22, weight: '800' },
  /** Body 16/24/400: paragraphs, row labels, standalone inputs. */
  body: { size: 16, line: 24, weight: '400' },
  /** Same as body: the paragraph under a title. */
  lede: { size: 16, line: 24, weight: '400' },
  /** Row label 16/24/600. */
  rowTitle: { size: 16, line: 24, weight: '600' },
  /** Text inputs 16/22. */
  input: { size: 16, line: 22, weight: '400' },
  /** Body S 15/22/400: fact lists, secondary paragraphs, the input + Add field. */
  bodySmall: { size: 15, line: 22, weight: '400' },
  /** Body S 700: section headings (h2), field labels. */
  heading: { size: 15, line: 22, weight: '700' },
  /** 15/22/600: member names, emphasised body. */
  bodyStrong: { size: 15, line: 22, weight: '600' },
  /** Button 16/20/700 (54 and 48 px buttons). */
  button: { size: 16, line: 20, weight: '700' },
  /** Button 15/20/700 (44 px buttons, standalone links). */
  buttonSmall: { size: 15, line: 20, weight: '700' },
  /** Small 14/20/400: card text. */
  small: { size: 14, line: 20, weight: '400' },
  /** Small 14/20/600: "A pod around", row links. */
  smallStrong: { size: 14, line: 20, weight: '600' },
  /** 14/18/700: buttons in tight rows, danger labels in cards. */
  smallBold: { size: 14, line: 18, weight: '700' },
  /** Chip 14/18/600 (32 px chips). */
  chip: { size: 14, line: 18, weight: '600' },
  /** Chip 15/20/600 (36 px removable chips). */
  chipLarge: { size: 15, line: 20, weight: '600' },
  /** 13/20/400: helper text, explanations (13/1.5). */
  caption: { size: 13, line: 20, weight: '400' },
  /** Label 13/18/600: meta, "Step 2 of 6", deadlines. */
  captionStrong: { size: 13, line: 18, weight: '600' },
  /** Label 13/18/700: pills, status ("Hasn't confirmed"), small links. */
  captionBold: { size: 13, line: 18, weight: '700' },
  /** Badge 12/16/800: unread "3 new", small status. */
  badge: { size: 12, line: 16, weight: '800' },
  /** Eyebrow 12/16/800, +6%, uppercase: NEXT STEP, PLAN, MEMBERS. */
  eyebrow: { size: 12, line: 16, weight: '800', tracking: 0.06, upper: true },
  /** Same as eyebrow (kept names). */
  eyebrowCompact: { size: 12, line: 16, weight: '800', tracking: 0.06, upper: true },
  overline: { size: 12, line: 16, weight: '800', tracking: 0.06, upper: true },
  /** Fine print 12/16/400 ("Consent given 4 Nov 2026"). */
  micro: { size: 12, line: 16, weight: '400' },
  /** Tab label 12/16/600 (inactive). */
  microStrong: { size: 12, line: 16, weight: '600' },
  /** 12/16/700: chat author/time. */
  microBold: { size: 12, line: 16, weight: '700' },
  /** Tab label 12/16/800 (active). */
  microHeavy: { size: 12, line: 16, weight: '800' },
} as const satisfies Record<string, TypeSpec>;

export type TypeVariant = keyof typeof TypeScale;

/** The family for a type spec at a weight: Bricolage for display roles at 700/800, else Plus Jakarta Sans. */
function familyFor(spec: TypeSpec, weight: FontWeight): string {
  if (spec.display && (weight === '700' || weight === '800')) return DisplayFontFamily[weight];
  return FontFamily[weight];
}

/** True for the Bricolage (display) roles. */
export function isDisplayVariant(variant: TypeVariant): boolean {
  return (TypeScale[variant] as TypeSpec).display === true;
}

/** The text style for a variant, optionally at another weight (family swapped, size and spacing kept). */
export function typeStyle(variant: TypeVariant, weight?: FontWeight): TextStyle {
  const spec: TypeSpec = TypeScale[variant];
  return {
    fontFamily: familyFor(spec, weight ?? spec.weight),
    fontSize: spec.size,
    lineHeight: spec.line,
    ...(spec.tracking ? { letterSpacing: Math.round(spec.size * spec.tracking * 100) / 100 } : {}),
    ...(spec.upper ? { textTransform: 'uppercase' as const } : {}),
    ...(spec.display ? { includeFontPadding: false } : {}),
  };
}

/** Ready-made text styles for every variant: `style={[Type.heading, { color: p.text }]}`. */
export const Type = Object.fromEntries(Object.keys(TypeScale).map((v) => [v, typeStyle(v as TypeVariant)])) as Readonly<
  Record<TypeVariant, TextStyle>
>;

/**
 * Advance widths of Bricolage Grotesque 800 (the app's static opsz 14 cut) in thousandths of an em, letter-spacing
 * −3.5% included, measured in a browser from the font file (e.g. "Thursday brætspil" at 52 px = 444 px, as the spec
 * measured). Characters not listed count as 0.62 em.
 */
const DISPLAY_ADVANCE: Readonly<Record<string, number>> = {
  a: 560, b: 613, c: 536, d: 614, e: 552, f: 373, g: 572, h: 608, i: 251, j: 253, k: 570, l: 248, m: 928, n: 608, o: 577,
  p: 613, q: 614, r: 411, s: 514, t: 371, u: 599, v: 550, w: 846, x: 552, y: 573, z: 502, æ: 902, ø: 577, å: 560, é: 552,
  ü: 599, ö: 577, ä: 560, A: 677, B: 657, C: 650, D: 670, E: 597, F: 566, G: 694, H: 695, I: 268, J: 347, K: 662, L: 474,
  M: 920, N: 755, O: 690, P: 619, Q: 691, R: 653, S: 623, T: 544, U: 698, V: 647, W: 966, X: 684, Y: 627, Z: 541, Æ: 937,
  Ø: 701, Å: 677, '0': 635, '1': 325, '2': 578, '3': 576, '4': 603, '5': 580, '6': 627, '7': 482, '8': 626, '9': 623,
  ':': 227, '-': 324, '–': 510, '.': 217, ',': 177, ' ': 190,
};

/** The width in px of `text` set in Bricolage 800 at `size` px (display roles, −3.5% tracking). */
export function displayTextWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += DISPLAY_ADVANCE[ch] ?? 620;
  return (units / 1000) * size;
}

export type DisplayStep = 'displayXL' | 'displayXL52' | 'displayXL48' | 'displayXL40';

/**
 * The display fit rule (spec §4): the largest Display XL step (56 → 52 → 48 → 40) at which every word of `text` fits
 * in `width` and the text wraps (at spaces only) into at most `maxLines` lines. Never hyphenate: render the result
 * with `numberOfLines={maxLines}`. `fitDisplay('far på barsel', 342)` → 'displayXL'.
 */
export function fitDisplay(text: string, width: number, maxLines = 2): DisplayStep {
  const words = text.trim().split(/\s+/);
  const steps: readonly DisplayStep[] = ['displayXL', 'displayXL52', 'displayXL48', 'displayXL40'];
  for (const step of steps) {
    const size = TypeScale[step].size;
    if (words.some((w) => displayTextWidth(w, size) > width)) continue;
    let lines = 1;
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (displayTextWidth(next, size) > width) {
        lines += 1;
        line = w;
      } else line = next;
    }
    if (lines <= maxLines) return step;
  }
  return 'displayXL40';
}
