/**
 * Text primitives. All type goes through `Text` (a variant from the type scale, a palette colour, an optional weight
 * that swaps the font family). Never pass `fontWeight` in a style. Display roles (Display, Title, Headline, PodName)
 * are set in Bricolage Grotesque; everything else in Plus Jakarta Sans.
 */
import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { font, typeStyle, usePalette, type FontWeight, type PaletteKey, type TypeVariant } from './theme';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** A type-scale variant (default `body`: 16/24/400). */
  readonly variant?: TypeVariant;
  /** Another weight for the same size (swaps the family; never set `fontWeight`). */
  readonly weight?: FontWeight;
  /** A palette colour (default `text`). */
  readonly color?: PaletteKey;
  readonly align?: 'left' | 'center' | 'right';
  readonly style?: StyleProp<TextStyle>;
  readonly children?: ReactNode;
}

export function Text({ variant = 'body', weight, color = 'text', align, style, ...rest }: TextProps) {
  const p = usePalette();
  return <RNText style={[typeStyle(variant, weight), { color: p[color] }, align ? { textAlign: align } : null, style]} {...rest} />;
}

/** Inline emphasis inside another Text: changes only the weight (keeps size and colour). */
export function Strong({ children, weight = '700', color }: { children: ReactNode; weight?: FontWeight; color?: PaletteKey }) {
  const p = usePalette();
  return <RNText style={[font(weight), color ? { color: p[color] } : null]}>{children}</RNText>;
}

interface NamedProps {
  readonly children?: ReactNode;
  readonly color?: PaletteKey;
  readonly align?: 'left' | 'center' | 'right';
  readonly style?: StyleProp<TextStyle>;
  readonly testID?: string;
  readonly numberOfLines?: number;
}

/**
 * Display type (Bricolage 800, −3.5%): `size="L"` 44/46 (default; the welcome headline, the pod name in a band) or
 * `size="XL"` 56/58 (the pod name on the reveal field; `XL48` for "Thursday 18:00"). A header for screen readers.
 * Display type goes on Paper, white, tints or fields; on a field use `color` = the field's on-colour.
 */
export function Display({ size = 'L', ...props }: NamedProps & { size?: 'L' | 'XL' | 'XL52' | 'XL48' | 'XL40' }) {
  const variant = size === 'L' ? 'displayL' : size === 'XL' ? 'displayXL' : (`display${size}` as const);
  return <Text accessibilityRole="header" variant={variant} {...props} />;
}

/**
 * Title (Bricolage 30/32/800): screen titles (h1). `size="compact"` is 28 (long titles such as the consent screen),
 * `size="modal"` 26 (a full-screen form with a close button).
 */
export function Title({ size = 'default', ...props }: NamedProps & { size?: 'default' | 'compact' | 'modal' }) {
  const variant = size === 'compact' ? 'titleCompact' : size === 'modal' ? 'titleModal' : 'title';
  return <Text accessibilityRole="header" variant={variant} {...props} />;
}

/** Headline (Bricolage 22/26/700): a sheet title, a card question, an empty-state title, "3 of 5 said yes". */
export function Headline(props: NamedProps) {
  return <Text accessibilityRole="header" variant="headline" {...props} />;
}

/** A pod name in a row or card (Bricolage 18/22/800). Pass `color` = the pod's `name` colour on a tint. */
export function PodName(props: NamedProps) {
  return <Text variant="podName" {...props} />;
}

/** 15/22/700 section heading (h2). */
export function Heading(props: NamedProps) {
  return <Text accessibilityRole="header" variant="heading" {...props} />;
}

/** Body 16/24/400. `muted` uses the muted colour; `bold` sets it in 700. */
export function Body({ muted = false, bold = false, color, ...props }: NamedProps & { muted?: boolean; bold?: boolean }) {
  return <Text variant="body" weight={bold ? '700' : undefined} color={color ?? (muted ? 'textMuted' : 'text')} {...props} />;
}

/** 16/24 muted paragraph under a screen title. */
export function Lede({ color = 'textMuted', ...props }: NamedProps) {
  return <Text variant="lede" color={color} {...props} />;
}

/** Body 16/24 in the muted colour. */
export function Muted({ color = 'textMuted', ...props }: NamedProps) {
  return <Text variant="body" color={color} {...props} />;
}

/** 13/20 helper text and captions (muted by default); `strong` is the 13/18/600 label. */
export function Small({ color = 'textMuted', strong = false, ...props }: NamedProps & { strong?: boolean }) {
  return <Text variant={strong ? 'captionStrong' : 'caption'} color={color} {...props} />;
}

/** 15/22/700 field label or legend. */
export function Label(props: NamedProps) {
  return <Text variant="heading" {...props} />;
}

/** The eyebrow as a section label inside a card ("MEMBERS", "PLAN"): 12/16/800 caps, Muted. A header for screen readers. */
export function Overline({ color = 'textMuted', ...props }: NamedProps) {
  return <Text accessibilityRole="header" variant="overline" color={color} {...props} />;
}

/** Eyebrow 12/16/800 caps, +6%, Muted (NEXT STEP, PRIVATE INTERESTS). `compact` is kept for old call sites (same). */
export function Eyebrow({ color = 'textMuted', compact = false, ...props }: NamedProps & { compact?: boolean }) {
  return <Text variant={compact ? 'eyebrowCompact' : 'eyebrow'} color={color} {...props} />;
}

/** An error message, announced as an alert. */
export function ErrorText({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text accessibilityRole="alert" variant="smallStrong" color="danger" testID={testID}>
      {children}
    </Text>
  );
}
