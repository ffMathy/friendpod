/**
 * The mark: people around a sun (blend spec §7). The centre is the thing you share; around it five people; one of
 * them, outlined, is the seat saved for you (dashed when open, solid when taken).
 *
 * - `PodMark variant="dots"`: the dot mark (logo, app UI below 56 px). On light grounds the Solsikke sun gets a
 *   Solsikke-deep ring (1.5–2 px rendered); below 24 px the sun is filled Solsikke deep instead (decision 6).
 * - `PodMark variant="badge"`: the 48 px pod badge in a pod band or the proposal/waiting band: sun in the pod's base
 *   with a deep ring, people in the pod's deep, you as an Ink ring. `color="private"`: all Ink, a lock for the sun.
 * - `PodMark variant="poster"`: the figure mark on the three poster fields (welcome, the drop, the reveal) and the
 *   app icon. Never cropped; it sits fully inside its field.
 * - `Logo`: the welcome lockup, dot mark + lowercase "grouper" in Bricolage 800. No logo on other app screens.
 *
 * All marks are decorative (hidden from screen readers) except `Logo`, which reads as "Grouper".
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import type { PodColor } from '@/lib/podColor';
import { Colors, POD_PALETTE, podColors, SUN, typeStyle, useColorSchemeName, type ColorScheme } from './theme';

const PAPER = '#F6F3EC';
const INK = '#18211D';

/** Dot mark geometry on a 40 × 40 grid: the sun, four people and your (outlined) seat. */
const DOTS = {
  sun: { cx: 20, cy: 20, r: 6.6 },
  people: [
    { cx: 20, cy: 6.4, r: 4.1 },
    { cx: 28, cy: 31, r: 4.1 },
    { cx: 12, cy: 31, r: 4.1 },
    { cx: 7.1, cy: 15.8, r: 4.1 },
  ],
  you: { cx: 32.9, cy: 15.8, r: 3.25, stroke: 1.7 },
} as const;

/** Poster mark geometry on a 120 × 112 grid: a person is a head and a shoulder arch. */
const POSTER = {
  sun: { cx: 60, cy: 60, r: 23 },
  people: [
    [60, 18],
    [84.7, 94],
    [35.3, 94],
    [20.1, 47],
  ],
  you: [99.9, 47],
} as const;
const HEAD = { cx: 0, cy: -9, r: 8 };
const SHOULDERS = 'M-12.5 17V14A12.5 12.5 0 0 1 12.5 14V17Z';
const SHOULDERS_OPEN = 'M-12.5 17V14A12.5 12.5 0 0 1 12.5 14V17';

/** The poster mark's colours on each ground (spec §7.2 table). */
function posterColors(ground: PodMarkGround, color: PodColor | 'private' | null | undefined, scheme: ColorScheme) {
  // Private reveal (a white card; the dark card in dark mode): everything in the text colour, the sun only a ring.
  if (color === 'private') {
    const ink = Colors[scheme].text;
    return { people: ink, sun: 'transparent', sunRing: ink, you: ink };
  }
  if (ground === 'field' && color && scheme === 'light') {
    switch (color) {
      case 'tomat':
      case 'baer':
        return { people: INK, sun: SUN.base, sunRing: undefined, you: INK };
      case 'blad':
        return { people: INK, sun: '#FFFFFF', sunRing: undefined, you: INK };
      case 'solsikke':
        return { people: INK, sun: POD_PALETTE.tomat.base, sunRing: undefined, you: INK };
      default:
        return { people: PAPER, sun: SUN.base, sunRing: undefined, you: PAPER };
    }
  }
  if (ground === 'light' && scheme === 'light') return { people: Colors.light.house, sun: SUN.base, sunRing: SUN.deep, you: Colors.light.house };
  // Skov (house), Night, and pod fields in dark mode (deep tones): Paper people, Solsikke sun.
  return { people: PAPER, sun: SUN.base, sunRing: undefined, you: PAPER };
}

export type PodMarkGround =
  /** Paper, white or a tint: the sun gets its Solsikke-deep ring (or deep fill below 24 px). */
  | 'light'
  /** The Skov house field (welcome, the drop, the app icon). */
  | 'skov'
  /** A pod's base field (the reveal); needs `color`. In dark mode the field is the deep tone. */
  | 'field'
  /** Night or any dark ground. */
  | 'dark';

export interface PodMarkProps {
  /** Rendered width in px. Dots: 20–48 (default 36). Badge: 48. Poster: 128 (drop), 176 (reveal), 220 (welcome). */
  readonly size?: number;
  /** Default `dots`. */
  readonly variant?: 'dots' | 'badge' | 'poster';
  /** The pod colour (badge, reveal), or `private` (all Ink, a lock or an Ink ring for the sun). */
  readonly color?: PodColor | 'private' | null;
  /** What the mark stands on (default `light`; in dark mode `light` is drawn as `dark`). */
  readonly ground?: PodMarkGround;
  /** Your figure on the poster mark: `saved` (dashed, an open seat) or `taken` (solid: the reveal, the app icon). */
  readonly seat?: 'saved' | 'taken';
}

