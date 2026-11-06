import { Pressable, StyleSheet, View } from 'react-native';
import { Radius, Sizes, Spacing, usePalette } from '@/components/theme';
import { AppText, Icon } from '@/components/ui';

export interface InlineCheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly testID?: string;
  /**
   * 'option' (default): a short 15/400 label, the whole control only as wide as its text, so options sit side by side
   * ("Dansk", "English", storyboard 1.6). 'statement': a 14/400 sentence that wraps next to the box (the safety
   * pledge, storyboard 1.7).
   */
  readonly variant?: 'option' | 'statement';
}

/**
 * A checkbox whose label is plain body copy, as the storyboards set it: regular weight, and no wider than its text.
 * The shared `Checkbox` (components/ui) draws a semibold label that fills its row, which spreads two short options
 * into columns and makes a sentence heavy. One accessible element (role checkbox, named by the label, ≥ 44 pt tall);
 * the caller owns the state, and it starts unticked wherever it asks for agreement.
 */
export function InlineCheckbox({ label, checked, onChange, testID, variant = 'option' }: InlineCheckboxProps) {
  const p = usePalette();
  const statement = variant === 'statement';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [statement ? styles.statement : styles.option, pressed && styles.pressed]}
    >
      <View style={[styles.box, { borderColor: checked ? p.primary : p.borderStrong, backgroundColor: checked ? p.primary : p.surface }]}>
        {checked ? <Icon name="check" size={18} strokeWidth={2.6} color={p.onPrimary} /> : null}
      </View>
      <AppText variant={statement ? 'bodySm' : 'bodyMd'} style={statement ? styles.sentence : null}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: Sizes.touch },
  statement: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.ms, minHeight: Sizes.touch },
  box: { width: 24, height: 24, borderWidth: 2, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
  // Shrinks to wrap beside the box; the 1-pt drop lines the first 21-pt line up with the 24-pt box.
  sentence: { flexShrink: 1, marginTop: 1 },
  pressed: { opacity: 0.75 },
});
