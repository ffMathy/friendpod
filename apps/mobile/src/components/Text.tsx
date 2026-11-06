/**
 * Text primitives. All type goes through `Text` (a variant from the storyboard type scale, a palette colour, an
 * optional weight that swaps the font family). Never pass `fontWeight` in a style.
 */
import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { font, typeStyle, usePalette, type FontWeight, type PaletteKey, type TypeVariant } from './theme';

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** A type-scale variant (default `body`: 15/400/1.5). */
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

/** 36/800, the welcome headline. A header for screen readers. */
export function Display(props: NamedProps) {
  return <Text accessibilityRole="header" variant="display" {...props} />;
}

/**
 * 30/800 screen title (h1). `size="compact"` is 28 (long titles such as the consent screen), `size="modal"` 26
 * (a full-screen form with a close button).
 */
export function Title({ size = 'default', ...props }: NamedProps & { size?: 'default' | 'compact' | 'modal' }) {
  const variant = size === 'compact' ? 'titleCompact' : size === 'modal' ? 'titleModal' : 'title';
  return <Text accessibilityRole="header" variant={variant} {...props} />;
}

/** 24/800, a sheet title or an empty-state title. */
export function Headline(props: NamedProps) {
  return <Text accessibilityRole="header" variant="headline" {...props} />;
}

/** 15/700 section heading (h2). */
export function Heading(props: NamedProps) {
  return <Text accessibilityRole="header" variant="heading" {...props} />;
}

/** 15/400/1.5 body text. `muted` uses the muted colour; `bold` sets it in 700. */
export function Body({ muted = false, bold = false, color, ...props }: NamedProps & { muted?: boolean; bold?: boolean }) {
  return <Text variant="body" weight={bold ? '700' : undefined} color={color ?? (muted ? 'textMuted' : 'text')} {...props} />;
}

/** 16/400/1.5 muted paragraph under a screen title. */
export function Lede({ color = 'textMuted', ...props }: NamedProps) {
  return <Text variant="lede" color={color} {...props} />;
}

/** 15/400/1.5 in the muted colour. */
export function Muted({ color = 'textMuted', ...props }: NamedProps) {
  return <Text variant="body" color={color} {...props} />;
}

/** 13/400/1.5 helper text and captions (muted by default). */
export function Small({ color = 'textMuted', strong = false, ...props }: NamedProps & { strong?: boolean }) {
  return <Text variant={strong ? 'captionStrong' : 'caption'} color={color} {...props} />;
}

/** 15/700 field label or legend. */
export function Label(props: NamedProps) {
  return <Text variant="heading" {...props} />;
}

/** 13/700 uppercase label inside a card ("WHAT YOU'VE AGREED TO"). A header for screen readers. */
export function Overline({ color = 'textMuted', ...props }: NamedProps) {
  return <Text accessibilityRole="header" variant="overline" color={color} {...props} />;
}

/** 13/800 uppercase eyebrow on a dark card, in the accent colour. */
export function Eyebrow({ color = 'accent', compact = false, ...props }: NamedProps & { compact?: boolean }) {
  return <Text variant={compact ? 'eyebrowCompact' : 'eyebrow'} color={color} {...props} />;
}

/** An error message, announced as an alert. */
export function ErrorText({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text accessibilityRole="alert" variant="smallStrong" color="dangerText" testID={testID}>
      {children}
    </Text>
  );
}
