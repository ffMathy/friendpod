/**
 * Shared building blocks in the storyboard look (tokens in ./theme). Every string they render is passed in by the
 * caller, already translated, including accessibility labels such as "Back" or "Close" (`common.back`,
 * `common.close`). Nothing here navigates on its own: pass `onBack={router.back}` and the like.
 *
 * Catalogue (props are documented on each):
 *   Layout      Screen, ScreenHeader, StepHeader, Spacer, Divider, OrDivider, Grabber
 *   Text        AppText, Title, Heading, Body, ErrorText, SectionTitle, IconLine
 *   Actions     Button, IconButton, TextLink, AddButton, ChipButton, ChipRow
 *   Choices     Toggle, Segmented, Checkbox, ChoiceRow, SwitchRow
 *   Input       Field
 *   Containers  Card, Banner, StatCard, ListGroup, Row, LinkRow
 *   Status      Pill, RemovableChip, ProgressBar, SegmentBar, Loading
 *   People      Avatar, AvatarStack
 *   Identity    Logo, HeroCircles (./brand), Icon (./icons)
 *
 * Inside a dark card (`Card tone="night" | "forest"`, `StatCard`) text and icons switch to the card's light colours
 * by themselves; tones "ink", "soft" and "muted" are remapped.
 */
import { Children, createContext, Fragment, useContext, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type HostInstance,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from './icons';
import {
  avatarFill,
  Fonts,
  Radius,
  Sizes,
  Spacing,
  Type,
  usePalette,
  type ColorName,
  type Palette,
  type TypeVariant,
} from './theme';

export { HeroCircles, Logo, type HeroCirclesProps, type LogoProps } from './brand';
export { Icon, ICON_NAMES, type IconName, type IconProps } from './icons';

// ---------------------------------------------------------------------------------------------------------------
// Dark-card context: text inside a night or forest card reads the card's light colours.

type Surface = 'night' | 'forest' | null;
const SurfaceContext = createContext<Surface>(null);

export type TextTone =
  | 'ink'
  | 'soft'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'danger'
  | 'violet'
  | 'amber'
  | 'mint'
  | 'coral'
  | 'onInk'
  | 'onAmber';

const TONE: Record<TextTone, ColorName> = {
  ink: 'ink',
  soft: 'inkSoft',
  muted: 'muted',
  faint: 'faint',
  accent: 'primary',
  danger: 'coralStrong',
  violet: 'violet',
  amber: 'amberText',
  mint: 'mintText',
  coral: 'coralText',
  onInk: 'onInk',
  onAmber: 'onAmber',
};

function toneColor(p: Palette, tone: TextTone, surface: Surface): string {
  if (surface === 'night') {
    if (tone === 'ink') return p.onNight;
    if (tone === 'soft') return p.nightSoft;
    if (tone === 'muted') return p.nightMuted;
    if (tone === 'amber') return p.amber;
  }
  if (surface === 'forest') {
    if (tone === 'ink') return p.onForest;
    if (tone === 'soft' || tone === 'muted') return p.forestMuted;
  }
  return p[TONE[tone]];
}

/** The ink colour for icons and text at this point of the tree (light inside dark cards). */
function useInk(): string {
  const p = usePalette();
  return toneColor(p, 'ink', useContext(SurfaceContext));
}

// ---------------------------------------------------------------------------------------------------------------
// Layout

export interface ScreenProps {
  readonly children: ReactNode;
  /** Scroll the content (default). `false` for screens that lay out their own list. */
  readonly scroll?: boolean;
  /** Pinned under the content and kept above the keyboard: the screen's main action(s) ("Continue", "Finish"). */
  readonly footer?: ReactNode;
  /** 24-pt side gutter (welcome, onboarding) instead of 20 (tabs, pods, settings). */
  readonly wide?: boolean;
  /** Space between children (default 16). */
  readonly gap?: number;
  /** Screen colour (default the ground). */
  readonly background?: 'ground' | 'surface';
  /** Extra content style, e.g. `{ paddingTop: 0 }`. */
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

/**
 * A screen on the ground colour with the storyboard gutters. The safe area applies only where the screen meets it, so
 * under a native header the top inset is 0, and with `headerShown: false` the content clears the status bar.
 * `<Spacer />` between content and the end pushes the rest down on short screens.
 */
export function Screen({ children, scroll = true, footer, wide = false, gap = Spacing.md, background = 'ground', contentStyle, testID }: ScreenProps) {
  const p = usePalette();
  const gutter = wide ? Spacing.gutterWide : Spacing.gutter;
  const content = [styles.content, { paddingHorizontal: gutter, gap }, contentStyle];
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={!footer}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, content]}>{children}</View>
  );
  return (
    <SafeAreaView testID={testID} style={[styles.flex, { backgroundColor: p[background] }]} edges={EDGES}>
      {footer ? (
        <KeyboardAware>
          {body}
          <View style={[styles.footer, { paddingHorizontal: gutter }]}>{footer}</View>
        </KeyboardAware>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** KeyboardAvoidingView measures itself against its parent only; this gives it its offset in the window (header). */
function KeyboardAware({ children }: { children: ReactNode }) {
  const frame = useRef<HostInstance>(null);
  const [offset, setOffset] = useState(0);
  return (
    <View ref={frame} style={styles.flex} onLayout={() => frame.current?.measureInWindow((_x, y) => setOffset(y))}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={offset}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

export interface ScreenHeaderProps {
  readonly title: string;
  /** 14-pt muted line under the title ("Voting closes Tuesday 18:00"). */
  readonly subtitle?: string;
  /** Icon before the subtitle (e.g. "clock"). */
  readonly subtitleIcon?: IconName;
  /** 14/600 muted line above the title ("Me", "You're on the list"). */
  readonly eyebrow?: string;
  /** Right-aligned 14/600 muted text on the title's baseline ("Week 46", "5 of 20"). */
  readonly meta?: string;
  /** Shows the 44-pt back chevron with this accessible name (key `common.back`); needs `onBack`. */
  readonly backLabel?: string;
  readonly onBack?: () => void;
  /** Shows a 44-pt close (×) button right of the title, for modal screens and sheets; needs `onClose`. */
  readonly closeLabel?: string;
  readonly onClose?: () => void;
  /** Title size: 'lg' 30 (default) · 'md' 26 (modal screens) · 'sm' 24 (sheets, pod page). */
  readonly size?: 'lg' | 'md' | 'sm';
  /** Back chevron, title and subtitle on one row (storyboard 3.4, the pod page). */
  readonly inline?: boolean;
  /** Anything else on the title row's right (e.g. an AvatarStack). */
  readonly right?: ReactNode;
  readonly testID?: string;
}

const TITLE_VARIANT = { lg: 'title', md: 'titleMd', sm: 'titleSm' } as const satisfies Record<string, TypeVariant>;

/**
 * The in-page header the storyboards use instead of a native bar: optional back chevron, big 800 title, optional
 * subtitle. Use it with `headerShown: false` on the route.
 */
export function ScreenHeader({
  title,
  subtitle,
  subtitleIcon,
  eyebrow,
  meta,
  backLabel,
  onBack,
  closeLabel,
  onClose,
  size = 'lg',
  inline = false,
  right,
  testID,
}: ScreenHeaderProps) {
  const p = usePalette();
  const back = backLabel && onBack ? <IconButton icon="chevronLeft" label={backLabel} onPress={onBack} style={styles.backButton} /> : null;
  const close = closeLabel && onClose ? <IconButton icon="close" label={closeLabel} onPress={onClose} style={styles.closeButton} /> : null;
  const sub = subtitle ? (
    <View style={styles.subtitleRow}>
      {subtitleIcon ? <Icon name={subtitleIcon} size={16} color={p.muted} /> : null}
      <AppText variant={inline ? 'caption' : 'bodySm'} tone="muted" style={styles.flexShrink}>
        {subtitle}
      </AppText>
    </View>
  ) : null;
  const heading = (
    <AppText accessibilityRole="header" variant={TITLE_VARIANT[size]} style={styles.flexShrink}>
      {title}
    </AppText>
  );

  if (inline) {
    return (
      <View testID={testID} style={styles.headerInline}>
        {back}
        <View style={styles.flex}>
          {heading}
          {sub}
        </View>
        {right}
        {close}
      </View>
    );
  }
  return (
    <View testID={testID} style={styles.header}>
      {back}
      <View style={styles.headerTitles}>
        {eyebrow ? (
          <AppText variant="bodySm" tone="muted" style={Fonts.semibold}>
            {eyebrow}
          </AppText>
        ) : null}
        <View style={[styles.titleRow, { alignItems: close || right ? 'center' : 'baseline' }]}>
          <View style={styles.flex}>{heading}</View>
          {meta ? (
            <AppText variant="bodySm" tone="muted" style={Fonts.semibold}>
              {meta}
            </AppText>
          ) : null}
          {right}
          {close}
        </View>
        {sub}
      </View>
    </View>
  );
}

export interface StepHeaderProps {
  /** 1-based step. */
  readonly step: number;
  readonly total: number;
  /** "Step 1 of 6", already formatted. */
  readonly stepLabel: string;
  readonly backLabel?: string;
  readonly onBack?: () => void;
}

/** Onboarding header (storyboards 1.2–1.7): back chevron, "Step n of 6" and a thin green progress bar. */
export function StepHeader({ step, total, stepLabel, backLabel, onBack }: StepHeaderProps) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepRow}>
        {backLabel && onBack ? (
          <IconButton icon="chevronLeft" label={backLabel} onPress={onBack} style={styles.backButton} />
        ) : (
          <View style={styles.touch} />
        )}
        <AppText variant="caption" tone="muted" style={Fonts.semibold}>
          {stepLabel}
        </AppText>
      </View>
      <ProgressBar progress={total > 0 ? step / total : 0} height={6} />
    </View>
  );
}

/** Flexible space (pushes what follows to the bottom of a Screen), or a fixed gap with `size`. */
export function Spacer({ size }: { size?: number }) {
  return <View style={size === undefined ? styles.flex : { height: size }} />;
}

/** A hairline divider. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.hairline, { backgroundColor: p.border }, style]} />;
}

/** Two lines with a word between them ("or", storyboard 1.3). */
export function OrDivider({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={styles.orRow}>
      <View style={[styles.orLine, { backgroundColor: p.border }]} />
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <View style={[styles.orLine, { backgroundColor: p.border }]} />
    </View>
  );
}

/** The 44×5 handle at the top of a bottom sheet (storyboards 2.3, 4.2). */
export function Grabber() {
  const p = usePalette();
  return <View accessible={false} style={[styles.grabber, { backgroundColor: p.borderStrong }]} />;
}

// ---------------------------------------------------------------------------------------------------------------
// Text

export interface AppTextProps extends Omit<TextProps, 'style'> {
  /** A preset from `Type` (default 'body', 16/400). */
  readonly variant?: TypeVariant;
  /** Colour role (default 'ink'); remapped inside dark cards. */
  readonly tone?: TextTone;
  /** A literal colour; wins over `tone`. */
  readonly color?: string;
  readonly align?: 'left' | 'center' | 'right';
  /** Extra style. Change weight with `Fonts.*`, never `fontWeight` (see theme.ts). */
  readonly style?: StyleProp<TextStyle>;
  readonly children?: ReactNode;
}

/** Text in the type scale: `<AppText variant="caption" tone="muted">…</AppText>`. */
export function AppText({ variant = 'body', tone = 'ink', color, align, style, ...rest }: AppTextProps) {
  const p = usePalette();
  const surface = useContext(SurfaceContext);
  return <Text {...rest} style={[Type[variant], { color: color ?? toneColor(p, tone, surface) }, align ? { textAlign: align } : null, style]} />;
}

/** The screen's h1: 'lg' 30/800 (default) · 'hero' 36 (welcome) · 'md' 26 · 'sm' 24. */
export function Title({ children, size = 'lg', align }: { children: ReactNode; size?: 'hero' | 'lg' | 'md' | 'sm'; align?: 'left' | 'center' }) {
  return (
    <AppText accessibilityRole="header" variant={size === 'hero' ? 'hero' : TITLE_VARIANT[size]} align={align}>
      {children}
    </AppText>
  );
}

/** A heading: 'lg' 22/800 (default) · 'md' 18/800 (card titles) · 'sm' 15/700 (section titles). */
export function Heading({ children, size = 'lg', tone }: { children: ReactNode; size?: 'lg' | 'md' | 'sm'; tone?: TextTone }) {
  const variant = size === 'lg' ? 'headline' : size === 'md' ? 'heading' : 'section';
  return (
    <AppText accessibilityRole="header" variant={variant} tone={tone}>
      {children}
    </AppText>
  );
}

export interface BodyProps {
  readonly children: ReactNode;
  readonly muted?: boolean;
  readonly bold?: boolean;
  /** 'lg' 16 (default) · 'md' 15 · 'sm' 14 · 'xs' 13; all at 1.5 line height. */
  readonly size?: 'lg' | 'md' | 'sm' | 'xs';
  /** Overrides `muted`. */
  readonly tone?: TextTone;
  readonly align?: 'left' | 'center';
  readonly testID?: string;
}

const BODY_VARIANT = { lg: 'body', md: 'bodyMd', sm: 'bodySm', xs: 'caption' } as const satisfies Record<string, TypeVariant>;

/** A paragraph. */
export function Body({ children, muted = false, bold = false, size = 'lg', tone, align, testID }: BodyProps) {
  return (
    <AppText testID={testID} variant={BODY_VARIANT[size]} tone={tone ?? (muted ? 'muted' : 'ink')} align={align} style={bold ? Fonts.bold : null}>
      {children}
    </AppText>
  );
}

/** An inline error (role alert), in the danger colour. */
export function ErrorText({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <AppText testID={testID} accessibilityRole="alert" variant="bodySm" tone="danger" style={Fonts.semibold}>
      {children}
    </AppText>
  );
}

export interface SectionTitleProps {
  readonly title: string;
  /** Muted suffix after a middle dot ("· 5 added", "· 1 of 2 active"). */
  readonly detail?: string;
  /** 'title' 15/700 (default) · 'overline' 13/700 uppercase, as on grouped lists. */
  readonly variant?: 'title' | 'overline';
  readonly tone?: 'default' | 'violet';
  readonly icon?: IconName;
  /** A text action on the right ("Edit"). */
  readonly action?: { readonly label: string; readonly onPress: () => void; readonly testID?: string };
}

/** A section heading above a group of content (role header). */
export function SectionTitle({ title, detail, variant = 'title', tone = 'default', icon, action }: SectionTitleProps) {
  const p = usePalette();
  const color = tone === 'violet' ? p.violet : variant === 'overline' ? p.muted : undefined;
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionTitle}>
        {icon ? <Icon name={icon} size={variant === 'overline' ? 14 : 18} color={color ?? p.ink} /> : null}
        <AppText accessibilityRole="header" variant={variant === 'overline' ? 'overline' : 'section'} color={color} style={styles.flexShrink}>
          {title}
          {detail ? (
            <AppText variant={variant === 'overline' ? 'overline' : 'section'} tone="muted" style={Fonts.medium}>
              {` · ${detail}`}
            </AppText>
          ) : null}
        </AppText>
      </View>
      {action ? <TextLink label={action.label} onPress={action.onPress} testID={action.testID} size="sm" /> : null}
    </View>
  );
}

