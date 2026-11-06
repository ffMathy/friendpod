/**
 * The Grouper mark: "pod dots" (a centre dot with five satellites, a pod forming around one thing) and the
 * wordmark. The geometry is the storyboard's 36 × 36 SVG; the app icon and splash are rendered from it
 * (assets/images/source/*.svg).
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { TypeScale, typeStyle, usePalette } from './theme';

/** Centre dot, then the five satellites (36 × 36 grid). */
export const POD_DOTS = [
  { cx: 18, cy: 18, r: 5, opacity: 1 },
  { cx: 18, cy: 5, r: 4, opacity: 0.55 },
  { cx: 30.4, cy: 14, r: 4, opacity: 0.55 },
  { cx: 25.6, cy: 28.5, r: 4, opacity: 0.55 },
  { cx: 10.4, cy: 28.5, r: 4, opacity: 0.55 },
  { cx: 5.6, cy: 14, r: 4, opacity: 0.55 },
] as const;

export function PodDots({ size = 36, color }: { size?: number; color?: string }) {
  const p = usePalette();
  const fill = color ?? p.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessible={false}>
      {POD_DOTS.map((d, i) => (
        <Circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={fill} opacity={d.opacity} />
      ))}
    </Svg>
  );
}

const SIZES = {
  /** 24 px mark, 16 px wordmark (compact headers). */
  sm: { mark: 24, text: 16, gap: 8 },
  /** The welcome screen: 36 px mark, 22/800 wordmark, 10 px apart. */
  md: { mark: 36, text: TypeScale.wordmark.size, gap: 10 },
  /** 64 px mark, 36 px wordmark (empty states, splash-like moments). */
  lg: { mark: 64, text: 36, gap: 16 },
} as const;

export interface LogoProps {
  readonly size?: keyof typeof SIZES;
  /** Show the "Grouper" wordmark next to the mark (default true). */
  readonly wordmark?: boolean;
  /** Mark colour (default primary); the wordmark uses `textColor` (default text). */
  readonly color?: string;
  readonly textColor?: string;
}

/** The brand name is not translated. Read by screen readers as one image named "Grouper". */
export function Logo({ size = 'md', wordmark = true, color, textColor }: LogoProps) {
  const p = usePalette();
  const s = SIZES[size];
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Grouper" style={[styles.row, { gap: s.gap }]}>
      <PodDots size={s.mark} color={color} />
      {wordmark ? (
        <Text
          style={[
            typeStyle('wordmark'),
            { fontSize: s.text, lineHeight: Math.round(s.text * 1.2), letterSpacing: -0.02 * s.text, color: textColor ?? p.text },
          ]}
        >
          Grouper
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
