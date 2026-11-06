/**
 * Identity marks from the storyboards: the six-circle logo with the wordmark, and the welcome illustration.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { HeroColors, Radius, Type, tightLine, usePalette } from './theme';

/** The mark's circles in its 36×36 box: a centre dot (r5) and five satellites (r4, 55 % opacity). */
const MARK: readonly (readonly [cx: number, cy: number, r: number, opacity: number])[] = [
  [18, 18, 5, 1],
  [18, 5, 4, 0.55],
  [30.4, 14, 4, 0.55],
  [25.6, 28.5, 4, 0.55],
  [10.4, 28.5, 4, 0.55],
  [5.6, 14, 4, 0.55],
];

export interface LogoProps {
  /** Mark size in points (default 36); the wordmark scales with it (22 pt at 36). */
  readonly size?: number;
  /** Show "Grouper" next to the mark (default true). */
  readonly wordmark?: boolean;
  /** The product name, also the accessible name (default "Grouper"; it is not translated). */
  readonly name?: string;
  /** Mark colour; default the palette's primary green. */
  readonly color?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** Storyboard 1.1, top left: the six-circle mark and the 22/800 wordmark. */
export function Logo({ size = 36, wordmark = true, name = 'Grouper', color, style }: LogoProps) {
  const p = usePalette();
  const s = size / 36;
  const fill = color ?? p.primary;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={name} style={[styles.logo, { gap: 10 * s }, style]}>
      <View style={{ width: size, height: size }}>
        {MARK.map(([cx, cy, r, opacity], i) => (
          <View
            key={i}
            style={[
              styles.abs,
              { left: (cx - r) * s, top: (cy - r) * s, width: 2 * r * s, height: 2 * r * s, borderRadius: r * s, opacity, backgroundColor: fill },
            ]}
          />
        ))}
      </View>
      {wordmark ? (
        <Text style={[Type.title, { ...tightLine(22 * s, 28 * s), letterSpacing: -0.44 * s, color: p.ink }]}>{name}</Text>
      ) : null}
    </View>
  );
}

/** [left, top, diameter] on the storyboard's 342×220 panel; colours from `HeroColors`. */
const HERO: readonly (readonly [left: number, top: number, d: number])[] = [
  [56, 42, 72],
  [150, 24, 92],
  [260, 70, 64],
  [96, 128, 84],
  [204, 132, 70],
];
const HERO_W = 342;
const HERO_H = 220;

export interface HeroCirclesProps {
  /** Panel height (default 220); circles scale with it, and spread across the available width. */
  readonly height?: number;
  readonly style?: StyleProp<ViewStyle>;
}

/** Storyboard 1.1: overlapping filled circles (a pod of people) on a mint panel. Decorative, hidden from screen readers. */
export function HeroCircles({ height = HERO_H, style }: HeroCirclesProps) {
  const p = usePalette();
  const k = height / HERO_H;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.hero, { height, backgroundColor: p.mint }, style]}
    >
      {HERO.map(([left, top, d], i) => (
        <View
          key={i}
          style={[
            styles.abs,
            {
              left: `${(left / HERO_W) * 100}%`,
              top: top * k,
              width: d * k,
              height: d * k,
              borderRadius: (d * k) / 2,
              backgroundColor: HeroColors[i],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  logo: { flexDirection: 'row', alignItems: 'center' },
  hero: { borderRadius: Radius.heroLg, overflow: 'hidden', position: 'relative' },
});
