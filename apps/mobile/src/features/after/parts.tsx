/**
 * Building blocks of the after-the-meetup screens (after-feedback, after-member, after-report storyboards): the top
 * padding of a page that draws its own header, the bottom sheet over a dimmed backdrop, the member sheet's action
 * rows (Block, Report), the feedback grid's checkboxes and private Yes / No "meet again" answer, and the report's
 * free-text field.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Icon, Text, type IconName } from '@/components/ui';
import { BorderWidth, Layout, Radius, Size, typeStyle, usePalette, type PaletteKey } from '@/components/theme';

/**
 * Top padding of a page that draws its own header: the storyboards leave 32 px above it. Under a status bar the
 * safe-area inset already gives most of that room, so the page adds only what is missing.
 */
export function useTopPadding(storyboardTop = 32): number {
  const insets = useSafeAreaInsets();
  return Math.max(8, storyboardTop - insets.top);
}

/**
 * The member sheet's frame (after-member): a dimmed backdrop that closes on tap, and a white panel at the bottom
 * with rounded top corners and a handle. The panel scrolls when its content is taller than the screen allows.
 */
export function BottomSheet({ children, onClose, testID }: { children: ReactNode; onClose: () => void; testID?: string }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.frame} testID={testID}>
      {/* The close cross is the accessible way out; the backdrop is a shortcut for touch only. */}
      <Pressable onPress={onClose} accessible={false} importantForAccessibility="no" style={[styles.backdrop, { backgroundColor: p.scrim }]} />
      <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: p.surface }]}>
        <View style={[styles.handle, { backgroundColor: p.borderStrong }]} accessible={false} importantForAccessibility="no" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.panelContent, { paddingBottom: Math.max(insets.bottom, Layout.bottom) }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </View>
  );
}

type ActionTone = 'neutral' | 'danger';

const ACTION_TONES: Record<ActionTone, { bg: PaletteKey; border: PaletteKey; title: PaletteKey; body: PaletteKey; icon: PaletteKey }> = {
  neutral: { bg: 'surface', border: 'borderStrong', title: 'text', body: 'textMuted', icon: 'text' },
  danger: { bg: 'dangerBg', border: 'dangerBorder', title: 'dangerText', body: 'dangerInk', icon: 'dangerText' },
};

export interface ActionRowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
  readonly onPress: () => void;
  /** `neutral` white with the input border ("Block Jonas"), `danger` red tint ("Report Jonas"). */
  readonly tone?: ActionTone;
  readonly disabled?: boolean;
  readonly testID?: string;
}

/** A member action (after-member): icon, 16/700 title and a 13 px line under it, in a r18 row of at least 56 px. */
export function ActionRow({ icon, title, body, onPress, tone = 'neutral', disabled = false, testID }: ActionRowProps) {
  const p = usePalette();
  const c = ACTION_TONES[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: p[c.bg], borderColor: p[c.border], opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Icon name={icon} size={22} color={p[c.icon]} />
      <View style={styles.actionText}>
        <Text variant="button" color={c.title}>
          {title}
        </Text>
        <Text variant="caption" color={c.body} style={styles.actionBody}>
          {body}
        </Text>
      </View>
    </Pressable>
  );
}

export type MeetAgain = 'yes' | 'no';

export interface MeetAgainChoiceProps {
  readonly value: MeetAgain | undefined;
  /** `undefined` clears the answer (no answer is a valid choice, §3.6). */
  readonly onChange: (value: MeetAgain | undefined) => void;
  readonly yesLabel: string;
  readonly noLabel: string;
  /** Read by screen readers: "Yes, meet Mette again". */
  readonly yesAccessibilityLabel: string;
  readonly noAccessibilityLabel: string;
  readonly testID?: string;
}

/**
 * The "Meet again" cell of the feedback grid: Yes and No side by side, 36 × 36 each with a 4 px gap, so the pair
 * fills the storyboard's 76 px column. Each is 44 × 44 to the touch: the slop reaches outwards (into the column gap
 * and the card padding), never into the other answer. Tapping the chosen answer again clears it, so "no answer"
 * stays possible (§3.6 yes / no / skip). Yes is brand green, No near-black.
 */
