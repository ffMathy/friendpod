/**
 * Text input with its label (15/700), an optional "(optional)" suffix, a character counter, helper text and an
 * error (blend spec §6.2). White, radius 14, 1.5 px Field border; focused: 2 px Skov deep; error: 2 px Danger.
 * Placeholders are Muted, never the platform default. `AddField` is the one input + Add pattern.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { ErrorText, Text } from './Text';
import { BorderWidth, Radius, Size, typeStyle, usePalette } from './theme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  /** The visible label, also the input's accessibility label. */
  readonly label: string;
  /** Keep the label for screen readers only (the "Add an interest" field). */
  readonly labelHidden?: boolean;
  /** `field` 15/700 above the input (default); `sub` 13 muted, for Day / Month / Year. */
  readonly labelStyle?: 'field' | 'sub';
  /** Appends a muted "(optional)". */
  readonly optional?: boolean;
  /** Muted 13 px line under the input. */
  readonly helper?: string;
  readonly error?: string | null;
  /** Shows "52 / 140" at the right of the label (needs `maxLength`). */
  readonly showCount?: boolean;
  /**
   * `lg` 54 px / 16 px text (default, standalone inputs), `md` 52 px / 16 px (search, date and time), `add` 52 px /
   * 15 px (the input of the input + Add pair, so "Add an interest in your own words" fits beside the button).
   */
  readonly size?: 'lg' | 'md' | 'add';
  /** A leading 20 px icon inside the input ("search"). */
  readonly icon?: IconName;
  /** Beside the input, in the same row (the "Add" button). */
  readonly trailing?: ReactNode;
}

export function TextField({
  label,
  labelHidden = false,
  labelStyle = 'field',
  optional = false,
  helper,
  error,
  showCount = false,
  size = 'lg',
  icon,
  trailing,
  multiline,
  maxLength,
  value,
  onFocus,
  onBlur,
  ...input
}: TextFieldProps) {
  const p = usePalette();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const height = size === 'lg' ? Size.input : Size.inputCompact;
  const borderColor = error ? p.danger : focused ? p.link : p.field;
  const borderWidth = focused || error ? BorderWidth.strong : BorderWidth.control;
  const padH = icon ? 44 : size === 'lg' ? 14 : 12;
  const count = showCount && maxLength ? `${(value ?? '').length} / ${maxLength}` : null;
  return (
    <View style={labelStyle === 'sub' ? styles.subField : styles.field}>
      {labelHidden ? null : (
        <View style={styles.labelRow}>
          <Text variant={labelStyle === 'sub' ? 'caption' : 'heading'} color={labelStyle === 'sub' ? 'textMuted' : 'text'} style={styles.flexShrink}>
            {label}
            {optional ? (
              <Text variant="heading" weight="500" color="textMuted">
                {` ${t('common.optional')}`}
              </Text>
            ) : null}
          </Text>
          {count ? (
            <Text variant="microStrong" color={maxLength && (value ?? '').length >= maxLength ? 'danger' : 'textMuted'}>
              {count}
            </Text>
          ) : null}
        </View>
      )}
      <View style={styles.inputRow}>
        <View style={styles.flex}>
          {icon ? <Icon name={icon} size={20} color={p.textMuted} style={[styles.icon, { top: (height - 20) / 2 }]} /> : null}
          <TextInput
            accessibilityLabel={label}
            accessibilityHint={helper}
            // Muted, not faint: every input's hint stays readable (about 6:1; textFaint is 2.5:1 on white).
            placeholderTextColor={p.textMuted}
            multiline={multiline}
            maxLength={maxLength}
            value={value}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              typeStyle(size === 'add' ? 'bodySmall' : 'input'),
              styles.input,
              multiline ? styles.multiline : { height },
              {
                color: p.text,
                backgroundColor: p.surface,
                borderColor,
                borderWidth,
                // The text stays put when the border thickens on focus.
                paddingLeft: padH - (borderWidth - BorderWidth.control),
                paddingRight: 12 - (borderWidth - BorderWidth.control),
                lineHeight: multiline ? 24 : undefined,
              },
            ]}
            {...input}
          />
        </View>
        {trailing}
      </View>
      {helper ? <Text variant="caption" color="textMuted">{helper}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

/** The older name; same component. */
export const Field = TextField;
export type FieldProps = TextFieldProps;

export interface AddFieldProps extends Omit<TextFieldProps, 'trailing' | 'size'> {
  /** The button's label ("Add", "Send"). */
  readonly addLabel: string;
  readonly onAdd: () => void;
  /** Disable the button (e.g. while the input is empty). */
  readonly addDisabled?: boolean;
  /** Show the button's spinner. */
  readonly busy?: boolean;
  /** Read by screen readers instead of `addLabel` ("Add interest"). */
  readonly addAccessibilityLabel?: string;
  readonly addTestID?: string;
}

/**
 * The one input + Add pattern (decision 7): a separate 52 px input (15 px text) and a 52 px Skov button with radius
 * 14, gap 8. The label is for screen readers only unless `labelHidden={false}`.
 *
 *   <AddField label={label} placeholder={placeholder} value={text} onChangeText={setText}
 *     addLabel={addLabel} onAdd={add} addDisabled={!text.trim()} />
 */
export function AddField({ addLabel, onAdd, addDisabled = false, busy = false, addAccessibilityLabel, addTestID, labelHidden = true, ...field }: AddFieldProps) {
  return (
    <TextField
      {...field}
      labelHidden={labelHidden}
      size="add"
      returnKeyType={field.returnKeyType ?? 'done'}
      onSubmitEditing={field.onSubmitEditing ?? (() => (addDisabled || busy ? undefined : onAdd()))}
      trailing={
        <Button
          size="input"
          label={addLabel}
          accessibilityLabel={addAccessibilityLabel}
          onPress={onAdd}
          disabled={addDisabled}
          busy={busy}
          testID={addTestID}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  field: { gap: 8 },
  subField: { gap: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  input: { borderRadius: Radius.md },
  multiline: { minHeight: 96, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  icon: { position: 'absolute', left: 14, zIndex: 1 },
});
