/**
 * Buttons and links. Pills: 54 px full width (`lg`), 48 (`md`, on hero cards), 44 (`sm`, half-width pairs and
 * choices), 40 (`xs`, inline small actions; hitSlop brings the target to 44).
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
  /** Brand green: the main action of a screen. */
  | 'primary'
  /** Near-black: "Continue with Apple", "Plan the meetup", "Send report", "Okay". */
  | 'dark'
  /** White with a grey border: "Continue with Google", "Not this time", "Skip this week". */
  | 'outline'
  /** Same as outline (kept for existing call sites). */
  | 'secondary'
  /** Text only: "Continue without", "Cancel". */
  | 'ghost'
  /** Solid red: the final destructive step ("Sign in again and delete"). */
  | 'danger'
  /** Red tint: "Delete account", "Remove & withdraw", "Report". */
  | 'dangerSoft'
  /** Purple: "I'm in" on a pod about a private interest. */
  | 'private'
  /** White on a dark hero card ("Yes, I'm coming"). */
  | 'light'
  /** Outline on a dark hero card ("Can't make it"). */
  | 'outlineOnDark'
  /** Outline on a mint card ("Not for me"). */
  | 'outlineOnMint';

export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

const SIZES: Record<ButtonSize, { height: number; type: TypeVariant; padding: number }> = {
  lg: { height: Size.button, type: 'button', padding: 24 },
  md: { height: Size.buttonMedium, type: 'heading', padding: 16 },
  sm: { height: Size.buttonCompact, type: 'smallBold', padding: 14 },
  xs: { height: Size.buttonSmall, type: 'smallBold', padding: 14 },
};

interface VariantColors {
  readonly bg: PaletteKey | 'transparent';
  readonly fg: PaletteKey;
  readonly border?: PaletteKey;
  readonly pressedBg?: PaletteKey;
}

const VARIANTS: Record<ButtonVariant, VariantColors> = {
  primary: { bg: 'primary', fg: 'onPrimary', pressedBg: 'primaryPressed' },
  dark: { bg: 'ink', fg: 'onInk' },
  outline: { bg: 'surface', fg: 'text', border: 'borderStrong', pressedBg: 'surfaceMuted' },
  secondary: { bg: 'surface', fg: 'text', border: 'borderStrong', pressedBg: 'surfaceMuted' },
  ghost: { bg: 'transparent', fg: 'text' },
  danger: { bg: 'danger', fg: 'onDanger' },
  dangerSoft: { bg: 'dangerBg', fg: 'dangerText', border: 'dangerBorder' },
  private: { bg: 'private', fg: 'onPrivate', pressedBg: 'privatePressed' },
  light: { bg: 'onHero', fg: 'hero' },
  outlineOnDark: { bg: 'transparent', fg: 'onHero', border: 'heroBorder' },
  outlineOnMint: { bg: 'surface', fg: 'text', border: 'mintBorder' },
};

export interface ButtonProps {
  readonly label: string;
  readonly onPress: (e: GestureResponderEvent) => void;
  readonly variant?: ButtonVariant;
  /** Default `lg` (54 px, full width). */
  readonly size?: ButtonSize;
  /** A leading icon ("Share invite link", "Download my data first", "Add to calendar"). */
  readonly icon?: IconName;
  /** `pill` (default) or `rounded` (r14, the square "Add" button beside an input). */
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
  readonly style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  shape = 'pill',
  fullWidth,
  grow,
  disabled = false,
  busy = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const p = usePalette();
  const s = SIZES[size];
  const v = VARIANTS[variant];
  const inactive = disabled || busy;
  const ghost = variant === 'ghost';
  const fg = inactive && !busy ? (ghost ? p.textFaint : p.disabledText) : p[v.fg];
  const stretch = fullWidth ?? (size === 'lg' && grow === undefined);
  const bgFor = (pressed: boolean) => {
    if (inactive && !busy) return ghost ? 'transparent' : p.disabledBg;
    const key = pressed && v.pressedBg ? v.pressedBg : v.bg;
    return key === 'transparent' ? 'transparent' : p[key];
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
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
          borderRadius: shape === 'rounded' ? Radius.md : Radius.pill,
          backgroundColor: bgFor(pressed),
          opacity: pressed && !v.pressedBg ? 0.85 : 1,
        },
        v.border && !(inactive && !busy) ? { borderWidth: BorderWidth.hairline, borderColor: p[v.border] } : null,
        stretch ? styles.stretch : styles.hug,
        grow !== undefined ? { flexGrow: grow, flexShrink: 1, flexBasis: 'auto' } : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={size === 'lg' ? 20 : 16} color={fg} /> : null}
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
  /** `plain` (default, 44 px transparent) or `filled` (the round send button, 46 px primary). */
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

/** The 44 px back chevron, pulled 10 px into the gutter so the glyph lines up with the text. */
export function BackButton({ onPress, accessibilityLabel, testID }: { onPress: () => void; accessibilityLabel: string; testID?: string }) {
  return <IconButton icon="back" onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} style={styles.pullLeft} />;
}

/** The 44 px close cross (22 px glyph), pulled 10 px into the right gutter. */
export function CloseButton({ onPress, accessibilityLabel, testID }: { onPress: () => void; accessibilityLabel: string; testID?: string }) {
  return <IconButton icon="close" iconSize={22} onPress={onPress} accessibilityLabel={accessibilityLabel} testID={testID} style={styles.pullRight} />;
}

export interface TextLinkProps {
  readonly label: string;
  readonly onPress: () => void;
  /** `md` 14/700 (default), `lg` 15/700, `sm` 13/700. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** Muted grey instead of green ("Changed your mind? Leave this pod"). */
  readonly muted?: boolean;
  readonly underline?: boolean;
  readonly align?: 'start' | 'center';
  /** No 44 px minimum height (inside a section header row); the touch target comes from hitSlop instead. */
  readonly compact?: boolean;
  readonly testID?: string;
  readonly accessibilityRole?: 'link' | 'button';
}

/** A standalone text link with a 44 px touch target ("How matching works", "Why this pod?", "Edit"). */
export function TextLink({ label, onPress, size = 'md', muted = false, underline = true, align = 'start', compact = false, testID, accessibilityRole = 'link' }: TextLinkProps) {
  const p = usePalette();
  const type: TypeVariant = size === 'lg' ? 'heading' : size === 'sm' ? 'captionBold' : 'smallBold';
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={compact ? 14 : 8}
      style={({ pressed }) => [compact ? null : styles.link, { alignSelf: align === 'center' ? 'center' : 'flex-start', opacity: pressed ? 0.6 : 1 }]}
    >
      <RNText style={[typeStyle(type), { color: muted ? p.textMuted : p.primary }, underline && !muted ? styles.underline : null]}>{label}</RNText>
    </Pressable>
  );
}

/** A link inside running text (inherits size; green, underlined). */
export function InlineLink({ children, onPress }: { children: ReactNode; onPress: () => void }) {
  const p = usePalette();
  return (
    <RNText accessibilityRole="link" onPress={onPress} style={[{ color: p.primary }, styles.underline, font('600')]}>
      {children}
    </RNText>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  stretch: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { textAlign: 'center', flexShrink: 1 },
  plainIcon: { width: Size.hitTarget, height: Size.hitTarget, alignItems: 'center', justifyContent: 'center' },
  filledIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pullLeft: { marginLeft: -10 },
  pullRight: { marginRight: -10 },
  link: { minHeight: Size.hitTarget, justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },
});