export function MeetAgainChoice({ value, onChange, yesLabel, noLabel, yesAccessibilityLabel, noAccessibilityLabel, testID }: MeetAgainChoiceProps) {
  const options: readonly { answer: MeetAgain; label: string; a11y: string; bg: PaletteKey; fg: PaletteKey }[] = [
    { answer: 'yes', label: yesLabel, a11y: yesAccessibilityLabel, bg: 'primary', fg: 'onPrimary' },
    { answer: 'no', label: noLabel, a11y: noAccessibilityLabel, bg: 'ink', fg: 'onInk' },
  ];
  const p = usePalette();
  const vertical = (Size.hitTarget - ANSWER_SIZE) / 2;
  const inner = MEET_AGAIN_GAP / 2;
  const outer = Size.hitTarget - ANSWER_SIZE - inner;
  return (
    <View style={styles.meetAgain}>
      {options.map((o) => {
        const selected = value === o.answer;
        return (
          <Pressable
            key={o.answer}
            testID={testID ? `${testID}-${o.answer}` : undefined}
            accessibilityRole="radio"
            accessibilityLabel={o.a11y}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? undefined : o.answer)}
            hitSlop={{ top: vertical, bottom: vertical, left: o.answer === 'yes' ? outer : inner, right: o.answer === 'yes' ? inner : outer }}
            style={({ pressed }) => [
              styles.answer,
              selected ? { backgroundColor: p[o.bg] } : { backgroundColor: p.surface, borderWidth: BorderWidth.hairline, borderColor: p.borderStrong },
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text variant="captionBold" color={selected ? o.fg : 'text'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One Yes / No answer: 36 px square. */
const ANSWER_SIZE = 36;
const MEET_AGAIN_GAP = 4;
/** Width of the "Meet again" column (the storyboard's 76 px): two 36 px answers and a 4 px gap. */
export const MEET_AGAIN_WIDTH = ANSWER_SIZE * 2 + MEET_AGAIN_GAP;

/**
 * The storyboard's checkbox square (a native checkbox with the brand accent): r = size / 6 (4 px at 24), a bold
 * white check that nearly fills the box when checked; white with a 1.5 px muted border when not. Decorative: the
 * pressable around it carries the role, label and state.
 */
function CheckSquare({ size, checked }: { size: number; checked: boolean }) {
  const p = usePalette();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.square,
        { width: size, height: size, borderRadius: size / 6 },
        checked ? { backgroundColor: p.primary } : { backgroundColor: p.surface, borderWidth: 1.5, borderColor: p.textMuted },
      ]}
    >
      {checked ? (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d={CHECK_PATH} stroke={p.onPrimary} strokeWidth={3.2} fill="none" strokeLinecap="butt" strokeLinejoin="miter" />
        </Svg>
      ) : null}
    </View>
  );
}

/** The check of a native checkbox on a 24 grid: about 16 × 12, nearly filling the box. */
const CHECK_PATH = 'M3.8 12.3l5.3 5.3L20.2 6';

/**
 * A "Was there" cell of the feedback grid: the 24 px storyboard checkbox centred in a 44 × 44 target. Only the box
 * shows; the label ("Mette was there") is read by screen readers.
 */
export function GridCheck({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (checked: boolean) => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.gridCheck, { opacity: pressed ? 0.8 : 1 }]}
    >
      <CheckSquare size={24} checked={checked} />
    </Pressable>
  );
}

/**
 * A small checkbox with a 13 px muted label, for a secondary choice that should not compete with the form around
 * it ("I wasn't there myself" under the feedback grid). An 18 px box of the same family as the grid's 24 px
 * boxes; hitSlop brings the target to 44 px high.
 */
export function SmallCheck({ label, checked, onChange, testID }: { label: string; checked: boolean; onChange: (checked: boolean) => void; testID?: string }) {
  const slop = (Size.hitTarget - SMALL_CHECK_HEIGHT) / 2;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      hitSlop={{ top: slop, bottom: slop, left: 4, right: 12 }}
      style={({ pressed }) => [styles.smallCheck, { opacity: pressed ? 0.7 : 1 }]}
    >
      <CheckSquare size={18} checked={checked} />
      <Text variant="captionStrong" color="textMuted" style={styles.smallCheckLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/** As tall as its 18 px box, so the row adds as little as it can under the grid; the slop makes the target 44. */
const SMALL_CHECK_HEIGHT = 18;

export interface NoteFieldProps extends Omit<TextInputProps, 'style' | 'multiline' | 'maxLength' | 'value'> {
  /** 15/700 label, followed by a muted "(optional)"; also the input's accessibility label. */
  readonly label: string;
  readonly value: string;
  /** Shown as "0 / 500" at the right of the label. */
  readonly maxLength: number;
  /** Muted 13/1.45 line under the field. */
  readonly helper?: string;
}

/**
 * The optional free-text field of a report (after-report): label row with the counter, then 6 px below it a
 * three-line text area (15 px text, 12 / 14 padding, r14, 1 px input border; 2 px green when focused), then the
 * helper. The design system's TextField draws a taller (96 px, 16 px text) area with an 8 px gap, so this one is
 * drawn here to the storyboard's measure.
 */
export function NoteField({ label, value, maxLength, helper, onFocus, onBlur, ...input }: NoteFieldProps) {
  const p = usePalette();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const border = focused ? BorderWidth.strong : BorderWidth.hairline;
  // A thicker border eats into the padding, so the text does not move when the field gets focus.
  const inset = border - BorderWidth.hairline;
  return (
    <View style={styles.note}>
      <View style={styles.noteLabelRow}>
        <Text variant="heading" style={styles.noteLabel}>
          {label}
          <Text variant="heading" weight="500" color="textMuted" style={styles.noteLine}>
            {` ${t('common.optional')}`}
          </Text>
        </Text>
        <Text variant="caption" color={value.length >= maxLength ? 'dangerText' : 'textMuted'} style={styles.noteLine}>
          {`${value.length} / ${maxLength}`}
        </Text>
      </View>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={helper}
        // Muted rather than faint: a hint people can read (the storyboard's placeholder is about 4.6:1 on white).
        placeholderTextColor={p.textMuted}
        multiline
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
          typeStyle('body'),
          styles.noteInput,
          {
            color: p.text,
            backgroundColor: p.surface,
            borderColor: focused ? p.primary : p.borderStrong,
            borderWidth: border,
            paddingHorizontal: NOTE_PADDING_H - inset,
            paddingVertical: NOTE_PADDING_V - inset,
          },
        ]}
        {...input}
      />
      {helper ? (
        <Text variant="caption" color="textMuted" style={styles.noteHelper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const NOTE_PADDING_H = 14;
const NOTE_PADDING_V = 12;
/** A textarea line at 15 px ("normal" line height). */
const NOTE_LINE = 19;
/** Three lines, the padding and the border: the storyboard's `rows="3"`. */
const NOTE_MIN_HEIGHT = NOTE_LINE * 3 + NOTE_PADDING_V * 2 + BorderWidth.hairline * 2;

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  panel: { maxHeight: '92%', borderTopLeftRadius: Radius.panel, borderTopRightRadius: Radius.panel, paddingTop: 10 },
  handle: { width: 44, height: 5, borderRadius: Radius.bar, alignSelf: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  panelContent: { paddingHorizontal: Layout.gutter, paddingTop: 18, gap: 18 },
  action: {
    minHeight: 56,
    borderRadius: Radius.xl,
    borderWidth: BorderWidth.hairline,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: { flex: 1, gap: 2 },
  actionBody: { lineHeight: 19 },
  meetAgain: { width: MEET_AGAIN_WIDTH, flexDirection: 'row', justifyContent: 'space-between' },
  answer: { width: ANSWER_SIZE, height: ANSWER_SIZE, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  square: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gridCheck: { width: Size.hitTarget, height: Size.hitTarget, alignItems: 'center', justifyContent: 'center' },
  smallCheck: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: SMALL_CHECK_HEIGHT, alignSelf: 'flex-start' },
  smallCheckLabel: { lineHeight: SMALL_CHECK_HEIGHT, flexShrink: 1 },
  note: { gap: 6 },
  noteLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  // The label row at the browser's "normal" line height for 15 px (19), as the storyboard's label and counter.
  noteLabel: { flexShrink: 1, lineHeight: 19 },
  noteLine: { lineHeight: 19 },
  noteInput: { minHeight: NOTE_MIN_HEIGHT, lineHeight: NOTE_LINE, borderRadius: Radius.md, textAlignVertical: 'top' },
  noteHelper: { lineHeight: 19 },
});
