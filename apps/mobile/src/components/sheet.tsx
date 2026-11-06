/**
 * A bottom sheet route (storyboards 2.3 "Why this pod", 4.2 the member sheet): the screen below behind the
 * storyboards' dark backdrop (`sheetBackdrop`, drawn there as a flat #59615C) and the sheet at the bottom, as tall as
 * its content.
 *
 * The root stack presents these routes as transparent modals that fade in (app/_layout.tsx), and this component draws
 * the rest: the backdrop, the sheet sliding up from below, and its closing on a tap on the backdrop or a drag down
 * (the system back closes it through the stack). The sheet's height comes from React Native's layout, so it follows
 * its content as that loads. The native form sheet that drew these before measured its content once on Android, at
 * the loading state and before the safe-area inset arrived, and clipped everything added after (device run, audit
 * "why-sheet"); its dimming is also a fixed light grey that cannot take the storyboards' backdrop.
 *
 * The child draws the sheet's surface itself (white, 28-pt top corners, grabber, bottom inset). The sheet stops a strip
 * below the status bar so some backdrop stays above it; a surface that may be taller than that (large text) should
 * shrink (`flexShrink: 1`) and scroll its body.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, usePalette } from './theme';

/** A drag down the sheet starts after this many points, and closes it past `SHEET_DISMISS_DISTANCE` or a flick. */
const DRAG_SLOP = 8;
export const SHEET_DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.9;
const ENTER_MS = 280;
const EXIT_MS = 180;

export interface SheetScreenProps {
  /** Leaves the route (`router.back`): on a tap on the backdrop, and after a drag down has slid the sheet away. */
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function SheetScreen({ onClose, children }: SheetScreenProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Below the screen at first; slides up once mounted, while the stack fades the backdrop in.
  const [slide] = useState(() => new Animated.Value(height));
  const [drag] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => Animated.add(slide, drag));
  // The pan handlers are made once (a re-render mid-drag must not reset the gesture), so they read these refs.
  const onCloseRef = useRef(onClose);
  const heightRef = useRef(height);
  useEffect(() => {
    onCloseRef.current = onClose;
    heightRef.current = height;
  }, [onClose, height]);

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);

  const [pan] = useState(() => {
    let closing = false;
    const settle = () => Animated.spring(drag, { toValue: 0, bounciness: 0, useNativeDriver: true }).start();
    return PanResponder.create({
      // Only a mostly vertical drag downwards; taps and short moves stay with the buttons and links inside.
      onMoveShouldSetPanResponder: (_e, g) => g.dy > DRAG_SLOP && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy <= SHEET_DISMISS_DISTANCE && g.vy <= DISMISS_VELOCITY) {
          settle();
          return;
        }
        if (closing) return;
        closing = true;
        Animated.timing(drag, { toValue: heightRef.current, duration: EXIT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() =>
          onCloseRef.current(),
        );
      },
      onPanResponderTerminate: settle,
    });
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.xxl }]}>
      {/* Light icons over the dark backdrop, in both schemes. */}
      <StatusBar barStyle="light-content" animated />
      <Pressable
        testID="sheet-backdrop"
        accessible={false}
        importantForAccessibility="no"
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: p.sheetBackdrop }]}
      />
      <Animated.View testID="sheet" accessibilityViewIsModal style={[styles.sheet, { transform: [{ translateY }] }]} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  // As tall as its content, at most the room below the backdrop strip.
  sheet: { flexShrink: 1 },
});