export function PodMark({ size, variant = 'dots', color, ground = 'light', seat = 'saved' }: PodMarkProps) {
  const scheme = useColorSchemeName();
  const hidden = { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true };

  if (variant === 'poster') {
    const w = size ?? 128;
    const c = posterColors(ground, color, scheme);
    const ringWidth = (1.75 * 120) / w;
    const [yx, yy] = POSTER.you;
    return (
      <Svg width={w} height={(w * 112) / 120} viewBox="0 0 120 112" {...hidden}>
        <Circle
          {...POSTER.sun}
          r={color === 'private' ? POSTER.sun.r - 1.2 : POSTER.sun.r}
          fill={c.sun}
          stroke={c.sunRing ?? 'none'}
          strokeWidth={color === 'private' ? 2.4 : c.sunRing ? ringWidth : 0}
        />
        <G fill={c.people}>
          {POSTER.people.map(([x, y]) => (
            <G key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <Circle {...HEAD} />
              <Path d={SHOULDERS} />
            </G>
          ))}
        </G>
        <G transform={`translate(${yx} ${yy})`} fill="none" stroke={c.you} strokeLinecap="round" strokeWidth={seat === 'taken' ? 3 : 2.4} strokeDasharray={seat === 'taken' ? undefined : '4 3.2'}>
          <Circle {...HEAD} />
          <Path d={SHOULDERS_OPEN} />
        </G>
      </Svg>
    );
  }

  if (variant === 'badge') {
    const w = size ?? 48;
    const pc = podColors(color === 'private' ? null : color, scheme);
    const you = Colors[scheme].text;
    return (
      <Svg width={w} height={w} viewBox="0 0 40 40" {...hidden}>
        {color === 'private' || !color ? (
          <G transform="translate(12.8 12.5) scale(0.6)" fill="none" stroke={pc.markPeople} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Rect x={5} y={11} width={14} height={10} rx={2} />
            <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </G>
        ) : (
          <Circle {...DOTS.sun} fill={pc.markSun} stroke={pc.markSunRing} strokeWidth={1.4} />
        )}
        {DOTS.people.map((d) => (
          <Circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={d.r} fill={pc.markPeople} />
        ))}
        <Circle cx={DOTS.you.cx} cy={DOTS.you.cy} r={DOTS.you.r} fill="none" stroke={you} strokeWidth={DOTS.you.stroke} />
      </Svg>
    );
  }

  // Dot mark.
  const w = size ?? 36;
  const onLight = ground === 'light' && scheme === 'light';
  const people = color === 'private' ? Colors[scheme].text : onLight ? Colors.light.house : PAPER;
  const small = w < 24;
  const sunFill = onLight && small ? SUN.deep : SUN.base;
  const sunRing = onLight && !small ? SUN.deep : undefined;
  return (
    <Svg width={w} height={w} viewBox="0 0 40 40" {...hidden}>
      <Circle {...DOTS.sun} fill={sunFill} stroke={sunRing ?? 'none'} strokeWidth={sunRing ? (1.75 * 40) / w : 0} />
      {DOTS.people.map((d) => (
        <Circle key={`${d.cx}-${d.cy}`} cx={d.cx} cy={d.cy} r={d.r} fill={people} />
      ))}
      <Circle cx={DOTS.you.cx} cy={DOTS.you.cy} r={DOTS.you.r} fill="none" stroke={people} strokeWidth={DOTS.you.stroke} />
    </Svg>
  );
}

const SIZES = {
  /** 24 px mark, 20 px wordmark. */
  sm: { mark: 24, text: 20, gap: 6 },
  /** The welcome lockup: 36 px mark, gap 8, "grouper" 29/800, −3.5%. */
  md: { mark: 36, text: 29, gap: 8 },
  /** 56 px mark, 44 px wordmark. */
  lg: { mark: 56, text: 44, gap: 12 },
} as const;

export interface LogoProps {
  readonly size?: keyof typeof SIZES;
  /** Show the "grouper" wordmark next to the mark (default true). */
  readonly wordmark?: boolean;
  /** `light` (Paper/white: Skov people, ringed sun, Ink wordmark) or `skov` (on the house field: Paper people, white wordmark). */
  readonly ground?: 'light' | 'skov';
  /** Overrides the wordmark colour. */
  readonly textColor?: string;
}

/** The lockup. The brand name is not translated; read by screen readers as one image named "Grouper". */
export function Logo({ size = 'md', wordmark = true, ground = 'light', textColor }: LogoProps) {
  const scheme = useColorSchemeName();
  const s = SIZES[size];
  const onSkov = ground === 'skov';
  const color = textColor ?? (onSkov ? '#FFFFFF' : Colors[scheme].text);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Grouper" style={[styles.row, { gap: s.gap }]}>
      <PodMark size={s.mark} ground={onSkov ? 'skov' : 'light'} />
      {wordmark ? (
        <Text style={[typeStyle('wordmark'), styles.wordmark, { fontSize: s.text, lineHeight: s.text, letterSpacing: -0.035 * s.text, color }]}>grouper</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  wordmark: { paddingBottom: 3 },
});
