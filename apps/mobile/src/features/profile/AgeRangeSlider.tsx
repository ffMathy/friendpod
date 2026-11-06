import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Sizes, usePalette } from '@/components/theme';

export interface AgeRangeSliderProps {
  /** The ends of the track (MIN_AGE, MAX_AGE). */
  readonly min: number;
  readonly max: number;
  readonly low: number;
  readonly high: number;
  /** Smallest allowed `high - low` (MIN_AGE_RANGE_WIDTH); the thumbs stop there. */
  readonly minGap: number;
  readonly onChange: (low: number, high: number) => void;
  /** Accessible names of the two thumbs ("Youngest age", "Oldest age"). */
  readonly lowLabel: string;
  readonly highLabel: string;
  readonly testID?: string;
}

type Thumb = 'low' | 'high';

const THUMB = 24;
const TRACK = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The track's scale: a gentle curve instead of a straight line. On a linear 18–99 track the ages people pick bunch at
 * the far left (21–47 fills only 4–36 % of it); with fraction^0.6 the 20s to 50s get most of the room and a typical
 * span sits mid-track as in storyboard 1.6 (21–47 at about 14–54 %), while every age up to `max` stays reachable
 * (60–99 still take a third of the track). Values, steps and the screen-reader actions are unchanged.
 */
const CURVE = 0.6;

/** Where `v` sits along the track, 0–1. */
const fractionOf = (v: number, min: number, max: number) => clamp((v - min) / Math.max(1, max - min), 0, 1) ** CURVE;

/** The (unrounded) value at fraction `f` of the track. */
const valueAt = (f: number, min: number, max: number) => min + clamp(f, 0, 1) ** (1 / CURVE) * (max - min);

/**
 * The two-thumb age range of storyboard 1.6: a 4-pt track, the chosen span in green and two white 24-pt thumbs.
 * One responder covers the whole 44-pt row, so a touch anywhere moves the nearer thumb and a drag carries it; the
 * thumbs never come closer than `minGap`. Each thumb is an adjustable element for screen readers (swipe up/down).
 */
export function AgeRangeSlider({ min, max, low, high, minGap, onChange, lowLabel, highLabel, testID }: AgeRangeSliderProps) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  // The responder is created once; it reads the latest props and size from refs.
  const latest = useRef({ min, max, low, high, minGap, onChange, width });
  latest.current = { min, max, low, high, minGap, onChange, width };
  const drag = useRef<{ thumb: Thumb; startX: number } | null>(null);

  const usable = Math.max(0, width - THUMB);
  const xOf = (v: number) => THUMB / 2 + fractionOf(v, min, max) * usable;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const s = latest.current;
        const w = Math.max(1, s.width - THUMB);
        const at = (v: number) => THUMB / 2 + fractionOf(v, s.min, s.max) * w;
        const x = e.nativeEvent.locationX;
        const dLow = Math.abs(x - at(s.low));
        const dHigh = Math.abs(x - at(s.high));
        // Both thumbs can sit on one spot only at the minimum gap; then the side of the touch decides.
        const thumb: Thumb = dLow < dHigh || (dLow === dHigh && x < at(s.low)) ? 'low' : 'high';
        drag.current = { thumb, startX: x };
        moveTo(thumb, x);
      },
      onPanResponderMove: (_e, g) => {
        if (drag.current) moveTo(drag.current.thumb, drag.current.startX + g.dx);
      },
      onPanResponderRelease: () => {
        drag.current = null;
      },
      onPanResponderTerminate: () => {
        drag.current = null;
      },
    }),
  ).current;

  function setThumb(thumb: Thumb, value: number) {
    const s = latest.current;
    if (thumb === 'low') {
      const next = clamp(value, s.min, s.high - s.minGap);
      if (next !== s.low) s.onChange(next, s.high);
    } else {
      const next = clamp(value, s.low + s.minGap, s.max);
      if (next !== s.high) s.onChange(s.low, next);
    }
  }

  function moveTo(thumb: Thumb, x: number) {
    const s = latest.current;
    const w = Math.max(1, s.width - THUMB);
    setThumb(thumb, Math.round(valueAt((x - THUMB / 2) / w, s.min, s.max)));
  }

  const onAction = (thumb: Thumb) => (e: AccessibilityActionEvent) => {
    const s = latest.current;
    const step = e.nativeEvent.actionName === 'increment' ? 1 : e.nativeEvent.actionName === 'decrement' ? -1 : 0;
    if (step !== 0) setThumb(thumb, (thumb === 'low' ? s.low : s.high) + step);
  };

  const thumb = (which: Thumb) => {
    const value = which === 'low' ? low : high;
    return (
      <View
        key={which}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={which === 'low' ? lowLabel : highLabel}
        accessibilityValue={{ min: which === 'low' ? min : low + minGap, max: which === 'low' ? high - minGap : max, now: value, text: String(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction(which)}
        pointerEvents="none"
        style={[styles.thumb, { left: xOf(value) - THUMB / 2, backgroundColor: p.surface, borderColor: p.primary }]}
      />
    );
  };

  return (
    <View
      testID={testID}
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" style={[styles.track, { left: THUMB / 2, right: THUMB / 2, backgroundColor: p.border }]} />
      <View pointerEvents="none" style={[styles.track, { left: xOf(low), width: Math.max(0, xOf(high) - xOf(low)), backgroundColor: p.primary }]} />
      {thumb('low')}
      {thumb('high')}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: Sizes.touch, justifyContent: 'center' },
  track: { position: 'absolute', top: (Sizes.touch - TRACK) / 2, height: TRACK, borderRadius: TRACK / 2 },
  thumb: { position: 'absolute', top: (Sizes.touch - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 2 },
});