/** A line of text with a leading icon (the proposal card's "5 people, ages 29–38"). */
export function IconLine({ icon, children, tone = 'ink', variant = 'bodyMd' }: { icon: IconName; children: ReactNode; tone?: TextTone; variant?: TypeVariant }) {
  const ink = useInk();
  const p = usePalette();
  return (
    <View style={styles.iconLine}>
      <Icon name={icon} size={20} color={tone === 'ink' ? ink : p[TONE[tone]]} style={styles.iconLineIcon} />
      <AppText variant={variant} tone={tone} style={styles.flexShrink}>
        {children}
      </AppText>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Actions

/**
 * 'primary' ink pill with white text: the screen's main action · 'accent' green: positive actions ("Continue" in
 * onboarding, "I'm in", "Share invite link") · 'secondary' white with a border · 'danger' filled coral (final delete)
 * · 'dangerSoft' coral tint (Delete account, Remove & withdraw) · 'violet' private-interest pods · 'ghost' text only
 * ("Continue without", "Cancel") · 'onDark' white on a night card ("Yes, I'm coming") · 'outlineOnDark'.
 */
export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger' | 'dangerSoft' | 'violet' | 'ghost' | 'onDark' | 'outlineOnDark';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  /** Minimum height: 'lg' 54 (default) · 'md' 48 · 'sm' 44 · 'xs' 40. Always a pill. */
  readonly size?: 'lg' | 'md' | 'sm' | 'xs';
  /** Leading icon. */
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly testID?: string;
  /** Accessible name when it should differ from the label. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  /** flexGrow in a row of buttons (the storyboards pair 1 with 1.4). */
  readonly flex?: number;
  /** Hug the label instead of stretching across a column. */
  readonly inline?: boolean;
}

interface Look {
  readonly bg: string;
  readonly fg: string;
  readonly border?: string;
}

function buttonLook(p: Palette, variant: ButtonVariant, inactive: boolean): Look {
  if (inactive) {
    if (variant === 'ghost') return { bg: 'transparent', fg: p.disabledText };
    if (variant === 'outlineOnDark') return { bg: 'transparent', fg: p.nightMuted, border: p.nightBorder };
    return { bg: p.disabledBg, fg: p.disabledText };
  }
  switch (variant) {
    case 'primary':
      return { bg: p.ink, fg: p.onInk };
    case 'accent':
      return { bg: p.primary, fg: p.onPrimary };
    case 'secondary':
      return { bg: p.surface, fg: p.ink, border: p.borderStrong };
    case 'danger':
      return { bg: p.coralStrong, fg: p.onCoralStrong };
    case 'dangerSoft':
      return { bg: p.coralBg, fg: p.coralText, border: p.coralBorder };
    case 'violet':
      return { bg: p.violet, fg: p.onViolet };
    case 'ghost':
      return { bg: 'transparent', fg: p.ink };
    case 'onDark':
      return { bg: p.onNight, fg: p.night };
    case 'outlineOnDark':
      return { bg: 'transparent', fg: p.onNight, border: p.nightBorder };
  }
}

const BUTTON_HEIGHT = { lg: Sizes.button, md: Sizes.buttonMd, sm: Sizes.buttonSm, xs: Sizes.buttonXs } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled = false,
  busy = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
  flex,
  inline = false,
}: ButtonProps) {
  const p = usePalette();
  const inactive = disabled || busy;
  const look = buttonLook(p, variant, disabled);
  const height = BUTTON_HEIGHT[size];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      // Compact pills (40 pt) still take a 44-pt touch.
      hitSlop={height < Sizes.touch ? (Sizes.touch - height) / 2 : undefined}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          borderRadius: height / 2,
          paddingHorizontal: size === 'lg' ? Spacing.ml : Spacing.md,
          backgroundColor: pressed && variant === 'accent' ? p.primaryPressed : pressed && (variant === 'secondary' || variant === 'ghost') ? p.subtle : look.bg,
          borderColor: look.border ?? 'transparent',
          borderWidth: look.border ? 1 : 0,
          opacity: pressed && variant !== 'accent' && variant !== 'secondary' && variant !== 'ghost' ? 0.85 : 1,
        },
        flex !== undefined && { flexGrow: flex, flexBasis: 0 },
        inline && styles.inline,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={20} color={look.fg} /> : null}
          <Text style={[size === 'lg' ? Type.button : size === 'md' ? styles.buttonMdText : Type.buttonSm, styles.centerText, { color: look.fg }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export interface IconButtonProps {
  readonly icon: IconName;
  /** Accessible name (required: the button has no visible text). */
  readonly label: string;
  readonly onPress: () => void;
  /** Touch target (default 44). */
  readonly size?: number;
  readonly iconSize?: number;
  readonly color?: string;
  /** 'plain' (default) · 'filled' green circle (chat send) · 'outline'. */
  readonly variant?: 'plain' | 'filled' | 'outline';
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** A round icon-only button: back chevron, close ×, send, overflow menu. */
export function IconButton({ icon, label, onPress, size = Sizes.touch, iconSize, color, variant = 'plain', disabled = false, testID, style }: IconButtonProps) {
  const p = usePalette();
  const ink = useInk();
  const fg = disabled ? p.faint : variant === 'filled' ? p.onPrimary : (color ?? ink);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={size < Sizes.touch ? (Sizes.touch - size) / 2 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        variant === 'filled' && { backgroundColor: disabled ? p.disabledBg : pressed ? p.primaryPressed : p.primary },
        variant === 'outline' && { borderWidth: 1, borderColor: p.borderStrong, backgroundColor: p.surface },
        variant !== 'filled' && pressed && { backgroundColor: p.subtle },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize ?? (variant === 'filled' ? 22 : 24)} color={fg} />
    </Pressable>
  );
}

export interface TextLinkProps {
  readonly label: string;
  readonly onPress: () => void;
  /** 'accent' green (default) · 'muted' ("Changed your mind? Leave this pod") · 'ink'. */
  readonly tone?: 'accent' | 'muted' | 'ink';
  /** 'md' 15/700 (default) · 'sm' 13–14/700 ("Open map", "Edit"). */
  readonly size?: 'md' | 'sm';
  readonly align?: 'start' | 'center';
  /** 'link' (default, opens a page) or 'button' (does something). */
  readonly role?: 'link' | 'button';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** A text-only link with a 44-pt touch target ("How matching works", "Why this pod?"). */
export function TextLink({ label, onPress, tone = 'accent', size = 'md', align = 'start', role = 'link', accessibilityLabel, testID }: TextLinkProps) {
  const p = usePalette();
  const color = tone === 'accent' ? p.primary : tone === 'muted' ? p.muted : p.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      // The 24-pt small link reaches the 44-pt touch target through its slop.
      hitSlop={size === 'sm' ? (Sizes.touch - 24) / 2 : undefined}
      style={({ pressed }) => [size === 'md' ? styles.textLink : styles.textLinkSm, align === 'center' ? styles.selfCenter : styles.selfStart, pressed && styles.pressed]}
    >
      <Text style={[size === 'md' ? Type.section : styles.linkSm, { color }]}>{label}</Text>
    </Pressable>
  );
}

export interface AddButtonProps {
  readonly label: string;
  /** Muted suffix ("(1 spot left)"). */
  readonly detail?: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly disabled?: boolean;
  readonly testID?: string;
}

/** The dashed "Suggest another time" button (storyboard 3.2). */
export function AddButton({ label, detail, onPress, icon = 'plus', disabled = false, testID }: AddButtonProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label} ${detail}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.addButton, { borderColor: p.dashed }, pressed && { backgroundColor: p.subtle }, disabled && styles.dim]}
    >
      <Icon name={icon} size={20} />
      <Text style={[Type.section, { color: p.ink }]}>
        {label}
        {detail ? <Text style={[Fonts.medium, { color: p.muted }]}>{` ${detail}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

export interface ChipButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly icon?: IconName;
  /** 'neutral' white with a border (default) · 'violet' ("Keep this private") · 'coral' ("Remove & withdraw") · 'accent'. */
  readonly tone?: 'neutral' | 'violet' | 'coral' | 'accent';
  /** Minimum height: 'sm' 34 · 'md' 36 (default) · 'lg' 40. Touch area is ≥ 44 either way. */
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disabled?: boolean;
  readonly testID?: string;
}

const CHIP_HEIGHT = { sm: 34, md: 36, lg: 40 } as const;

/** A compact action (role button): "+ løb" suggestions, "Remove", "Keep this private". */
export function ChipButton({ label, onPress, accessibilityLabel, icon, tone = 'neutral', size = 'md', disabled = false, testID }: ChipButtonProps) {
  const p = usePalette();
  const look =
    tone === 'violet'
      ? { bg: p.surface, fg: p.violet, border: p.violetBorder }
      : tone === 'coral'
        ? { bg: p.coralBg, fg: p.coralText, border: p.coralBorder }
        : tone === 'accent'
          ? { bg: p.primary, fg: p.onPrimary, border: p.primary }
          : { bg: p.surface, fg: p.ink, border: p.borderStrong };
  const height = CHIP_HEIGHT[size];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={(Sizes.touch - height) / 2}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { minHeight: height, borderRadius: height / 2, backgroundColor: look.bg, borderColor: look.border },
        pressed && styles.pressed,
        disabled && styles.dim,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={look.fg} /> : null}
      <Text style={[size === 'sm' ? styles.chipTextSm : Type.chip, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Wrapping row of chips, 8 apart. */
export function ChipRow({ children, gap = Spacing.sm }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.chipRow, { gap }]}>{children}</View>;
}

// ---------------------------------------------------------------------------------------------------------------
// Choices

export interface ToggleProps {
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
  readonly testID?: string;
  /** Fill when on: 'ink' (default, choices) · 'accent' (votes, availability) · 'violet'. */
  readonly tone?: 'ink' | 'accent' | 'violet';
  /** Minimum height: 'sm' 36 · 'md' 44 (default) · 'lg' 48. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** 'pill' (default) or 'rounded' (14-pt corners: the 1–5 rating, the availability grid). */
  readonly shape?: 'pill' | 'rounded';
  /** Share a row equally with its siblings. */
  readonly grow?: boolean;
  readonly icon?: IconName;
  /** Draw no text (availability grid cells); `accessibilityLabel` or `label` still names it. */
  readonly hideLabel?: boolean;
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
}

const TOGGLE_HEIGHT = { sm: 36, md: 44, lg: 48 } as const;

/**
 * A selectable chip (role switch, as before): ink fill and white text when on, white with a border when off. Used for
 * single and multiple choices: radius, language, vote Yes/No, rating.
 */
export function Toggle({
  label,
  value,
  onChange,
  testID,
  tone = 'ink',
  size = 'md',
  shape = 'pill',
  grow = false,
  icon,
  hideLabel = false,
  accessibilityLabel,
  disabled = false,
}: ToggleProps) {
  const p = usePalette();
  const fill = tone === 'accent' ? p.primary : tone === 'violet' ? p.violet : p.ink;
  const onFill = tone === 'accent' ? p.onPrimary : tone === 'violet' ? p.onViolet : p.onInk;
  const height = TOGGLE_HEIGHT[size];
  const fg = disabled ? p.disabledText : value ? onFill : p.ink;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.toggle,
        {
          minHeight: height,
          borderRadius: shape === 'pill' ? height / 2 : Radius.md,
          backgroundColor: value ? fill : p.surface,
          borderColor: value ? fill : p.borderStrong,
        },
        grow && styles.grow,
        pressed && styles.pressed,
        disabled && styles.dim,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      {hideLabel ? null : <Text style={[size === 'lg' ? styles.toggleTextLg : Type.buttonSm, styles.centerText, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export interface SegmentedOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

export interface SegmentedProps<T extends string> {
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T | null | undefined;
  readonly onChange: (value: T) => void;
  /** 'chips': equal-width chips 8 apart (default; "5 km 10 km 15 km 25 km") · 'track': segments in one bordered
   *  track (the welcome language switch). */
  readonly variant?: 'chips' | 'track';
  readonly tone?: ToggleProps['tone'];
  readonly size?: ToggleProps['size'];
  readonly shape?: ToggleProps['shape'];
}

/** One choice out of a few. Each option is a Toggle (role switch, checked = selected). */
export function Segmented<T extends string>({ options, value, onChange, variant = 'chips', tone, size, shape }: SegmentedProps<T>) {
  const p = usePalette();
  if (variant === 'track') {
    return (
      <View style={[styles.track, { backgroundColor: p.surface, borderColor: p.border }]}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={o.testID}
              accessibilityRole="switch"
              accessibilityLabel={o.accessibilityLabel ?? o.label}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o.value)}
              hitSlop={5}
              style={[styles.trackSegment, on && { backgroundColor: p.ink }]}
            >
              <Text style={[styles.trackText, { color: on ? p.onInk : p.muted }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={styles.segmentRow}>
      {options.map((o) => (
        <Toggle
          key={o.value}
          label={o.label}
          accessibilityLabel={o.accessibilityLabel}
          testID={o.testID}
          value={o.value === value}
          onChange={() => onChange(o.value)}
          tone={tone}
          size={size}
          shape={shape}
          grow
        />
      ))}
    </View>
  );
}

export interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly testID?: string;
  /** 'plain' (default) · 'card' white bordered box (the Art. 9 consent, storyboard 1.4). */
  readonly variant?: 'plain' | 'card';
  /** Muted line under the label. */
  readonly description?: string;
  /** Draw only the box (table cells such as "Was there"); `accessibilityLabel` or `label` names it. */
  readonly hideLabel?: boolean;
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
}

/** Starts unticked wherever consent is asked (EDPB 05/2020 §§93–96); the caller owns the state. */
export function Checkbox({ label, checked, onChange, testID, variant = 'plain', description, hideLabel = false, accessibilityLabel, disabled = false }: CheckboxProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={hideLabel ? 10 : undefined}
      style={({ pressed }) => [
        styles.checkRow,
        variant === 'card' && [styles.checkCard, { backgroundColor: p.surface, borderColor: p.border }],
        hideLabel && styles.checkBare,
        pressed && styles.pressed,
        disabled && styles.dim,
      ]}
    >
      <View style={[styles.box, { borderColor: checked ? p.primary : p.borderStrong, backgroundColor: checked ? p.primary : p.surface }]}>
        {checked ? <Icon name="check" size={18} strokeWidth={2.6} color={p.onPrimary} /> : null}
      </View>
      {hideLabel ? null : (
        <View style={styles.checkText}>
          <AppText variant="bodySm" style={[Fonts.semibold, styles.checkLabel]}>
            {label}
          </AppText>
          {description ? (
            <AppText variant="caption" tone="muted">
              {description}
            </AppText>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export interface ChoiceRowProps {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly description?: string;
  readonly testID?: string;
  /** 'radio' (default, one of many) or 'checkbox'. */
  readonly role?: 'radio' | 'checkbox';
}

/** A full-width option row with a radio dot; selected rows get a 2-pt green border (storyboard 4.3, report reasons). */
export function ChoiceRow({ label, selected, onPress, description, testID, role = 'radio' }: ChoiceRowProps) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceRow,
        { backgroundColor: pressed ? p.subtle : p.surface, borderColor: selected ? p.primary : p.border, borderWidth: selected ? 2 : 1, paddingHorizontal: selected ? 13 : 14 },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? p.primary : p.borderStrong }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: p.primary }]} /> : null}
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyMd" style={selected ? Fonts.semibold : null}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

export interface SwitchRowProps {
  readonly label: string;
  readonly description?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
  /** 'card' white bordered box (default, "Same-gender pods only") · 'plain' for a row inside a ListGroup. */
  readonly variant?: 'card' | 'plain';
}

/** A setting with an on/off switch (the native Switch, role switch, named by `label`). */
export function SwitchRow({ label, description, value, onChange, disabled = false, testID, variant = 'card' }: SwitchRowProps) {
  const p = usePalette();
  return (
    <Pressable
      accessible={false}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.switchRow, variant === 'card' && [styles.switchCard, { backgroundColor: p.surface, borderColor: p.border }]]}
    >
      <View style={styles.flex}>
        <AppText variant="bodyMd" style={Fonts.bold}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={description}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: p.borderStrong, true: p.primary }}
        thumbColor={p.surface}
        ios_backgroundColor={p.borderStrong}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Input

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly error?: string | null;
  /** Muted helper text under the input ("Only people in a confirmed pod with you see it."). */
  readonly hint?: string;
  /** Muted suffix after the label ("(optional)"). */
  readonly optionalLabel?: string;
  /** Right-aligned text on the label row ("52 / 140"), already formatted. */
  readonly counter?: string;
  /** Keep the label for screen readers only (the inline "Add an interest" field). */
  readonly hideLabel?: boolean;
  /** Minimum height: 'lg' 54 (default) · 'md' 50. Multiline fields grow from 96. */
  readonly size?: 'lg' | 'md';
  /** Icon inside the input on the left ("search"). */
  readonly leadingIcon?: IconName;
  /** Style of the outer column, e.g. `{ flex: 1 }` next to an Add button. */
  readonly containerStyle?: StyleProp<ViewStyle>;
}

/** A labelled text input: 15/700 label, white 14-radius box, 2-pt green border while focused. */
export function Field({
  label,
  error,
  hint,
  optionalLabel,
  counter,
  hideLabel = false,
  size = 'lg',
  leadingIcon,
  containerStyle,
  onFocus,
  onBlur,
  multiline,
  ...input
}: FieldProps) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const border = error ? p.coralStrong : focused ? p.primary : p.borderStrong;
  const height = size === 'lg' ? Sizes.input : Sizes.inputMd;
  return (
    <View style={[styles.field, containerStyle]}>
      {hideLabel ? null : (
        <View style={styles.labelRow}>
          <Text style={[Type.section, styles.flexShrink, { color: p.ink }]}>
            {label}
            {optionalLabel ? <Text style={[Fonts.medium, { color: p.muted }]}>{` ${optionalLabel}`}</Text> : null}
          </Text>
          {counter ? <Text style={[Type.caption, { color: p.muted }]}>{counter}</Text> : null}
        </View>
      )}
      <View style={styles.inputWrap}>
        {leadingIcon ? <Icon name={leadingIcon} size={20} color={p.muted} style={styles.inputIcon} /> : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={p.muted}
          selectionColor={p.primary}
          cursorColor={p.primary}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            multiline ? styles.inputMultiline : { minHeight: height },
            {
              color: p.ink,
              backgroundColor: p.surface,
              borderColor: border,
              borderWidth: focused || error ? 2 : 1,
              paddingLeft: (leadingIcon ? 44 : Spacing.md) - (focused || error ? 1 : 0),
              paddingRight: Spacing.md - (focused || error ? 1 : 0),
            },
          ]}
          {...input}
        />
      </View>
      {hint ? <Text style={[Type.caption, { color: p.muted }]}>{hint}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Containers

/**
 * 'surface' white with a border (default) · 'inset' ground-coloured note inside a card · 'mint' (pledge, Keep pod) ·
 * 'amber' (nudges, "Did you mean…") · 'coral' (danger) · 'violet' (private-interest notes) · 'violetOutline' (a
 * private-interest pod card) · 'night' dark ink card ("Next drop", "Next step") · 'forest' green hero ("Confirmed").
 */
export type CardTone = 'surface' | 'inset' | 'mint' | 'amber' | 'coral' | 'violet' | 'violetOutline' | 'night' | 'forest';

export interface CardProps {
  readonly children: ReactNode;
  readonly tone?: CardTone;
  /** Corners: 'md' 20 (default) · 'lg' 22 · 'xl' 28 (proposal and hero cards). */
  readonly radius?: 'md' | 'lg' | 'xl';
  /** Inner padding (default 16; hero cards use 22). */
  readonly padding?: number;
  /** Space between children (default 12). */
  readonly gap?: number;
  /** A 2-pt green border (the leading plan option). */
  readonly selected?: boolean;
  /** Makes the whole card pressable (role link unless `accessibilityRole` says otherwise). */
  readonly onPress?: () => void;
  readonly accessibilityRole?: 'link' | 'button';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
  readonly style?: StyleProp<ViewStyle>;
}

function cardLook(p: Palette, tone: CardTone): { bg: string; border?: string } {
  switch (tone) {
    case 'surface':
      return { bg: p.surface, border: p.border };
    case 'inset':
      return { bg: p.inset };
    case 'mint':
      return { bg: p.mint };
    case 'amber':
      return { bg: p.amberBg, border: p.amberBorder };
    case 'coral':
      return { bg: p.coralBg, border: p.coralBorder };
    case 'violet':
      return { bg: p.violetBg };
    case 'violetOutline':
      return { bg: p.surface, border: p.violetBorder };
    case 'night':
      return { bg: p.night };
    case 'forest':
      return { bg: p.forest };
  }
}

const CARD_RADIUS = { md: Radius.xl, lg: Radius.xxl, xl: Radius.heroLg } as const;

export function Card({
  children,
  tone = 'surface',
  radius = 'md',
  padding = Spacing.md,
  gap = Spacing.ms,
  selected = false,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  testID,
  style,
}: CardProps) {
  const p = usePalette();
  const look = cardLook(p, tone);
  const surface: Surface = tone === 'night' || tone === 'forest' ? tone : null;
  const border = selected ? { borderWidth: 2, borderColor: p.primary } : look.border ? { borderWidth: 1, borderColor: look.border } : null;
  const box = [styles.card, { backgroundColor: look.bg, borderRadius: CARD_RADIUS[radius], padding: selected ? padding - 1 : padding, gap }, border, style];
  return (
    <SurfaceContext.Provider value={surface}>
      {onPress ? (
        <Pressable
          testID={testID}
          accessibilityRole={accessibilityRole ?? 'link'}
          accessibilityLabel={accessibilityLabel}
          onPress={onPress}
          style={({ pressed }) => [box, pressed && styles.pressed]}
        >
          {children}
        </Pressable>
      ) : (
        <View testID={testID} accessibilityLabel={accessibilityLabel} style={box}>
          {children}
        </View>
      )}
    </SurfaceContext.Provider>
  );
}

export interface BannerProps {
  /** 'info' white with a border and an info icon (default) · 'subtle' ground-coloured note · 'mint' · 'amber' ·
   *  'coral' (safety, "In danger right now? Call 112.") · 'violet' (private interests). */
  readonly tone?: 'info' | 'subtle' | 'mint' | 'amber' | 'coral' | 'violet';
  /** Leading icon; 'info' defaults to "info". Pass null for none. */
  readonly icon?: IconName | null;
  /** Bold first line. */
  readonly title?: string;
  /** Body text (a string is styled for the tone) or custom content. */
  readonly children?: ReactNode;
  /** Buttons under the text, laid out in a row. */
  readonly actions?: ReactNode;
  /** 'alert' for warnings that appear in response to an action (the chat's "You haven't met yet"). */
  readonly accessibilityRole?: 'alert' | 'summary';
  readonly testID?: string;
}

/** An inline notice in one of the storyboard tones. */
export function Banner({ tone = 'info', icon, title, children, actions, accessibilityRole, testID }: BannerProps) {
  const p = usePalette();
  const look = {
    info: { bg: p.surface, border: p.border, fg: p.inkSoft, icon: p.muted },
    subtle: { bg: p.inset, border: undefined, fg: p.muted, icon: p.muted },
    mint: { bg: p.mint, border: undefined, fg: p.onMint, icon: p.primary },
    amber: { bg: p.amberBg, border: p.amberBorder, fg: p.amberInk, icon: p.amberText },
    coral: { bg: p.coralBg, border: p.coralBorder, fg: p.coralTextSoft, icon: p.coralText },
    violet: { bg: p.violetBg, border: undefined, fg: p.violetText, icon: p.violet },
  }[tone];
  const glyph = icon === undefined ? (tone === 'info' ? 'info' : null) : icon;
  const titleColor = tone === 'coral' ? p.coralTextSoft : tone === 'violet' ? p.violetText : tone === 'amber' ? p.amberInk : p.ink;
  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole}
      style={[styles.banner, { backgroundColor: look.bg, borderColor: look.border ?? look.bg, borderWidth: look.border ? 1 : 0 }]}
    >
      <View style={styles.bannerRow}>
        {glyph ? <Icon name={glyph} size={20} color={look.icon} /> : null}
        <View style={styles.bannerText}>
          {title ? <Text style={[Type.bodySm, Fonts.bold, { color: titleColor }]}>{title}</Text> : null}
          {typeof children === 'string' ? <Text style={[tone === 'info' || tone === 'subtle' ? Type.caption : Type.bodySm, { color: look.fg }]}>{children}</Text> : children}
        </View>
      </View>
      {actions ? <View style={styles.bannerActions}>{actions}</View> : null}
    </View>
  );
}

export interface StatCardProps {
  /** Amber uppercase label ("Odense waitlist"). */
  readonly label: string;
  /** The big number, already formatted ("<10", "137"). */
  readonly value: string;
  /** Muted text after the number ("of 250"). */
  readonly suffix?: string;
  /** 0–1: draws the amber progress bar. */
  readonly progress?: number;
  /** Accessible name and value of the progress bar (role progressbar). */
  readonly progressLabel?: string;
  readonly progressValue?: { readonly min: number; readonly max: number; readonly now: number };
  readonly progressTestID?: string;
  /** Text under the bar (a string is styled; nodes inherit the dark-card colours). */
  readonly children?: ReactNode;
  readonly testID?: string;
}

/** The dark counter card of the waitlist (storyboard 1.8). */
export function StatCard({ label, value, suffix, progress, progressLabel, progressValue, progressTestID, children, testID }: StatCardProps) {
  const p = usePalette();
  return (
    <Card tone="night" radius="xl" padding={22} gap={14} testID={testID} style={styles.statCard}>
      <Text accessibilityRole="header" style={[Type.overlineStrong, { color: p.amber }]}>
        {label}
      </Text>
      <Text>
        <Text style={[Type.counter, { color: p.onNight }]}>{value}</Text>
        {suffix ? <Text style={[styles.statSuffix, { color: p.nightMuted }]}>{`  ${suffix}`}</Text> : null}
      </Text>
      {progress !== undefined ? (
        <ProgressBar
          progress={progress}
          tone="amber"
          track="night"
          height={10}
          accessibilityLabel={progressLabel}
          accessibilityValue={progressValue}
          testID={progressTestID}
        />
      ) : null}
      {typeof children === 'string' ? <Text style={[Type.bodySm, { color: p.nightSoft }]}>{children}</Text> : children}
    </Card>
  );
}

export interface ListGroupProps {
  readonly children: ReactNode;
  /** Overline label at the top ("What you've agreed to"). */
  readonly title?: string;
  readonly titleIcon?: IconName;
  /** 'violet' border and label for private interests. */
  readonly tone?: 'default' | 'violet';
  readonly testID?: string;
}

const GroupContext = createContext(false);

/** A white grouped list (radius 20) with hairlines between its rows (storyboards 5.2, 5.3, 3.4 Members). */
export function ListGroup({ children, title, titleIcon, tone = 'default', testID }: ListGroupProps) {
  const p = usePalette();
  const items = Children.toArray(children);
  return (
    <View testID={testID} style={[styles.group, { backgroundColor: p.surface, borderColor: tone === 'violet' ? p.violetBorder : p.border }]}>
      {title ? (
        <View style={styles.groupTitle}>
          <SectionTitle title={title} variant="overline" tone={tone === 'violet' ? 'violet' : 'default'} icon={titleIcon} />
        </View>
      ) : null}
      <GroupContext.Provider value>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={[styles.hairline, { backgroundColor: p.divider }]} /> : null}
            {child}
          </Fragment>
        ))}
      </GroupContext.Provider>
    </View>
  );
}

export interface RowProps {
  readonly title: string;
  /** Muted second line ("1 interest, consent given"). */
  readonly subtitle?: string;
  /** Leading 20-pt icon. */
  readonly icon?: IconName;
  /** Leading element instead of an icon (an Avatar). */
  readonly leading?: ReactNode;
  /** Trailing element (a Pill, a status text, a ChipButton). */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** Right chevron; default: shown when pressable without `trailing`. */
  readonly chevron?: boolean;
  /** Default 'button' when pressable. */
  readonly accessibilityRole?: 'link' | 'button';
  readonly accessibilityLabel?: string;
  /** 'danger' colours the title coral. */
  readonly tone?: 'default' | 'danger';
  /** 'plain' (default; hairline under it unless inside a ListGroup) · 'card' standalone bordered row (radius 16). */
  readonly variant?: 'plain' | 'card';
  readonly disabled?: boolean;
  readonly testID?: string;
}

/** A list row: optional icon or avatar, title and subtitle, trailing element or chevron (min height 56). */
export function Row({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  onPress,
  chevron,
  accessibilityRole,
  accessibilityLabel,
  tone = 'default',
  variant = 'plain',
  disabled = false,
  testID,
}: RowProps) {
  const p = usePalette();
  const inGroup = useContext(GroupContext);
  const showChevron = chevron ?? (onPress !== undefined && trailing === undefined);
  const titleColor = tone === 'danger' ? p.coralText : p.ink;
  const content = (
    <>
      {icon ? <Icon name={icon} size={22} color={tone === 'danger' ? p.coralText : p.ink} /> : null}
      {leading}
      <View style={styles.rowText}>
        <Text style={[subtitle ? Type.rowTitle : styles.rowTitleSingle, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[Type.caption, { color: p.muted }]}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={20} color={p.muted} /> : null}
    </>
  );
  const box = [
    styles.row,
    variant === 'card' && [styles.rowCard, { backgroundColor: p.surface, borderColor: p.borderStrong }],
    variant === 'plain' && !inGroup && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: p.border },
  ];
  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={box}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [box, pressed && { backgroundColor: variant === 'card' ? p.subtle : p.inset }]}
    >
      {content}
    </Pressable>
  );
}

export interface LinkRowProps {
  readonly label: string;
  readonly onPress: () => void;
  /** Muted line under the label. */
  readonly detail?: string;
  readonly icon?: IconName;
  readonly variant?: RowProps['variant'];
  readonly testID?: string;
  readonly accessibilityLabel?: string;
}

/** A row that opens another page (role link) with a chevron. Its accessible name is the label, then the detail. */
export function LinkRow({ label, onPress, detail, icon, variant, testID, accessibilityLabel }: LinkRowProps) {
  return (
    <Row
      title={label}
      subtitle={detail}
      icon={icon}
      onPress={onPress}
      chevron
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      variant={variant}
      testID={testID}
    />
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Status

export interface PillProps {
  readonly label: string;
  /** 'neutral' white with a border ("18+ only") · 'amber' ("Next drop", "New pod", "3 new") · 'mint' ("You're in",
   *  interest chips) · 'violet' ("Private interest") · 'coral' · 'ink'. */
  readonly tone?: 'neutral' | 'amber' | 'mint' | 'violet' | 'coral' | 'ink';
  readonly icon?: IconName;
  /** Height: 'sm' 24 · 'md' 28 (default) · 'lg' 30. */
  readonly size?: 'sm' | 'md' | 'lg';
  /** 'strong' 800 (badges, default) · 'regular' 600 (interest chips). */
  readonly weight?: 'strong' | 'regular';
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

const PILL_HEIGHT = { sm: 24, md: 28, lg: 30 } as const;

/** A static badge or tag. */
export function Pill({ label, tone = 'neutral', icon, size = 'md', weight = 'strong', accessibilityLabel, testID }: PillProps) {
  const p = usePalette();
  const look = {
    neutral: { bg: p.surface, fg: p.ink, border: p.border },
    amber: { bg: p.amber, fg: p.onAmber, border: undefined },
    mint: { bg: p.mint, fg: p.mintText, border: undefined },
    violet: { bg: p.violetBg, fg: p.violet, border: undefined },
    coral: { bg: p.coralBg, fg: p.coralText, border: p.coralBorder },
    ink: { bg: p.ink, fg: p.onInk, border: undefined },
  }[tone];
  const height = PILL_HEIGHT[size];
  // The outer row keeps the pill at its content width in a column, and lets a row parent centre it.
  return (
    <View style={styles.hug}>
      <View
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.pill,
          { minHeight: height, borderRadius: height / 2, backgroundColor: look.bg, paddingHorizontal: size === 'sm' ? 8 : weight === 'regular' ? 10 : 12 },
          look.border ? { borderWidth: 1, borderColor: look.border } : null,
        ]}
      >
        {icon ? <Icon name={icon} size={size === 'sm' ? 12 : 14} color={look.fg} strokeWidth={2.4} /> : null}
        <Text style={[size === 'sm' ? styles.pillTextSm : styles.pillText, weight === 'regular' ? Fonts.semibold : Fonts.extrabold, { color: look.fg }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export interface RemovableChipProps {
  readonly label: string;
  readonly onRemove: () => void;
  /** Accessible name of the × ("Remove brætspil"). */
  readonly removeLabel: string;
  /** 'ink' (default) · 'violet' (a private interest). */
  readonly tone?: 'ink' | 'violet';
  /** Leading icon ("starFilled", "lock"). */
  readonly icon?: IconName;
  /** Tapping the chip itself (e.g. to change its privacy); name it with `accessibilityLabel`. */
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** A filled chip with a remove button (storyboard 1.5, "Your interests"). */
export function RemovableChip({ label, onRemove, removeLabel, tone = 'ink', icon, onPress, accessibilityLabel, testID }: RemovableChipProps) {
  const p = usePalette();
  const bg = tone === 'violet' ? p.violet : p.ink;
  const fg = tone === 'violet' ? p.onViolet : p.onInk;
  return (
    <View testID={testID} style={[styles.removable, { backgroundColor: bg }]}>
      <Pressable
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={accessibilityLabel ?? label}
        disabled={!onPress}
        onPress={onPress}
        style={styles.removableBody}
      >
        {icon ? <Icon name={icon} size={14} color={fg} /> : null}
        <Text style={[Type.chip, { color: fg }]}>{label}</Text>
      </Pressable>
      <IconButton icon="close" label={removeLabel} onPress={onRemove} size={28} iconSize={16} color={fg} />
    </View>
  );
}

export interface ProgressBarProps {
  /** 0–1. */
  readonly progress: number;
  /** Fill: 'accent' green (default) · 'amber'. */
  readonly tone?: 'accent' | 'amber';
  /** Track: 'default' border grey · 'night' (on a dark card). */
  readonly track?: 'default' | 'night';
  readonly height?: number;
  /** Set to expose it as a progressbar to screen readers; otherwise it is decorative. */
  readonly accessibilityLabel?: string;
  readonly accessibilityValue?: { readonly min?: number; readonly max?: number; readonly now?: number; readonly text?: string };
  readonly testID?: string;
}

export function ProgressBar({ progress, tone = 'accent', track = 'default', height = 8, accessibilityLabel, accessibilityValue, testID }: ProgressBarProps) {
  const p = usePalette();
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'progressbar' as const, accessibilityLabel, accessibilityValue }
    : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const };
  return (
    <View
      testID={testID}
      {...a11y}
      style={[styles.progressTrack, { height, borderRadius: height / 2, backgroundColor: track === 'night' ? p.nightTrack : p.border }]}
    >
      <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: tone === 'amber' ? p.amber : p.primary }} />
    </View>
  );
}

/** "3 of 5 said yes": one segment per seat, the first `filled` in green (storyboard 2.4). Decorative unless labelled. */
export function SegmentBar({ total, filled, accessibilityLabel }: { total: number; filled: number; accessibilityLabel?: string }) {
  const p = usePalette();
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={styles.segmentBar}
    >
      {Array.from({ length: Math.max(0, total) }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < filled ? p.primary : p.border }]} />
      ))}
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.center, { backgroundColor: p.ground }]}>
      <ActivityIndicator accessibilityLabel={label} color={p.primary} />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// People

export interface AvatarProps {
  /** The member's first name; its first letter is drawn, and it seeds the colour without a uid. */
  readonly name: string;
  /** Seeds the fill so a member keeps one colour everywhere. */
  readonly uid?: string;
  /** Diameter (default 32; storyboards use 28, 32, 44, 52, 64). */
  readonly size?: number;
  /** The viewer: ink fill with `label` (e.g. t('chat.you')) instead of an initial. */
  readonly you?: boolean;
  /** Text instead of the initial. */
  readonly label?: string;
  /** A photo (e.g. expo-image) that replaces the initial; it is clipped to the circle. */
  readonly children?: ReactNode;
  /** A 2-pt ring in the surface colour, for overlapping stacks; or a colour for rings on dark cards. */
  readonly ring?: boolean | string;
  /** An empty dashed seat (a member not revealed yet). */
  readonly placeholder?: boolean;
  /** Set to expose the avatar to screen readers; avatars next to a visible name stay hidden. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** A coloured circle with the member's initial, or their photo. */
export function Avatar({ name, uid, size = 32, you = false, label, children, ring, placeholder = false, accessibilityLabel, testID }: AvatarProps) {
  const p = usePalette();
  const fill = avatarFill(uid ?? name);
  const bg = placeholder ? p.subtle : you ? p.ink : fill.bg;
  const fg = you ? p.onInk : fill.fg;
  const text = label ?? Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '';
  const ringColor = typeof ring === 'string' ? ring : p.surface;
  const fontSize = Math.max(9, Math.round(size * (label && label.length > 1 ? 0.3 : 0.36)));
  const a11y = accessibilityLabel
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel }
    : { accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };
  return (
    <View
      testID={testID}
      {...a11y}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring ? { borderWidth: 2, borderColor: ringColor } : null,
        placeholder ? { borderWidth: 2, borderStyle: 'dashed', borderColor: p.dashed } : null,
      ]}
    >
      {placeholder ? null : children ? (
        <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, overflow: 'hidden' }]}>{children}</View>
      ) : (
        <Text allowFontScaling={false} style={[Fonts.extrabold, { fontSize, color: fg }]}>
          {text}
        </Text>
      )}
    </View>
  );
}

export interface AvatarStackMember {
  readonly key: string;
  readonly name: string;
  readonly uid?: string;
  readonly you?: boolean;
  readonly label?: string;
  readonly photo?: ReactNode;
}

export interface AvatarStackProps {
  readonly members: readonly AvatarStackMember[];
  /** Diameter (default 32). */
  readonly size?: number;
  /** Show at most this many. */
  readonly max?: number;
  /** Ring colour between avatars; default the surface (white). */
  readonly ringColor?: string;
  readonly accessibilityLabel?: string;
}

/** Overlapping avatars with white rings (pod rows, plan votes, the chat header). */
export function AvatarStack({ members, size = 32, max, ringColor, accessibilityLabel }: AvatarStackProps) {
  const shown = max === undefined ? members : members.slice(0, max);
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
      style={styles.stack}
    >
      {shown.map((m, i) => (
        <View key={m.key} style={i > 0 ? { marginLeft: -Math.round(size * 0.3) } : null}>
          <Avatar name={m.name} uid={m.uid} you={m.you} label={m.label} size={size} ring={ringColor ?? true}>
            {m.photo}
          </Avatar>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  grow: { flexGrow: 1, flexBasis: 0 },
  inline: { alignSelf: 'flex-start' },
  selfStart: { alignSelf: 'flex-start' },
  selfCenter: { alignSelf: 'center' },
  centerText: { textAlign: 'center' },
  pressed: { opacity: 0.75 },
  dim: { opacity: 0.5 },
  touch: { width: Sizes.touch, height: Sizes.touch },
  content: { flexGrow: 1, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  footer: { paddingTop: Spacing.ms, paddingBottom: Spacing.md, gap: Spacing.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  // Legacy text styles (kept for screens that still read them).
  title: Type.title,
  heading: Type.headline,
  body: Type.body,
  bold: Fonts.bold,
  label: Type.caption,
  // Header
  header: { gap: Spacing.xs },
  headerTitles: { gap: Spacing.xs },
  headerInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  titleRow: { flexDirection: 'row', gap: Spacing.sm },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButton: { marginLeft: -10 },
  closeButton: { marginRight: -10, alignSelf: 'center' },
  stepHeader: { gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hairline: { height: StyleSheet.hairlineWidth },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.ms },
  orLine: { flex: 1, height: 1 },
  grabber: { width: 44, height: 5, borderRadius: 3, alignSelf: 'center' },
  // Text
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  iconLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconLineIcon: { marginTop: 1 },
  // Actions
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  buttonMdText: { ...Fonts.bold, fontSize: 15, lineHeight: 20 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  textLink: { minHeight: Sizes.touch, justifyContent: 'center' },
  textLinkSm: { minHeight: 24, justifyContent: 'center' }, // keep in sync with TextLink's hitSlop
  linkSm: { ...Fonts.bold, fontSize: 13, lineHeight: 18 },
  addButton: {
    minHeight: Sizes.button,
    borderRadius: Radius.xxl,
    borderWidth: 2,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.ms,
  },
  chip: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.ms, paddingVertical: 6 },
  chipTextSm: { ...Fonts.bold, fontSize: 12, lineHeight: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  // Choices
  toggle: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6 },
  toggleTextLg: { ...Fonts.extrabold, fontSize: 17, lineHeight: 22 },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  track: { flexDirection: 'row', borderWidth: 1, borderRadius: 20, padding: 3, alignSelf: 'flex-start' },
  trackSegment: { minHeight: 34, borderRadius: 17, paddingHorizontal: Spacing.ms, alignItems: 'center', justifyContent: 'center' },
  trackText: { ...Fonts.semibold, fontSize: 13, lineHeight: 18 },
  checkRow: { flexDirection: 'row', gap: Spacing.ms, alignItems: 'flex-start', minHeight: Sizes.touch, paddingVertical: Spacing.xs },
  checkCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.ms },
  checkBare: { minHeight: 0, paddingVertical: 0, alignSelf: 'center' },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { lineHeight: 20 },
  box: { width: 24, height: 24, borderWidth: 2, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center' },
  choiceRow: { minHeight: 48, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.ms, paddingVertical: 10 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.ms, minHeight: 56 },
  switchCard: { borderWidth: 1, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 14 },
  // Input
  field: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
  inputWrap: { justifyContent: 'center' },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  /** Also read by the chat Composer: a bordered 14-radius input. */
  input: { ...Type.input, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: Spacing.ms },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', fontSize: 15, lineHeight: 22 },
  // Containers
  card: { overflow: 'hidden' },
  statCard: { borderRadius: Radius.hero },
  statSuffix: { ...Fonts.regular, fontSize: 18, lineHeight: 24 },
  banner: { borderRadius: Radius.lg, paddingVertical: Spacing.ms, paddingHorizontal: 14, gap: 10 },
  bannerRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bannerText: { flex: 1, gap: 2 },
  bannerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  group: { borderWidth: 1, borderRadius: Radius.xl, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  groupTitle: { marginTop: 10, marginBottom: 2 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.ms, paddingVertical: 10 },
  rowCard: { borderWidth: 1, borderRadius: Radius.lg, minHeight: 48, paddingHorizontal: Spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowTitleSingle: { ...Fonts.semibold, fontSize: 15, lineHeight: 21 },
  // Status
  hug: { flexDirection: 'row' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillText: { fontSize: 13, lineHeight: 18 },
  pillTextSm: { fontSize: 12, lineHeight: 16 },
  removable: { flexDirection: 'row', alignItems: 'center', minHeight: 36, borderRadius: 18, paddingLeft: Spacing.ms, paddingRight: Spacing.xs },
  removableBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  progressTrack: { overflow: 'hidden', width: '100%' },
  segmentBar: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 10, borderRadius: 5 },
  // People
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stack: { flexDirection: 'row' },
});
