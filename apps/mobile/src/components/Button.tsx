/**
 * Buttons and links (blend spec §6.1). Every tap target is Skov (primary), Skov deep (link), White secondary, the
 * Danger outline, or the Apple button. Pills: 54 px screen CTA (`lg`), 48 in cards (`md`), 44 small (`sm`), 40
 * inline (`xs`; hitSlop brings the target to 44), and `input`: 52 px, radius 14, the Add/Send button beside an input.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text as RNText,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon, type IconName } from './Icon';
import { BorderWidth, font, Radius, Size, typeStyle, usePalette, type PaletteKey, type TypeVariant } from './theme';

export type ButtonVariant =
  /** Skov, white label: the one main action of a screen ("I'm in", "Continue", "Add"). Pressed: Skov deep. */
  | 'primary'
  /** White, 1.5 px Outline, Ink label: the alternative action ("Not this time", "Continue with Google"). */
  | 'secondary'
  /** Same as secondary (kept for existing call sites). */
  | 'outline'
  /**
   * Destructive (remove, withdraw, delete, block, report): white, 1.5 px Danger border, Danger label and icon (trash
   * unless `icon` says otherwise: `block`, `flag`). Never a filled red button, never a pink fill.
   */
  | 'danger'
  /** Ink, white label: "Continue with Apple" only (Apple's rule). */
  | 'apple'
  /** Text only, Ink: "Cancel", "Continue without". */
  | 'ghost'
  /** A dashed Field outline ("Suggest another time (1 spot left)"). */
  | 'dashed'
  /** A standalone link styled as such (Skov deep 15/700, underlined, 44 px target): "Why this pod?". */
  | 'link'
  /** A quiet link (Ink 2 15/700, underlined): "Changed your mind? Leave this pod". */
  | 'quietLink';

export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs' | 'input';

const SIZES: Record<ButtonSize, { height: number; type: TypeVariant; padding: number; icon: number }> = {
  lg: { height: Size.button, type: 'button', padding: 24, icon: 18 },
  md: { height: Size.buttonMedium, type: 'button', padding: 18, icon: 18 },
  sm: { height: Size.buttonCompact, type: 'buttonSmall', padding: 14, icon: 16 },
  xs: { height: Size.buttonSmall, type: 'smallBold', padding: 14, icon: 16 },
  input: { height: Size.inputCompact, type: 'button', padding: 18, icon: 18 },
};

interface VariantColors {
  readonly bg: PaletteKey | 'transparent';
  readonly fg: PaletteKey;
  readonly border?: PaletteKey;
  readonly dashed?: boolean;
  readonly pressedBg?: PaletteKey;
}

const VARIANTS: Record<Exclude<ButtonVariant, 'link' | 'quietLink'>, VariantColors> = {
  primary: { bg: 'primary', fg: 'onPrimary', pressedBg: 'primaryPressed' },
  secondary: { bg: 'surface', fg: 'text', border: 'borderStrong', pressedBg: 'page' },
  outline: { bg: 'surface', fg: 'text', border: 'borderStrong', pressedBg: 'page' },
  danger: { bg: 'surface', fg: 'danger', border: 'danger', pressedBg: 'dangerPressedBg' },
  apple: { bg: 'ink', fg: 'onInk' },
  ghost: { bg: 'transparent', fg: 'text' },
  dashed: { bg: 'transparent', fg: 'text', border: 'field', dashed: true, pressedBg: 'page' },
};

