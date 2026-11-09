import type { Locale } from '@friendpod/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { Size, usePalette } from '@/components/theme';

export interface LanguageSwitchProps {
  readonly value: Locale;
  readonly onChange: (locale: Locale) => void;
  /** The two choices in the order shown ("Dansk", "English"), each named in its own language. */
  readonly options: readonly { readonly value: Locale; readonly label: string }[];
  /** Names the group ("Language" / "Sprog"). */
  readonly accessibilityLabel: string;
}

/**
 * The welcome's language switch on the Skov field (Main.dc.html): a Paper pill, 2 px inside it two 44 px segments;
 * the chosen one Ink with white 14/700, the other Ink 2 14/600. Local to the welcome because the shared
 * `SegmentedControl` is the white, bordered, 36 px control for Paper grounds.
 */
export function LanguageSwitch({ value, onChange, options, accessibilityLabel }: LanguageSwitchProps) {
  const p = usePalette();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.pill, { backgroundColor: p.page }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={`language-${o.value}`}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [styles.segment, { backgroundColor: selected ? p.ink : 'transparent', opacity: pressed && !selected ? 0.7 : 1 }]}
          >
            <Text variant={selected ? 'smallBold' : 'smallStrong'} color={selected ? 'onInk' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', borderRadius: 24, padding: 2 },
  segment: { height: Size.hitTarget, paddingHorizontal: 14, borderRadius: Size.hitTarget / 2, alignItems: 'center', justifyContent: 'center' },
});
