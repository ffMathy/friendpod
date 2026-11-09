/**
 * Form controls (blend spec §6.15): checkbox, radio option, on/off switch, selectable chips and the segmented control.
 * "On" is Skov (switch, checkbox, radio); a selected choice or segment is Ink with white text. Every control has a
 * 44 px touch target and the matching accessibility role and state. Consent checkboxes start unticked (EDPB 05/2020
 * §§93–96); the caller owns the state.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { Text } from './Text';
import { BorderWidth, Radius, Size, typeStyle, usePalette, type TypeVariant } from './theme';

// ---------------------------------------------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------------------------------------------

export interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly testID?: string;
  /**
   * `plain` (default): box and a 14/400/1.5 label, top-aligned (the safety pledge).
   * `card`: in a white bordered card, 14/600 label (the explicit-consent box).
   * `inline`: 22 px box, 15 px label, one line ("Dansk", "English").
   * `bare`: the box only; the label is read by screen readers (feedback grid).
   */
  readonly variant?: 'plain' | 'card' | 'inline' | 'bare';
  readonly disabled?: boolean;
}

export function Checkbox({ label, checked, onChange, testID, variant = 'plain', disabled = false }: CheckboxProps) {
  const p = usePalette();
  const box = variant === 'inline' ? 22 : 24;
  const labelType: TypeVariant = variant === 'card' ? 'smallStrong' : variant === 'inline' ? 'body' : 'small';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={variant === 'bare' ? 10 : undefined}
      style={({ pressed }) => [
        variant === 'bare' ? styles.bare : styles.checkRow,
        variant === 'inline' ? styles.centerRow : null,
        variant === 'card' ? [styles.checkCard, { backgroundColor: p.surface, borderColor: p.border }] : null,
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <View
        style={[
          styles.box,
          { width: box, height: box },
          checked ? { backgroundColor: p.primary, borderColor: p.primary } : { backgroundColor: p.surface, borderColor: p.field },
          variant === 'plain' || variant === 'card' ? styles.boxNudge : null,
        ]}
      >
        {checked ? <Icon name="check" size={box - 6} color={p.onPrimary} strokeWidth={3} /> : null}
      </View>
      {variant === 'bare' ? null : (
        <Text variant={labelType} style={styles.flex}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Radio option
// ---------------------------------------------------------------------------------------------------------------

export interface RadioProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
  readonly disabled?: boolean;
}

/** A radio option card ("What happened?"): white, 1.5 px Outline, radius 14, min 48; selected: 2 px Skov border, 600. */
export function Radio({ label, selected, onPress, testID, disabled = false }: RadioProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioRow,
        {
          backgroundColor: p.surface,
          borderColor: selected ? p.primary : p.borderStrong,
          borderWidth: selected ? BorderWidth.strong : BorderWidth.control,
          paddingHorizontal: selected ? 13.5 : 14,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? p.primary : p.field, borderWidth: selected ? 2 : 1.5 }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: p.primary }]} /> : null}
      </View>
      <Text variant={selected ? 'bodyStrong' : 'body'} style={styles.flex}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Switch
// ---------------------------------------------------------------------------------------------------------------

export interface SwitchProps {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  /** A muted line under the label ("We'll ask for your gender and your consent…"). */
  readonly description?: string;
  /**
   * `card` (default): white card, 1 px Line, radius 22 ("Same-gender pods only").
   * `outline`: radius 16 with the 1.5 px Outline border ("Open to meeting anyone").
   * `plain`: just the row, for lists.
   */
  readonly variant?: 'card' | 'outline' | 'plain';
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function Switch({ label, value, onChange, description, variant = 'card', disabled = false, testID }: SwitchProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.switchRow,
        variant === 'card' ? [styles.switchCard, { backgroundColor: p.surface, borderColor: p.border }] : null,
        variant === 'outline' ? [styles.switchOutline, { borderColor: p.borderStrong }] : null,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.switchText}>
        <Text variant="rowTitle">{label}</Text>
        {description ? (
          <Text variant="caption" weight={variant === 'outline' ? '500' : undefined} color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.track, value ? { backgroundColor: p.primary, borderColor: p.primary } : { backgroundColor: p.track, borderColor: p.field }]}>
        <View style={[styles.thumb, { backgroundColor: p.switchThumb }, value ? styles.thumbOn : null]} />
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Selectable chips
// ---------------------------------------------------------------------------------------------------------------

export interface ChoiceChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  /** `md` 44 px (default; "10 km"), `sm` 36 px, `lg` 48 px rounded-square (rating 1–5). */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Selected fill: `ink` (default: a selected choice is Ink with white text) or `primary` (Skov). */
  readonly selectedColor?: 'ink' | 'primary';
  /** Grow to share a row/grid evenly. */
  readonly fill?: boolean;
  /** `radio` for one-of-many (default), `checkbox` for many-of-many, `button` for a pressed state. */
  readonly role?: 'radio' | 'checkbox' | 'button';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly disabled?: boolean;
}

export function ChoiceChip({ label, selected, onPress, size = 'md', selectedColor = 'ink', fill = false, role = 'radio', accessibilityLabel, testID, disabled = false }: ChoiceChipProps) {
  const p = usePalette();
  const height = size === 'lg' ? Size.buttonMedium : size === 'sm' ? Size.chip : Size.buttonCompact;
  const bg = selected ? (selectedColor === 'primary' ? p.primary : p.ink) : p.surface;
  const fg = selected ? (selectedColor === 'primary' ? p.onPrimary : p.onInk) : p.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={role === 'button' ? { selected, disabled } : { checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={height < Size.hitTarget ? (Size.hitTarget - height) / 2 : undefined}
      style={({ pressed }) => [
        styles.choice,
        {
          minHeight: height,
          borderRadius: size === 'lg' ? Radius.md : Radius.pill,
          backgroundColor: bg,
          borderWidth: selected ? 0 : BorderWidth.control,
          borderColor: p.borderStrong,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        fill ? styles.fill : null,
      ]}
    >
      <Text style={[typeStyle(size === 'sm' ? 'smallBold' : 'buttonSmall'), { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * A selectable chip announced as a switch (on/off). Kept for existing call sites (languages, reasons, report
 * categories); new screens use ChoiceChip, Checkbox or Switch.
 */
export function Toggle({ label, value, onChange, testID, accessibilityLabel }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string; accessibilityLabel?: string }) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={4}
      style={({ pressed }) => [
        styles.choice,
        {
          minHeight: Size.chip,
          borderRadius: Radius.pill,
          backgroundColor: value ? p.ink : p.surface,
          borderWidth: value ? 0 : BorderWidth.control,
          borderColor: p.borderStrong,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[typeStyle('smallStrong'), { color: value ? p.onInk : p.text }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------------------------------------------

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Names the group ("Language"). */
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

/** A segmented control (the welcome's language switch): a white pill, the selected segment Ink with white text. */
export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel, testID }: SegmentedControlProps<T>) {
  const p = usePalette();
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.segmented, { backgroundColor: p.surface, borderColor: p.border }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(o.value)}
            hitSlop={{ top: 5, bottom: 5 }}
            style={[styles.segment, { backgroundColor: selected ? p.ink : 'transparent' }]}
          >
            <Text variant="smallBold" color={selected ? 'onInk' : 'text'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { flexGrow: 1, flexBasis: 0 },
  checkRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: Size.hitTarget },
  centerRow: { alignItems: 'center', gap: 8 },
  checkCard: { borderWidth: BorderWidth.hairline, borderRadius: Radius.lg, padding: 12 },
  bare: { width: Size.hitTarget, height: Size.hitTarget, alignItems: 'center', justifyContent: 'center' },
  box: { borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boxNudge: { marginTop: 1 },
  radioRow: { minHeight: 48, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  switchCard: { borderWidth: BorderWidth.hairline, borderRadius: Radius.card, paddingVertical: 14, paddingHorizontal: 16 },
  switchOutline: { borderWidth: BorderWidth.control, borderRadius: Radius.lg, paddingVertical: 8, paddingHorizontal: 16 },
  switchText: { flex: 1, gap: 4 },
  track: { width: 52, height: 32, borderRadius: 16, borderWidth: 1.5, padding: 2, justifyContent: 'center' },
  thumb: { width: 25, height: 25, borderRadius: 12.5 },
  thumbOn: { alignSelf: 'flex-end' },
  choice: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  segmented: { flexDirection: 'row', borderWidth: BorderWidth.hairline, borderRadius: 22, padding: 3 },
  segment: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
