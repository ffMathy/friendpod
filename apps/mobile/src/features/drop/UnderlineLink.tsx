import { Pressable, StyleSheet, Text } from 'react-native';
import { Fonts, FontSize, Sizes, Type, usePalette } from '@/components/theme';

export interface UnderlineLinkProps {
  readonly label: string;
  readonly onPress: () => void;
  /** 'accent' green (default) · 'muted' ("Changed your mind? Leave this pod"). */
  readonly tone?: 'accent' | 'muted';
  /**
   * 'md' 15/700 in a 44-pt row ("Why this pod?", storyboards 2.2–2.4) · 'sm' 14/600 at its text height, reaching the
   * 44-pt touch target through its slop ("How matching works" closing This week, 2.1).
   */
  readonly size?: 'md' | 'sm';
  readonly align?: 'start' | 'center';
  /** 'link' (default, opens a page or sheet) or 'button' (does something). */
  readonly role?: 'link' | 'button';
  readonly testID?: string;
}

/** The 'sm' line height; the slop below makes up the rest of the 44-pt touch target. */
const SM_LINE = 19;

/**
 * A text link in the drop screens' storyboard look: TextLink's colours and touch target, underlined as the storyboards
 * draw every plain text link (2.1–2.4, 5.1).
 */
export function UnderlineLink({ label, onPress, tone = 'accent', size = 'md', align = 'start', role = 'link', testID }: UnderlineLinkProps) {
  const p = usePalette();
  const color = tone === 'accent' ? p.primary : p.muted;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={size === 'sm' ? (Sizes.touch - SM_LINE) / 2 : undefined}
      style={({ pressed }) => [size === 'md' && styles.row, align === 'center' ? styles.selfCenter : styles.selfStart, pressed && styles.pressed]}
    >
      <Text style={[size === 'md' ? Type.section : styles.sm, styles.underline, { color, textDecorationColor: color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: Sizes.touch, justifyContent: 'center' },
  sm: { ...Fonts.semibold, fontSize: FontSize.md, lineHeight: SM_LINE },
  underline: { textDecorationLine: 'underline' },
  selfStart: { alignSelf: 'flex-start' },
  selfCenter: { alignSelf: 'center' },
  pressed: { opacity: 0.75 },
});
