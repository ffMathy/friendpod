/**
 * Text input with its label (15/700), an optional "(optional)" suffix, a character counter, helper text and an
 * error. 54 px, r14, 1 px input border; 2 px green when focused.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
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
  /** `lg` 54 px / 17 px text (default), `md` 52 px / 16 px (search, add-interest, date and time). */
  readonly size?: 'lg' | 'md';
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
  const height = size === 'md' ? Size.inputCompact : Size.input;
  const borderColor = error ? p.dangerText : focused ? p.primary : p.borderStrong;
  const borderWidth = focused || error ? BorderWidth.strong : BorderWidth.hairline;
  const padH = icon ? 44 : 16;
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
            <Text variant="caption" color={maxLength && (value ?? '').length >= maxLength ? 'dangerText' : 'textMuted'}>
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
              typeStyle(size === 'md' ? 'lede' : 'input'),
              styles.input,
              multiline ? styles.multiline : { height },
              {
                color: p.text,
                backgroundColor: p.surface,
                borderColor,
                borderWidth,
                paddingLeft: padH - (borderWidth - 1),
                paddingRight: 16 - (borderWidth - 1),
                lineHeight: multiline ? 22 : undefined,
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
