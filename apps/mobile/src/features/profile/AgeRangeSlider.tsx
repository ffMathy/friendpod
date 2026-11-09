import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { BorderWidth, Radius, Size, usePalette } from '@/components/theme';

export interface AgeRangeSliderProps {
  readonly min: number;
  readonly max: number;
  readonly low: number;
  readonly high: number;
  /** The narrowest range allowed (the thumbs stop this far apart). */
  readonly minGap: number;
  readonly onChange: (low: number, high: number) => void;
  /** Read for each thumb ("Youngest age", "Oldest age"). */
  readonly lowLabel: string;
  readonly highLabel: string;
  readonly testID?: string;
}

type Thumb = 'low' | 'high';

const THUMB = 28;
const TRACK = 4;

type Point = readonly [age: number, fraction: number];

/**
 * Where ages sit on the track: [age, fraction of the track]. Most pods are in the twenties to forties, so the scale is
 * piecewise linear rather than even over 18–99: 18–50 takes the first 70 % (about 6.7 px a year on a phone), 50–70 the
 * next 20 % and 70–99 the rest. Every whole year stays reachable by dragging, and by one-year steps for screen readers.
 * With these points 28–42 sits at about 22 % and 53 % of the track, close to how onb-prefs draws it (22 %, 54 %).
 */
export const AGE_SCALE: readonly Point[] = [
  [18, 0],
  [50, 0.7],
  [70, 0.9],
  [99, 1],
];

/** Reads a polyline sorted on both axes: from age to fraction (`by` 0) or back (`by` 1); clamps at the ends. */
function along(points: readonly Point[], value: number, by: 0 | 1): number {
  const other = by === 0 ? 1 : 0;
  let prev: Point | undefined;
  for (const point of points) {
    if (value <= point[by]) {
      if (!prev) return point[other];
      const span = point[by] - prev[by];
      return span === 0 ? point[other] : prev[other] + ((value - prev[by]) / span) * (point[other] - prev[other]);
    }
    prev = point;
  }
  return prev ? prev[other] : 0;
}

/** The scale between `min` and `max`, stretched so `min` is at 0 and `max` at 1 (linear if they fall outside it). */
function scalePoints(min: number, max: number): readonly Point[] {
  const lo = along(AGE_SCALE, min, 0);
  const span = along(AGE_SCALE, max, 0) - lo;
  if (max <= min || span <= 0) return [[min, 0], [Math.max(max, min + 1), 1]];
  const inner = AGE_SCALE.filter(([age]) => age > min && age < max).map(([age, f]): Point => [age, (f - lo) / span]);
  return [[min, 0], ...inner, [max, 1]];
}

/** An age's place on the track, 0–1. */
export function ageToFraction(age: number, min: number, max: number): number {
  return along(scalePoints(min, max), age, 0);
}

/** The age at a place on the track (0–1), not rounded. */
export function fractionToAge(fraction: number, min: number, max: number): number {
  return along(scalePoints(min, max), fraction, 1);
}

/** Clamps a new value for one thumb: whole years, inside [min, max], at least `minGap` from the other thumb. */
export function clampThumb(which: Thumb, value: number, s: { min: number; max: number; low: number; high: number; minGap: number }): number {
  const v = Math.round(value);
  return which === 'low' ? Math.max(s.min, Math.min(v, s.high - s.minGap)) : Math.min(s.max, Math.max(v, s.low + s.minGap));
}

/**
 * The two-thumb age slider of onb-prefs (spec §6.15): a 4 px Track across the card, the chosen range in Skov, 28 px
 * white thumbs with a 2 px Skov ring that overhang the track's ends, on the {@link AGE_SCALE}. Each thumb is its own
 * adjustable control for screen readers (swipe up/down by one year) and has a 44 px target.
 */
export function AgeRangeSlider(props: AgeRangeSliderProps) {
  const { min, max, low, high, lowLabel, highLabel, testID } = props;
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const x = (v: number) => ageToFraction(v, min, max) * width;

  // The pan handlers are made once and read the latest props and width through this ref.
  const latest = useRef({ props, width });
  latest.current = { props, width };

  const set = (which: Thumb, value: number) => {
    const s = latest.current.props;
    const next = clampThumb(which, value, s);
    if (which === 'low' && next !== s.low) s.onChange(next, s.high);
    if (which === 'high' && next !== s.high) s.onChange(s.low, next);
  };

  const makeResponder = (which: Thumb) => {
    let start = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the drag when the page's ScrollView asks for the gesture.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start = latest.current.props[which];
      },
      onPanResponderMove: (_, g) => {
        const { width: w, props: s } = latest.current;
        if (w > 0) set(which, fractionToAge(ageToFraction(start, s.min, s.max) + g.dx / w, s.min, s.max));
      },
    });
  };
  const [pans] = useState(() => ({ low: makeResponder('low'), high: makeResponder('high') }));

  const onAction = (which: Thumb) => (e: AccessibilityActionEvent) => {
    const current = latest.current.props[which];
    if (e.nativeEvent.actionName === 'increment') set(which, current + 1);
    if (e.nativeEvent.actionName === 'decrement') set(which, current - 1);
  };

  const thumb = (which: Thumb) => {
    const value = which === 'low' ? low : high;
    return (
      <View
        testID={testID ? `${testID}-${which}` : undefined}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={which === 'low' ? lowLabel : highLabel}
        accessibilityValue={{ min, max, now: value, text: String(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction(which)}
        hitSlop={(Size.hitTarget - THUMB) / 2}
        {...pans[which].panHandlers}
        style={[styles.thumb, { left: x(value) - THUMB / 2, backgroundColor: p.surface, borderColor: p.primary }]}
      />
    );
  };

  return (
    <View testID={testID} style={styles.box} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.track, styles.full, { backgroundColor: p.track }]} />
      <View style={[styles.track, { left: x(low), width: Math.max(0, x(high) - x(low)), backgroundColor: p.primary }]} />
      {/* Rendered before the first layout too, so screen readers always find both thumbs. */}
      {thumb('low')}
      {thumb('high')}
    </View>
  );
}

const styles = StyleSheet.create({
  // The track spans the card's content (2 px in from each side); at the ends the thumbs overhang it by half their
  // width, into the card padding.
  box: { height: THUMB, marginHorizontal: 2, overflow: 'visible' },
  track: { position: 'absolute', top: (THUMB - TRACK) / 2, height: TRACK, borderRadius: Radius.track },
  full: { left: 0, right: 0 },
  thumb: { position: 'absolute', top: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: BorderWidth.strong },
});