export interface ButtonProps {
  readonly label: string;
  readonly onPress: (e: GestureResponderEvent) => void;
  readonly variant?: ButtonVariant;
  /** Default `lg` (54 px, full width). `input` is the 52 px, radius-14 button beside an input (Add, Send). */
  readonly size?: ButtonSize;
  /** A leading icon ("Open in Maps", "Add to calendar"). The danger variant defaults to `trash`. */
  readonly icon?: IconName;
  /** `pill` (default) or `rounded` (radius 14; the default for size `input`). */
  readonly shape?: 'pill' | 'rounded';
  /** Stretch to the row (default: true for `lg`, false otherwise). */
  readonly fullWidth?: boolean;
  /** flex-grow inside a row of buttons (the storyboards pair 1 : 1.4). */
  readonly grow?: number;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly testID?: string;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  /** Default `button` (`link` for the link variants). */
  readonly accessibilityRole?: 'button' | 'link';
  readonly style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  shape,
  fullWidth,
  grow,
  disabled = false,
  busy = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  style,
}: ButtonProps) {
  const p = usePalette();
  if (variant === 'link' || variant === 'quietLink') {
    return (
      <TextLink
        label={label}
        onPress={onPress}
        muted={variant === 'quietLink'}
        align={fullWidth ? 'center' : 'start'}
        testID={testID}
        accessibilityRole={accessibilityRole ?? 'link'}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }
  const s = SIZES[size];
  const v = VARIANTS[variant];
  const inactive = disabled || busy;
  const textOnly = variant === 'ghost';
  const fg = inactive && !busy ? (textOnly ? p.textMuted : p.disabledText) : p[v.fg];
  const stretch = fullWidth ?? (size === 'lg' && grow === undefined);
  const glyph = icon ?? (variant === 'danger' ? 'trash' : undefined);
  const rounded = (shape ?? (size === 'input' ? 'rounded' : 'pill')) === 'rounded';
  const bgFor = (pressed: boolean) => {
    if (inactive && !busy) return textOnly ? 'transparent' : p.disabledBg;
    const key = pressed && v.pressedBg ? v.pressedBg : v.bg;
    return key === 'transparent' ? 'transparent' : p[key];
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={s.height < Size.hitTarget ? (Size.hitTarget - s.height) / 2 : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: s.height,
          paddingHorizontal: s.padding,
          borderRadius: rounded ? Radius.md : Radius.pill,
          backgroundColor: bgFor(pressed),
          opacity: pressed && !v.pressedBg ? 0.85 : 1,
        },
        v.border && !(inactive && !busy)
          ? { borderWidth: BorderWidth.control, borderColor: p[v.border], borderStyle: v.dashed ? 'dashed' : 'solid' }
          : null,
        stretch ? styles.stretch : styles.hug,
        grow !== undefined ? { flexGrow: grow, flexShrink: 1, flexBasis: 'auto' } : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={[styles.content, { gap: variant === 'danger' ? 6 : 8 }]}>
          {glyph ? <Icon name={glyph} size={variant === 'danger' ? 16 : s.icon} strokeWidth={variant === 'danger' ? 2.2 : undefined} color={fg} /> : null}
          <RNText style={[typeStyle(s.type), styles.label, { color: fg }]}>{label}</RNText>
        </View>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  readonly icon: IconName;
  readonly onPress: (e: GestureResponderEvent) => void;
  /** Required: an icon button has no visible text. */
  readonly accessibilityLabel: string;
  /** `plain` (default, 44 px transparent) or `filled` (Skov, 52 px, radius 14: the Send button beside the chat input). */
  readonly variant?: 'plain' | 'filled';
  readonly iconSize?: number;
  readonly color?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, onPress, accessibilityLabel, variant = 'plain', iconSize, color, disabled = false, testID, style }: IconButtonProps) {
  const p = usePalette();
  const filled = variant === 'filled';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        filled ? styles.filledIcon : styles.plainIcon,
        filled ? { backgroundColor: disabled ? p.disabledBg : pressed ? p.primaryPressed : p.primary } : null,
        { opacity: pressed && !filled ? 0.6 : 1 },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize ?? (filled ? 20 : 24)} color={color ?? (filled ? (disabled ? p.disabledText : p.onPrimary) : p.text)} />
    </Pressable>
  );
}

/** The 44 px back chevron (Ink), pulled 10 px into the gutter so the glyph lines up with the text. */
export function BackButton({ onPress, accessibilityLabel, testID, color }: { onPress: () => void; accessibilityLabel: string; testID?: string; color?: string }) {
  return <IconButton icon="back" onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} color={color} style={styles.pullLeft} />;
}

/** The 44 px close cross (22 px glyph), pulled 10 px into the right gutter. */
export function CloseButton({ onPress, accessibilityLabel, testID, color }: { onPress: () => void; accessibilityLabel: string; testID?: string; color?: string }) {
  return <IconButton icon="close" iconSize={22} onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} color={color} style={styles.pullRight} />;
}

export interface TextLinkProps {
  readonly label: string;
  readonly onPress: (e: GestureResponderEvent) => void;
  /** `md` 15/700 (default, the spec's standalone link), `lg` 16/700, `sm` 13/700. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** The quiet link: Ink 2 instead of Skov deep ("Changed your mind? Leave this pod"). */
  readonly muted?: boolean;
  readonly underline?: boolean;
  readonly align?: 'start' | 'center';
  /** No 44 px minimum height (inside a section header row); the touch target comes from hitSlop instead. */
  readonly compact?: boolean;
  readonly testID?: string;
  readonly accessibilityRole?: 'link' | 'button';
  readonly accessibilityLabel?: string;
}

/** A standalone text link with a 44 px touch target ("How matching works", "Why this pod?", "Edit"). */
export function TextLink({ label, onPress, size = 'md', muted = false, underline = true, align = 'start', compact = false, testID, accessibilityRole = 'link', accessibilityLabel }: TextLinkProps) {
  const p = usePalette();
  const type: TypeVariant = size === 'lg' ? 'button' : size === 'sm' ? 'captionBold' : 'buttonSmall';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={compact ? 14 : 8}
      style={({ pressed }) => [compact ? null : styles.link, { alignSelf: align === 'center' ? 'center' : 'flex-start', opacity: pressed ? 0.6 : 1 }]}
    >
      <RNText style={[typeStyle(type), { color: muted ? p.textSecondary : p.link }, underline ? styles.underline : null]}>{label}</RNText>
    </Pressable>
  );
}

/** A link inside running text (inherits size; Skov deep, underlined). */
export function InlineLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const p = usePalette();
  return (
    <RNText accessibilityRole="link" onPress={onPress} style={[{ color: p.link }, styles.underline, font('600')]}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  stretch: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center', flexShrink: 1 },
  plainIcon: { width: Size.hitTarget, height: Size.hitTarget, alignItems: 'center', justifyContent: 'center' },
  filledIcon: { width: Size.inputCompact, height: Size.inputCompact, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pullLeft: { marginLeft: -10 },
  pullRight: { marginRight: -10 },
  link: { minHeight: Size.hitTarget, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
