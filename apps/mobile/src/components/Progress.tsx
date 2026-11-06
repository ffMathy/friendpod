/**
 * Progress bars: the 6 px onboarding bar, the 10 px waitlist bar on the dark card, and the segmented
 * "3 of 5 said yes" bar.
 */
import { StyleSheet, View } from 'react-native';
import { usePalette, type PaletteKey } from './theme';

export interface ProgressBarProps {
  /** 0 to 1. */
  readonly value: number;
  /** Bar height: 6 (default, onboarding) or 10 (waitlist). Radius is half the height. */
  readonly height?: number;
  /** Fill colour (default primary; the waitlist uses accent). */
  readonly color?: PaletteKey;
  /** Track colour (default border; on the dark hero card use heroTrack). */
  readonly trackColor?: PaletteKey;
  /** Hidden from screen readers when nearby text already says the progress ("Step 2 of 6"). */
  readonly decorative?: boolean;
  /** Read with the value, e.g. "People on the Odense waitlist". */
  readonly accessibilityLabel?: string;
  /** For screen readers: the counted value and its maximum (default: percent). */
  readonly accessibilityValue?: { min: number; max: number; now: number };
  readonly testID?: string;
}

export function ProgressBar({ value, height = 6, color = 'primary', trackColor = 'border', decorative = false, accessibilityLabel, accessibilityValue, testID }: ProgressBarProps) {
  const p = usePalette();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const a11y = decorative
    ? { accessible: false, importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true }
    : {
        accessible: true,
        accessibilityRole: 'progressbar' as const,
        accessibilityLabel,
        accessibilityValue: accessibilityValue ?? { min: 0, max: 100, now: Math.round(clamped * 100) },
      };
  return (
    <View testID={testID} {...a11y} style={[styles.track, { height, borderRadius: height / 2, backgroundColor: p[trackColor] }]}>
      <View style={{ width: `${clamped * 100}%`, height, backgroundColor: p[color] }} />
    </View>
  );
}

/** One bar per seat, the first `filled` in primary ("3 of 5 said yes"). Decorative: pair it with text. */
export function ProgressSegments({ total, filled, height = 10 }: { total: number; filled: number; height?: number }) {
  const p = usePalette();
  return (
    <View style={styles.segments} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <View key={i} style={[styles.segment, { height, borderRadius: height / 2, backgroundColor: i < filled ? p.primary : p.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', alignSelf: 'stretch' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1 },
});
